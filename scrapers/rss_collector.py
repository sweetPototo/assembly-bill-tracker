"""
뉴스 URL 수집기 (네이버 뉴스 섹션 페이지 기반)
================================================
수집 원리:
  네이버 뉴스 섹션 페이지는 Next.js로 만들어져 있습니다.
  서버가 HTML을 내려줄 때 <script id="__NEXT_DATA__"> 안에
  기사 목록 데이터를 JSON으로 함께 심어줍니다.

  [기존 문제]
  __NEXT_DATA__ JSON에는 해당 섹션 기사 외에 사이드바·추천 기사 등
  다른 섹션 URL도 포함됩니다. 정규식으로 전체 JSON을 스캔하면
  다른 섹션 기사가 먼저 등록된 섹션의 category를 가져가는 오류가 발생합니다.

  [수정 후]
  JSON을 파싱해서 섹션 메인 기사 목록 키(articleList, groups[].articles 등)만
  탐색합니다. 파싱 실패 시에만 정규식 폴백으로 전환합니다.
"""

import re
import json
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup

# ==============================================================================
# [설정] 수집할 네이버 뉴스 섹션 페이지 목록
# ==============================================================================

# 값: (category, isforeign)  — isforeign: 0=국내, 1=해외(외신)
RSS_FEED_URLS = {
    "https://news.naver.com/section/100": (0, 0),  # 정치 / 국내
    "https://news.naver.com/section/101": (1, 0),  # 경제 / 국내
    "https://news.naver.com/section/102": (2, 0),  # 사회 / 국내
    "https://news.naver.com/section/104": (3, 0),  # 세계 / 국내
}

# BBC RSS 피드: 표준 RSS 2.0 XML 포맷 (HTML 페이지가 아닌 실제 XML)
# collect_bbc_urls() 함수로 파싱
BBC_RSS_FEEDS = {
    "https://feeds.bbci.co.uk/news/world/asia/rss.xml": (3, 1),  # 세계 / 외신
}

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# 정규식 폴백용 — JSON 파싱 실패 시에만 사용
NAVER_ARTICLE_URL_PATTERN = re.compile(r'https://n\.news\.naver\.com/[^"\'<>\s]+')


# ==============================================================================
# [내부 헬퍼] __NEXT_DATA__ JSON에서 섹션 메인 기사 URL만 추출
# ==============================================================================

def _extract_section_urls(json_string: str) -> list[str]:
    """
    __NEXT_DATA__ JSON을 파싱해 섹션 메인 기사 URL을 반환합니다.
    네이버 Next.js 구조에서 가능한 경로를 순서대로 시도하며,
    모두 실패하면 빈 리스트를 반환합니다(→ 호출부에서 정규식 폴백).

    탐색 경로 (Naver 섹션 페이지 __NEXT_DATA__ 구조):
      1. initialState.articleList[].pcLinkUrl
      2. initialState.article.groups[].articles[].pcLinkUrl
      3. initialState.sectionArticleList.articleList[].pcLinkUrl
    """
    try:
        data         = json.loads(json_string)
        initial      = (data.get("props", {})
                            .get("pageProps", {})
                            .get("initialState", {}))

        article_items: list[dict] = []

        # 경로 1: initialState.articleList
        article_items = initial.get("articleList", [])

        # 경로 2: initialState.article.groups[].articles
        if not article_items:
            for group in initial.get("article", {}).get("groups", []):
                article_items.extend(group.get("articles", []))

        # 경로 3: initialState.sectionArticleList.articleList
        if not article_items:
            article_items = (initial.get("sectionArticleList", {})
                                    .get("articleList", []))

        if not article_items:
            return []

        urls = []
        for item in article_items:
            url = (item.get("pcLinkUrl")
                   or item.get("mobileLinkUrl")
                   or item.get("url")
                   or item.get("link", ""))
            # 쿼리 파라미터 제거 후 naver 기사 URL만 수집
            url = url.split("?")[0]
            if "n.news.naver.com" in url:
                urls.append(url)

        return urls

    except Exception:
        return []


# ==============================================================================
# [핵심 함수] 섹션 페이지 HTML에서 기사 URL 수집
# ==============================================================================

def collect_urls_from_rss(section_urls: dict) -> list[dict]:
    """
    네이버 뉴스 섹션 페이지 URL → (category, isforeign) 매핑 dict를 받아
    각 페이지에서 섹션 메인 기사 URL을 수집하고
    {"url": ..., "category": ..., "isforeign": ...} 리스트로 반환합니다.

    수집 방법 (3단계 폴백):
      1차) __NEXT_DATA__ JSON 파싱 → 섹션 기사 목록 키에서만 URL 추출
      2차) __NEXT_DATA__ JSON 전체 정규식 스캔 (1차 실패 시)
      3차) HTML <a href> 태그에서 직접 추출 (JSON 태그 없을 시)
    """
    print("\n[URL 수집] 네이버 뉴스 섹션 페이지에서 기사 URL을 수집합니다.")

    # 섹션별로 독립 수집 후 병합 — 동일 URL이 여러 섹션에 있으면 나중 섹션 우선
    # (각 섹션 페이지의 메인 기사 목록만 추출했으므로 나중 섹션이 더 신뢰성 높음)
    seen: dict[str, tuple[int, int]] = {}

    for section_url, (category, isforeign) in section_urls.items():
        print(f"  페이지 요청 중: {section_url} (category={category}, isforeign={isforeign})")
        try:
            response = requests.get(section_url, headers=REQUEST_HEADERS, timeout=10)
            response.raise_for_status()

            soup         = BeautifulSoup(response.text, "html.parser")
            next_data_tag = soup.find("script", id="__NEXT_DATA__")

            if next_data_tag and next_data_tag.string:
                # 1차: JSON 파싱으로 섹션 메인 기사만 추출
                urls_found = _extract_section_urls(next_data_tag.string)

                if urls_found:
                    print(f"  → [JSON 파싱] {len(urls_found)}개 URL 발견")
                else:
                    # 2차: JSON 파싱 경로 미일치 → 정규식 폴백
                    urls_found = NAVER_ARTICLE_URL_PATTERN.findall(next_data_tag.string)
                    print(f"  → [정규식 폴백] {len(urls_found)}개 URL 발견")
            else:
                # 3차: <a> 태그 직접 추출
                a_tags     = soup.find_all("a", href=NAVER_ARTICLE_URL_PATTERN)
                urls_found = [tag["href"].split("?")[0] for tag in a_tags]
                print(f"  → [<a> 태그 폴백] {len(urls_found)}개 URL 발견")

            # 섹션별 독립 수집: 나중 섹션이 동일 URL을 덮어씀
            for url in urls_found:
                seen[url] = (category, isforeign)

        except Exception as e:
            print(f"  [오류] 페이지 수집 실패: {e}")

    result = [
        {"url": url, "category": cat, "isforeign": isf}
        for url, (cat, isf) in seen.items()
    ]
    print(f"[URL 수집 완료] 총 {len(result)}개 고유 URL 확보\n")
    return result


# ==============================================================================
# [BBC 전용] RSS XML 파싱으로 기사 URL 수집
# ==============================================================================

def collect_bbc_urls(feeds: dict) -> list[dict]:
    """
    BBC RSS 2.0 XML 피드를 파싱해 기사 URL 목록을 반환합니다.
    네이버와 달리 HTML이 아닌 표준 XML 피드이므로 ElementTree로 파싱합니다.

    반환값: {"url": ..., "category": ..., "isforeign": ...} 리스트
    """
    print("\n[BBC RSS] 피드에서 기사 URL을 수집합니다.")
    results = []
    seen: set[str] = set()

    for feed_url, (category, isforeign) in feeds.items():
        print(f"  피드 요청 중: {feed_url}")
        try:
            response = requests.get(feed_url, headers=REQUEST_HEADERS, timeout=10)
            response.raise_for_status()

            # response.content (bytes) 로 파싱해야 XML 인코딩 선언과 충돌 없음
            root = ET.fromstring(response.content)
            channel = root.find("channel")
            if channel is None:
                print("  [경고] <channel> 태그를 찾지 못했습니다.")
                continue

            items = channel.findall("item")
            for item in items:
                link = (item.findtext("link") or "").strip()
                if link and link not in seen:
                    seen.add(link)
                    results.append({
                        "url": link,
                        "category": category,
                        "isforeign": isforeign,
                    })

            print(f"  → {len(items)}개 기사 URL 수집")

        except ET.ParseError as e:
            print(f"  [오류] XML 파싱 실패: {e}")
        except Exception as e:
            print(f"  [오류] 피드 수집 실패: {e}")

    print(f"[BBC RSS 수집 완료] 총 {len(results)}개 URL\n")
    return results
