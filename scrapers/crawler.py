"""
뉴스 크롤링 및 AI 요약 파이프라인
====================================
자바 개발자 관점:
  이 파일 전체가 하나의 "Service 레이어"입니다.
  각 함수가 자바의 private static 메서드 역할을 하고,
  run_pipeline()이 퍼사드(Facade) 패턴처럼 전체 흐름을 조율합니다.

설치 필요 라이브러리:
  pip install requests beautifulsoup4 openai python-dotenv supabase
"""

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from rss_collector import collect_urls_from_rss, RSS_FEED_URLS, collect_bbc_urls, BBC_RSS_FEEDS
from utils.google_drive import save_and_upload
from utils.supabase_client import save_article, get_existing_urls
from utils.ai_client import call_openai, DOMESTIC_NEWS, FOREIGN_NEWS

load_dotenv()  # .env 파일을 읽어서 환경변수로 등록

# ==============================================================================
# [설정 영역] 자바의 static final 상수 / application.properties 역할
# ==============================================================================

# 규칙 기반 필터링에 사용할 핵심 키워드 목록
FILTER_KEYWORDS = [
    "법안", "개정", "시위", "독소조항", "탄핵",
    "입법", "국회", "집회", "헌법", "거부권",
    "잠실", "올림픽 공원", "민주당", "국민의 힘",
    "개헌", "미국", "투표", "선거", "민주주의",
    "CBDC", "한국은행", "유출", "한국", "대한민국"
]

# BBC 외신 기사 영문 키워드 필터 — 대소문자 무관(lowercase 비교)
BBC_FILTER_KEYWORDS = [
    "democracy", "democratic values", "authoritarianism", "autocracy",
    "human rights", "dissident", "protest", "censorship",
    "elections", "diplomacy", "foreign policy", "alliance",
    "bilateral relations", "trilateral", "sanctions", "summit",
    "geopolitics", "defense", "military expansion", "security",
    "deterrence", "taiwan strait", "south china sea",
    "joint military drills", "nuclear",
    "supply chain", "semiconductor", "microchips",
    "economic security", "trade war", "export controls",
    "south korea", "seoul", "washington",
    "us", "usa", "beijing", "china", "indo-pacific", "CBDC"
]

# 네이버 뉴스 크롤링 시 브라우저로 위장하는 HTTP 헤더
REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


# ==============================================================================
# [1단계] 뉴스 수집 함수 — 자바의 NewsRepository.findByUrl(url) 역할
# ==============================================================================

def fetch_news_article(url: str) -> dict | None:
    """
    네이버 뉴스 URL 하나를 받아서 언론사, 제목, 본문을 파싱한 뒤
    딕셔너리(dict)로 반환합니다.
    """
    print(f"\n[크롤링] 요청 중: {url}")

    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        media_tag = soup.find("a", class_="media_end_head_top_logo")
        if media_tag:
            img_tag = media_tag.find("img")
            media_name = (
                img_tag.get("title") or img_tag.get("alt", "알 수 없는 언론사")
            ) if img_tag else "알 수 없는 언론사"
        else:
            media_name = "알 수 없는 언론사"

        title_tag = soup.find("h2", id="title_area")
        title = title_tag.get_text(strip=True) if title_tag else "제목 없음"

        content_tag = soup.find("article", id="dic_area")
        content = content_tag.get_text(strip=True) if content_tag else ""

        if not content:
            print(f"  [경고] 본문을 찾지 못했습니다. URL 구조가 달라졌을 수 있습니다.")
            return None

        date_tag = soup.find("span", class_="_ARTICLE_DATE_TIME")
        published_at = date_tag.get("data-date-time") if date_tag else None

        reporter_tag = (
            soup.find("em", class_="media_end_head_journalist_name")
            or soup.find("span", class_="byline_s")
        )
        reporter = reporter_tag.get_text(strip=True) if reporter_tag else None

        article = {
            "url": url,
            "media_name": media_name,
            "title": title,
            "content": content,
            "published_at": published_at,
            "reporter": reporter,
        }

        print(f"  [성공] 언론사: {media_name} | 제목: {title[:30]}...")
        return article

    except requests.exceptions.RequestException as e:
        print(f"  [오류] HTTP 요청 실패: {e}")
        return None
    except Exception as e:
        print(f"  [오류] 파싱 중 예외 발생: {e}")
        return None


# ==============================================================================
# [1단계 - 외신] BBC 기사 크롤링
# ==============================================================================

def fetch_bbc_article(url: str) -> dict | None:
    """
    BBC News 기사 URL을 받아 제목·본문·발행일을 파싱합니다.

    본문 추출 전략 (2단계 폴백):
      1차) data-component="text-block" div — BBC React 앱의 본문 블록
      2차) <article> 내 <p> 태그 직접 추출
    """
    print(f"\n[BBC 크롤링] 요청 중: {url}")
    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        h1 = soup.find("h1", id="main-heading") or soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)
        else:
            og = soup.find("meta", property="og:title")
            title = og.get("content", "No title") if og else "No title"

        blocks = soup.find_all("div", attrs={"data-component": "text-block"})
        if blocks:
            content = "\n".join(b.get_text(strip=True) for b in blocks)
        else:
            article_tag = soup.find("article")
            paras = article_tag.find_all("p") if article_tag else []
            content = "\n".join(p.get_text(strip=True) for p in paras)

        if not content:
            print("  [경고] BBC 기사 본문을 찾지 못했습니다.")
            return None

        published_at = None
        time_tag = soup.find("time", attrs={"datetime": True})
        if time_tag:
            published_at = time_tag["datetime"]
        if not published_at:
            meta = soup.find("meta", property="article:published_time")
            if meta:
                published_at = meta.get("content")

        byline = soup.find("div", attrs={"data-component": "byline-block"})
        reporter = byline.get_text(strip=True) if byline else None

        print(f"  [성공] 제목: {title[:50]}...")
        return {
            "url": url,
            "media_name": "BBC News",
            "title": title,
            "content": content,
            "published_at": published_at,
            "reporter": reporter,
        }

    except requests.exceptions.RequestException as e:
        print(f"  [오류] HTTP 요청 실패: {e}")
        return None
    except Exception as e:
        print(f"  [오류] 파싱 중 예외 발생: {e}")
        return None


# ==============================================================================
# [2단계] 키워드 필터링 함수
# ==============================================================================

def filter_by_keywords(article: dict, keywords: list) -> bool:
    """기사 본문에 keywords 중 하나라도 포함되면 True."""
    content = article.get("content", "")
    matched = [k for k in keywords if k in content]

    if matched:
        print(f"  [필터 통과] 매칭된 키워드: {matched}")
        return True
    else:
        print(f"  [필터 제외] 관련 키워드가 없습니다. AI 요약을 건너뜁니다.")
        return False


def filter_by_keywords_bbc(article: dict, keywords: list) -> bool:
    """BBC 영문 기사 전용 키워드 필터 — 대소문자 무관, 제목+본문 동시 검색."""
    text = (article.get("title", "") + " " + article.get("content", "")).lower()
    matched = [k for k in keywords if k in text]

    if matched:
        print(f"  [필터 통과] 매칭된 BBC 키워드: {matched}")
        return True
    else:
        print(f"  [필터 제외] 관련 BBC 키워드가 없습니다. AI 요약을 건너뜁니다.")
        return False


# ==============================================================================
# [결과 출력] 자바의 ResultPrinter.print(article) 역할
# ==============================================================================

def print_result(article: dict, summary: list[str]) -> None:
    """최종 결과를 콘솔에 보기 좋게 출력합니다."""
    labels = ["Fact      ", "Detail    ", "Background", "Insight   "]
    separator = "=" * 60
    print(f"\n{separator}")
    print(f"  언론사 : {article['media_name']}")
    print(f"  제  목 : {article['title']}")
    print(f"  URL   : {article['url']}")
    print(f"{separator}")
    print("  [AI 4줄 인사이트 요약]")
    for label, line in zip(labels, summary):
        print(f"  [{label}] {line}")
    print(f"{separator}\n")


# ==============================================================================
# [파이프라인 진입점] 자바의 NewsService.processAll(List<String> urls) 역할
# ==============================================================================

def run_pipeline(urls: list, limit: int | None = None) -> list:
    """
    URL 목록을 입력받아 크롤링 → 필터링 → AI 분석 → Supabase 저장의
    전체 파이프라인을 순서대로 실행합니다.
    """
    print(f"\n총 {len(urls)}개의 URL에 대해 파이프라인을 시작합니다.")
    print("-" * 60)

    results = []

    all_urls = [item["url"] for item in urls]
    existing_urls = get_existing_urls(all_urls)
    print(f"[중복 체크] DB에 이미 존재하는 기사: {len(existing_urls)}개")

    for i, item in enumerate(urls, start=1):
        url       = item["url"]
        category  = item["category"]
        isforeign = item["isforeign"]
        print(f"\n[{i}/{len(urls)}] 처리 시작")

        # --- Step 1: 중복 체크 ---
        if url in existing_urls:
            print("  → 이미 DB에 존재, 건너뜁니다.")
            continue

        # --- Step 2: 크롤링 ---
        article = fetch_news_article(url)
        if article is None:
            print("  → 크롤링 실패, 다음 URL로 넘어갑니다.")
            continue

        # --- Step 3: 키워드 필터링 ---
        if not filter_by_keywords(article, FILTER_KEYWORDS):
            print("  → 관련 없는 기사, 다음 URL로 넘어갑니다.")
            continue

        if limit is not None and len(results) >= limit:
            print(f"  → 처리 제한({limit}개) 도달, 파이프라인을 중단합니다.")
            break

        # --- Step 4: AI 분석 (요약 + 키워드 1회 호출) ---
        analysis = call_openai(article["title"], article["content"], DOMESTIC_NEWS)
        if analysis is None:
            print("  → AI 분석 실패, 다음 URL로 넘어갑니다.")
            continue

        # --- Step 5: 결과 출력 ---
        print_result(article, analysis["summary"])

        article["summary"]   = "\n".join(f"• {s}" for s in analysis["summary"])
        article["keywords"]  = analysis["context_keywords"]
        article["category"]  = category
        article["isforeign"] = isforeign

        # --- Step 6: Supabase 저장 ---
        saved = save_article(article)

        # --- Step 7: Google Drive 업로드 (신규 기사만) ---
        if saved:
            save_and_upload(article)

        results.append(article)

    print(f"\n파이프라인 완료. 총 {len(results)}건 처리되었습니다.")
    return results


# ==============================================================================
# [파이프라인 - 외신] BBC 기사 전용
# ==============================================================================

def run_bbc_pipeline(urls: list, limit: int | None = None) -> list:
    """
    BBC 외신 기사 파이프라인:
      크롤링 → 중복 체크 → 필터링 → AI 분석(번역+요약+키워드) → Supabase 저장
    """
    print(f"\n[BBC 파이프라인] 총 {len(urls)}개 URL 처리 시작")
    print("-" * 60)

    results = []
    all_urls = [item["url"] for item in urls]
    existing_urls = get_existing_urls(all_urls)
    print(f"[중복 체크] DB에 이미 존재하는 기사: {len(existing_urls)}개")

    for i, item in enumerate(urls, start=1):
        url       = item["url"]
        category  = item["category"]
        isforeign = item["isforeign"]
        print(f"\n[{i}/{len(urls)}] 처리 시작")

        # --- Step 1: 중복 체크 ---
        if url in existing_urls:
            print("  → 이미 DB에 존재, 건너뜁니다.")
            continue

        # --- Step 2: BBC 크롤링 ---
        article = fetch_bbc_article(url)
        if article is None:
            print("  → 크롤링 실패, 건너뜁니다.")
            continue

        # --- Step 3: 키워드 필터링 (영문, 대소문자 무관) ---
        if not filter_by_keywords_bbc(article, BBC_FILTER_KEYWORDS):
            print("  → 지정학 관련 기사 아님, 건너뜁니다.")
            continue

        if limit is not None and len(results) >= limit:
            print(f"  → 처리 제한({limit}개) 도달, 파이프라인을 중단합니다.")
            break

        # --- Step 4: AI 분석 (번역 + 요약 + 키워드 1회 호출) ---
        analysis = call_openai(article["title"], article["content"], FOREIGN_NEWS)
        if analysis is None:
            print("  → AI 분석 실패, 건너뜁니다.")
            continue

        # --- Step 5: 결과 출력 ---
        article["title"] = analysis["title_ko"]  # 번역된 한국어 제목으로 교체
        print_result(article, analysis["summary"])

        article["summary"]   = "\n".join(f"• {s}" for s in analysis["summary"])
        article["keywords"]  = analysis["context_keywords"]
        article["category"]  = category
        article["isforeign"] = isforeign

        # --- Step 6: Supabase 저장 ---
        saved = save_article(article)
        if saved:
            save_and_upload(article)

        results.append(article)

    print(f"\n[BBC 파이프라인 완료] 총 {len(results)}건 처리")
    return results


# ==============================================================================
# [main] 자바의 public static void main(String[] args) 역할
# ==============================================================================

if __name__ == "__main__":
    TEST_LIMIT = 10

    # ── 1. 국내 뉴스 파이프라인 (네이버) ──────────────────────────────────────
    domestic_urls = collect_urls_from_rss(RSS_FEED_URLS)
    if not domestic_urls:
        print("[국내] 수집된 URL이 없습니다. 피드 주소를 확인하세요.")
    else:
        domestic_results = run_pipeline(domestic_urls, limit=TEST_LIMIT)
        print(f"[국내 최종] AI 요약 완료: {len(domestic_results)}건")

    # ── 2. BBC 외신 파이프라인 ─────────────────────────────────────────────────
    bbc_urls = collect_bbc_urls(BBC_RSS_FEEDS)
    if not bbc_urls:
        print("[BBC] 수집된 URL이 없습니다. 피드 주소를 확인하세요.")
    else:
        bbc_results = run_bbc_pipeline(bbc_urls, limit=TEST_LIMIT)
        print(f"[BBC 최종] AI 요약 완료: {len(bbc_results)}건")
