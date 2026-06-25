"""
뉴스 크롤링 및 AI 요약 파이프라인
====================================
자바 개발자 관점:
  이 파일 전체가 하나의 "Service 레이어"입니다.
  각 함수가 자바의 private static 메서드 역할을 하고,
  run_pipeline()이 퍼사드(Facade) 패턴처럼 전체 흐름을 조율합니다.

설치 필요 라이브러리:
  pip install requests beautifulsoup4 openai
"""

import os
import requests
from bs4 import BeautifulSoup
from openai import OpenAI
from kiwipiepy import Kiwi
from dotenv import load_dotenv
from rss_collector import collect_urls_from_rss, RSS_FEED_URLS, collect_bbc_urls, BBC_RSS_FEEDS
from utils.google_drive import save_and_upload
from utils.supabase_client import save_article, get_existing_urls

# Kiwi 모델 로딩은 시간이 걸리므로 모듈 수준에서 1회만 초기화
_kiwi = Kiwi()

load_dotenv()  # .env 파일을 읽어서 환경변수로 등록 — 자바의 @PropertySource("classpath:.env") 와 유사

# ==============================================================================
# [설정 영역] 자바의 static final 상수 / application.properties 역할
# ==============================================================================

# 뉴스 텍스트에서 키워드로 뽑기 부적합한 명사 (불용어)
# - 시간/지시어: 기사 주제와 무관한 시간/지시 표현
# - 동작명사: 기자가 "~했다"를 명사화한 서술형 단어 (강조, 언급, 발표 등)
#   → 이런 단어는 기사 주제가 아니라 기사 서술 방식을 나타냄
_STOPWORDS = {
    # 시간 / 지시
    "기자", "뉴스", "오늘", "내일", "어제", "이날", "당일", "전날",
    "오전", "오후", "올해", "지난해", "최근", "이후", "이전", "전후",
    "관련", "관계자", "해당", "이번", "지난", "다음", "현재", "당시",
    "경우", "부분", "수준", "내용", "상황", "사실", "때문",
    "대한", "통해", "위해", "대해", "따라", "가운데", "이상", "이하",
    # 서술·보도 행위 동작명사
    "강조", "언급", "발표", "주장", "요구", "촉구", "지적", "확인",
    "설명", "강행", "발언", "답변", "보고", "제출", "선언", "호소",
    "규정", "명시", "제안", "제시", "지시", "통보", "시사", "암시",
    # 반응·평가 동작명사
    "반발", "비판", "규탄", "지지", "반대", "찬성", "동의", "거부",
    "수용", "승인", "반려", "수락", "거절", "옹호", "비난", "질타",
    # 행정·절차 동작명사
    "결정", "논의", "검토", "추진", "진행", "실시", "도입", "시행",
    "운영", "마련", "구성", "개편", "개선", "강화", "완화", "변경",
    "수정", "폐지", "철회", "중단", "재개", "완료", "종료", "처리",
    "합의", "협의", "조율", "조정", "채택", "부결", "가결", "통과",
    "추가", "삭제", "반영", "공개", "허용", "금지", "제한", "해제",
    # 분석·전망 동작명사
    "분석", "평가", "전망", "예상", "우려", "기대", "조사", "검사",
    "증가", "감소", "상승", "하락", "확대", "축소", "집중", "강화",
    # 일반 뉴스 용어
    "보도", "언론", "방송", "기사", "취재", "예정", "계획", "방침",
    "의혹", "논란", "파장", "여파", "입장", "약속", "행보", "움직임",
}

# OpenAI API 키: 환경변수 OPENAI_API_KEY 에서 읽습니다.
# 터미널에서 미리 설정: $env:OPENAI_API_KEY = "sk-..."  (PowerShell 기준)
# 테스트 목적이라면 아래 문자열에 직접 입력해도 되지만, 절대 Git에 올리지 마세요.
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "YOUR_API_KEY_HERE")

# 사용할 GPT 모델 이름
OPENAI_MODEL = "gpt-4o-mini"

# 규칙 기반 필터링에 사용할 핵심 키워드 목록
# 자바로 치면: List<String> FILTER_KEYWORDS = List.of("법안", "개정", ...)
FILTER_KEYWORDS = [
    "법안", "개정", "시위", "독소조항", "탄핵",
    "입법", "국회", "집회", "헌법", "거부권",
    "잠실", "올림픽 공원", "민주당", "국민의 힘",
    "개헌", "미국", "투표", "선거", "민주주의",
    "CBDC", "한국은행", "유출"
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
# 자바의 HttpURLConnection.setRequestProperty("User-Agent", "...") 와 동일
REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


# ==============================================================================
# [키워드 추출] 형태소 분석으로 명사 키워드 추출
# ==============================================================================

def extract_keywords(title: str, summary: str) -> list[str]:
    """
    기사 제목과 AI 요약에서 키워드를 추출합니다.

    추출 전략:
    - NNP(고유명사): 인물·기관·지역명 → 제목/요약 어디서 나와도 수집
    - NNG(일반명사): 서술형 단어가 많으므로 제목에서 나온 것만 수집
      (제목은 기사를 가장 압축적으로 대표하는 텍스트)
    - 불용어, 2글자 미만 단어 제거
    """
    title_tokens   = _kiwi.tokenize(title)
    summary_tokens = _kiwi.tokenize(summary)

    # 제목에 등장한 NNG 단어만 허용 목록에 등록
    title_nng: set[str] = {
        t.form for t in title_tokens
        if t.tag == "NNG" and len(t.form) >= 2 and t.form not in _STOPWORDS
    }

    seen: set[str] = set()
    result: list[str] = []

    for token in title_tokens + summary_tokens:
        word = token.form
        if word in seen or len(word) < 2 or word in _STOPWORDS:
            continue
        # 고유명사는 무조건 수집, 일반명사는 제목 출신만 수집
        if token.tag == "NNP" or (token.tag == "NNG" and word in title_nng):
            seen.add(word)
            result.append(word)

    return result


# ==============================================================================
# [1단계] 뉴스 수집 함수 — 자바의 NewsRepository.findByUrl(url) 역할
# ==============================================================================

def fetch_news_article(url: str) -> dict | None:
    """
    네이버 뉴스 URL 하나를 받아서 언론사, 제목, 본문을 파싱한 뒤
    딕셔너리(dict)로 반환합니다.

    [자바 비교]
      반환 타입 dict  →  Map<String, String> 또는 NewsArticle DTO
      None 반환       →  return null; (파싱 실패 시)
    """
    print(f"\n[크롤링] 요청 중: {url}")

    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=10)
        # HTTP 4xx/5xx 응답이면 즉시 예외 발생 — 자바의 if (!response.isOk()) throw ... 와 동일
        response.raise_for_status()

        # BeautifulSoup으로 HTML 파싱 — 자바의 Jsoup.parse(html) 와 100% 같은 개념
        soup = BeautifulSoup(response.text, "html.parser")

        # 언론사명: <a class="media_end_head_top_logo"> 안의 <img> 에서 추출
        # img.get("title") 로 안전하게 읽고, 없으면 alt 속성으로 폴백합니다.
        # 자바: Optional.ofNullable(img.attr("title")).orElse(img.attr("alt"))
        media_tag = soup.find("a", class_="media_end_head_top_logo")
        if media_tag:
            img_tag = media_tag.find("img")
            media_name = (
                img_tag.get("title") or img_tag.get("alt", "알 수 없는 언론사")
            ) if img_tag else "알 수 없는 언론사"
        else:
            media_name = "알 수 없는 언론사"

        # 제목: <h2 id="title_area"> 태그의 텍스트
        title_tag = soup.find("h2", id="title_area")
        title = title_tag.get_text(strip=True) if title_tag else "제목 없음"

        # 본문: <article id="dic_area"> 태그의 텍스트
        content_tag = soup.find("article", id="dic_area")
        content = content_tag.get_text(strip=True) if content_tag else ""

        if not content:
            print(f"  [경고] 본문을 찾지 못했습니다. URL 구조가 달라졌을 수 있습니다.")
            return None

        # 기사 작성 일시: <span class="_ARTICLE_DATE_TIME"> 의 data-date-time 속성
        # 예시 값: "2025-06-18T14:30:00+09:00" (ISO 8601)
        date_tag = soup.find("span", class_="_ARTICLE_DATE_TIME")
        published_at = date_tag.get("data-date-time") if date_tag else None

        # dict(딕셔너리) 생성 및 반환
        # 자바로 치면: Map.of("url", url, "mediaName", mediaName, ...) 또는 new NewsArticleDto(...)
        article = {
            "url": url,
            "media_name": media_name,
            "title": title,
            "content": content,
            "published_at": published_at,
        }

        print(f"  [성공] 언론사: {media_name} | 제목: {title[:30]}...")
        return article

    except requests.exceptions.RequestException as e:
        # 네트워크 오류, 타임아웃 등 HTTP 관련 예외만 잡습니다.
        # 자바의 catch (IOException e) 에 해당
        print(f"  [오류] HTTP 요청 실패: {e}")
        return None
    except Exception as e:
        # 그 외 파싱 오류 등 예상치 못한 예외
        # 자바의 catch (Exception e) 에 해당
        print(f"  [오류] 파싱 중 예외 발생: {e}")
        return None


# ==============================================================================
# [1단계 - 외신] BBC 기사 크롤링
# ==============================================================================

def fetch_bbc_article(url: str) -> dict | None:
    """
    BBC News 기사 URL을 받아 제목·본문·발행일을 파싱합니다.
    네이버와 HTML 구조가 달라 별도 함수로 분리합니다.

    본문 추출 전략 (2단계 폴백):
      1차) data-component="text-block" div — BBC React 앱의 본문 블록
      2차) <article> 내 <p> 태그 직접 추출
    """
    print(f"\n[BBC 크롤링] 요청 중: {url}")
    try:
        response = requests.get(url, headers=REQUEST_HEADERS, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        # 제목: id="main-heading" → 첫 번째 h1 → og:title 메타 순으로 시도
        h1 = soup.find("h1", id="main-heading") or soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)
        else:
            og = soup.find("meta", property="og:title")
            title = og.get("content", "No title") if og else "No title"

        # 본문 추출
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

        # 발행 시각: <time datetime="..."> → og:article:published_time 순으로 시도
        published_at = None
        time_tag = soup.find("time", attrs={"datetime": True})
        if time_tag:
            published_at = time_tag["datetime"]
        if not published_at:
            meta = soup.find("meta", property="article:published_time")
            if meta:
                published_at = meta.get("content")

        print(f"  [성공] 제목: {title[:50]}...")
        return {
            "url": url,
            "media_name": "BBC News",
            "title": title,
            "content": content,
            "published_at": published_at,
        }

    except requests.exceptions.RequestException as e:
        print(f"  [오류] HTTP 요청 실패: {e}")
        return None
    except Exception as e:
        print(f"  [오류] 파싱 중 예외 발생: {e}")
        return None


# ==============================================================================
# [2단계] 키워드 필터링 함수 — 자바의 FilterService.isRelevant(article) 역할
# ==============================================================================

def filter_by_keywords(article: dict, keywords: list) -> bool:
    """
    기사 본문에 keywords 목록 중 하나라도 포함되어 있으면 True를 반환합니다.
    하나도 없으면 False — 이 경우 AI 요약을 건너뜁니다.

    [자바 비교]
      keywords.stream().anyMatch(k -> content.contains(k))
      과 완전히 동일한 로직입니다.

      아래 any()와 in 키워드를 사용한 한 줄 표현이
      자바 Stream API의 anyMatch()에 해당합니다.
    """
    content = article.get("content", "")

    # [리스트 컴프리헨션 + any() 조합]
    # 자바: keywords.stream().anyMatch(k -> content.contains(k))
    # 파이썬: any(k in content for k in keywords)
    #   - "k in content"  →  content.contains(k)
    #   - "for k in keywords" →  .stream() + 순회
    #   - any(...)         →  .anyMatch(...)
    matched = [k for k in keywords if k in content]

    if matched:
        print(f"  [필터 통과] 매칭된 키워드: {matched}")
        return True
    else:
        print(f"  [필터 제외] 관련 키워드가 없습니다. AI 요약을 건너뜁니다.")
        return False


def filter_by_keywords_bbc(article: dict, keywords: list) -> bool:
    """
    BBC 영문 기사 전용 키워드 필터 — 대소문자 무관, 제목+본문 동시 검색.

    국내 필터(filter_by_keywords)와의 차이:
      - 텍스트를 lowercase로 변환해 비교 (영어 대소문자 통합)
      - content뿐 아니라 title도 함께 검색
    """
    text = (article.get("title", "") + " " + article.get("content", "")).lower()
    matched = [k for k in keywords if k in text]

    if matched:
        print(f"  [필터 통과] 매칭된 BBC 키워드: {matched}")
        return True
    else:
        print(f"  [필터 제외] 관련 BBC 키워드가 없습니다. AI 요약을 건너뜁니다.")
        return False


# ==============================================================================
# [3단계] AI 요약 함수 — 자바의 AiSummaryService.summarize(article) 역할
# ==============================================================================

def summarize_with_ai(article: dict) -> str:
    """
    OpenAI GPT 모델에 기사 본문을 전달하고 3줄 요약 결과를 받아 반환합니다.

    [자바 비교]
      OpenAI 클라이언트 객체 생성  →  new OpenAiClient(apiKey)
      client.chat.completions.create(...)  →  client.sendRequest(requestBody)
      messages 리스트  →  List<Message> (역할별 메시지 DTO 목록)
    """
    if OPENAI_API_KEY == "YOUR_API_KEY_HERE":
        print("  [건너뜀] OPENAI_API_KEY가 설정되지 않았습니다. 환경변수를 확인하세요.")
        return "[API 키 미설정 — 요약 생략]"

    print(f"  [AI 요약] GPT 요청 중...")

    # OpenAI 클라이언트 초기화 — 자바의 new OpenAiClient(apiKey) 와 동일
    client = OpenAI(api_key=OPENAI_API_KEY)

    # 본문이 너무 길면 토큰(비용) 낭비이므로 앞 2000자만 사용합니다.
    content_snippet = article["content"][:2000]

    # messages 리스트: OpenAI는 대화 이력을 리스트 형태로 받습니다.
    # 자바로 치면: List<Map<String, String>> messages = new ArrayList<>();
    # 각 원소는 {"role": "...", "content": "..."} 구조의 딕셔너리(= Map<String, String>)
    messages = [
        {
            # system 메시지 = AI의 페르소나와 행동 지침 주입
            "role": "system",
            "content": (
                "당신은 대한민국 정치·사회 뉴스를 분석하는 팩트체크 전문 AI입니다. "
                "반드시 원본 기사에 명시된 사실만 사용하고, "
                "'심각한', '충격적인' 같은 주관적 형용사는 절대 사용하지 마십시오. "
                "요약은 반드시 한국어로, 아래 형식의 3줄 bullet point로만 작성하십시오:\n"
                "• [핵심 사실 1]\n"
                "• [핵심 사실 2]\n"
                "• [핵심 사실 3]"
            ),
        },
        {
            # user 메시지 = 실제 요약 요청
            "role": "user",
            "content": (
                f"다음 뉴스 기사를 3줄 bullet point로 요약해 주세요.\n\n"
                f"제목: {article['title']}\n\n"
                f"본문:\n{content_snippet}"
            ),
        },
    ]

    try:
        # OpenAI Chat Completions API 호출
        # 자바로 치면: HttpResponse<String> response = client.post("/v1/chat/completions", body)
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            temperature=0.2,  # 낮을수록 일관되고 사실 중심적인 응답 (0.0~2.0)
            max_tokens=300,   # 응답 최대 토큰 수 (비용 절감)
        )

        # 응답에서 텍스트 추출
        # 자바: response.getChoices().get(0).getMessage().getContent()
        summary = response.choices[0].message.content.strip()
        return summary

    except Exception as e:
        print(f"  [오류] OpenAI API 호출 실패: {e}")
        return f"[요약 실패: {e}]"


# ==============================================================================
# [3단계 - 외신] BBC 기사 AI 요약 — 국제정치학 기자 페르소나
# ==============================================================================

def summarize_with_ai_foreign(article: dict) -> tuple[str, str]:
    """
    BBC 외신 기사 전용 AI 요약 + 제목 한국어 번역 (API 호출 1회).

    반환: (번역된_한국어_제목, 3줄_요약)
    실패 시 원본 영어 제목을 그대로 반환합니다.
    """
    if OPENAI_API_KEY == "YOUR_API_KEY_HERE":
        print("  [건너뜀] OPENAI_API_KEY가 설정되지 않았습니다.")
        return article["title"], "[API 키 미설정 — 요약 생략]"

    print("  [AI 요약+번역] BBC 외신 GPT 요청 중...")
    client = OpenAI(api_key=OPENAI_API_KEY)

    content_snippet = article["content"][:3000]

    messages = [
        {
            "role": "system",
            "content": "너는 국제정치학 기자야.",
        },
        {
            "role": "user",
            "content": (
                "제공된 BBC 기사의 제목을 자연스러운 한국어로 번역하고, "
                "본문에서 현장 묘사나 지엽적인 인터뷰는 제외하고, "
                "[사건의 핵심 팩트 / 갈등의 원인 / 향후 지정학적 영향]을 중심으로 "
                "명확하게 한국어 3줄 요약을 작성해 줘.\n\n"
                "반드시 아래 형식으로만 작성해:\n"
                "번역제목: [한국어 번역 제목]\n"
                "• [핵심 사실 1]\n"
                "• [핵심 사실 2]\n"
                "• [핵심 사실 3]\n\n"
                f"제목: {article['title']}\n\n"
                f"본문:\n{content_snippet}"
            ),
        },
    ]

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            temperature=0.2,
            max_tokens=500,
        )
        raw = response.choices[0].message.content.strip()

        title_ko = article["title"]  # 파싱 실패 시 원본 영어 제목 유지
        summary_lines = []

        for line in raw.splitlines():
            line = line.strip()
            if line.startswith("번역제목:"):
                title_ko = line[len("번역제목:"):].strip()
            elif line.startswith("•"):
                summary_lines.append(line)

        summary = "\n".join(summary_lines) if summary_lines else raw
        return title_ko, summary

    except Exception as e:
        print(f"  [오류] OpenAI API 호출 실패: {e}")
        return article["title"], f"[요약 실패: {e}]"


# ==============================================================================
# [4단계] 결과 출력 함수 — 자바의 ResultPrinter.print(article) 역할
# ==============================================================================

def print_result(article: dict, summary: str) -> None:
    """
    최종 결과를 콘솔에 보기 좋게 출력합니다.
    이후 DB 저장 또는 파일 저장 로직으로 교체 예정입니다.
    """
    separator = "=" * 60
    print(f"\n{separator}")
    print(f"  언론사 : {article['media_name']}")
    print(f"  제  목 : {article['title']}")
    print(f"  URL   : {article['url']}")
    print(f"{separator}")
    print("  [AI 3줄 요약]")
    # 요약 결과의 각 줄 앞에 들여쓰기를 추가해서 출력
    for line in summary.splitlines():
        print(f"  {line}")
    print(f"{separator}\n")


# ==============================================================================
# [파이프라인 진입점] 자바의 NewsService.processAll(List<String> urls) 역할
# ==============================================================================

def run_pipeline(urls: list, limit: int | None = None) -> list:
    """
    URL 목록을 입력받아 크롤링 → 필터링 → AI 요약 → 결과 출력의
    전체 파이프라인을 순서대로 실행합니다.

    limit: 처리할 최대 기사 수. None이면 전체 처리.

    [자바 비교]
      for (String url : urls) { ... }  →  for url in urls: ...
      results 리스트  →  List<Map<String, String>> results = new ArrayList<>()

    반환값: 최종적으로 처리된 기사 딕셔너리 목록 (summary 필드 포함)
    """
    print(f"\n총 {len(urls)}개의 URL에 대해 파이프라인을 시작합니다.")
    print("-" * 60)

    results = []

    # 수집된 URL 전체를 1회 배치 조회 → AI 호출 전 중복 여부 판단에 사용
    all_urls = [item["url"] for item in urls]
    existing_urls = get_existing_urls(all_urls)
    print(f"[중복 체크] DB에 이미 존재하는 기사: {len(existing_urls)}개")

    for i, item in enumerate(urls, start=1):
        url        = item["url"]
        category   = item["category"]
        isforeign  = item["isforeign"]
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

        # --- Step 4: AI 요약 ---
        summary = summarize_with_ai(article)

        # --- Step 5: 결과 출력 ---
        print_result(article, summary)

        article["summary"]    = summary
        article["category"]   = category
        article["isforeign"]  = isforeign
        article["keywords"]   = extract_keywords(article["title"], summary)

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
      크롤링 → 중복 체크 → AI 요약(국제정치학) → 키워드 추출 → Supabase 저장

    국내 파이프라인과의 차이:
      - 키워드 필터링 없음 (BBC Asia 섹션 전체가 세계 정치 관련)
      - fetch_bbc_article() 사용 (BBC 전용 HTML 파서)
      - summarize_with_ai_foreign() 사용 (국제정치학 기자 프롬프트)
      - 키워드 추출: 번역된 한국어 제목 + AI 요약에서 추출
      - isforeign=1 로 저장됨 (BBC_RSS_FEEDS 설정값)
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

        # --- Step 4: AI 요약 + 제목 한국어 번역 ---
        title_ko, summary = summarize_with_ai_foreign(article)

        article["title"] = title_ko  # 번역된 한국어 제목으로 교체

        # --- Step 5: 출력 ---
        print_result(article, summary)

        article["summary"]   = summary
        article["category"]  = category
        article["isforeign"] = isforeign
        article["keywords"]  = extract_keywords(title_ko, summary)

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
    # ── [테스트 제한] 아래 블록 전체를 삭제하면 제한이 해제됩니다 ──────────────
    TEST_LIMIT = 200
    # ────────────────────────────────────────────────────────────────────────────

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
