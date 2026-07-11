"""
Supabase 연동 모듈
=================
articles 테이블에 크롤링된 기사를 저장합니다.
origin_url UNIQUE 제약조건 기반 upsert로 중복을 처리합니다.

사전 조건 (Supabase SQL Editor에서 1회 실행):
  ALTER TABLE public.articles
  ADD CONSTRAINT articles_origin_url_unique UNIQUE (origin_url);
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

_client: Client | None = None


def _get_client() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("SUPABASE_URL 또는 SUPABASE_KEY 환경변수가 설정되지 않았습니다.")
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def get_existing_urls(urls: list[str]) -> set[str]:
    """
    URL 목록 중 이미 DB에 존재하는 origin_url 집합을 반환합니다.
    PostgREST GET 요청의 URL 길이 제한(약 8KB)을 피하기 위해
    100개씩 청크로 나눠 조회한 뒤 합칩니다.
    """
    if not urls:
        return set()

    CHUNK_SIZE = 100
    existing: set[str] = set()

    try:
        client = _get_client()
        for i in range(0, len(urls), CHUNK_SIZE):
            chunk = urls[i:i + CHUNK_SIZE]
            result = (
                client
                .table("articles")
                .select("origin_url")
                .in_("origin_url", chunk)
                .execute()
            )
            existing.update(row["origin_url"] for row in (result.data or []))
    except Exception as e:
        print(f"  [Supabase] 기존 URL 조회 오류: {e}")

    return existing


def save_article(article: dict) -> bool:
    """
    article 딕셔너리를 articles 테이블에 upsert합니다.
    origin_url이 이미 존재하면 조용히 건너뜁니다.

    article 딕셔너리 필수 키:
      - url          → origin_url
      - title        → title
      - summary      → summary         (list[str], 4개 문장 배열)
      - keywords     → keywords        (list[str], 맥락 키워드 배열)
      - media_name   → publisher
      - published_at → published_at    (ISO 8601 문자열, 없으면 현재 UTC 시각 사용)
    """
    published_at = article.get("published_at")
    if not published_at:
        print(f"  [건너뜀] published_at 없음: {article.get('url', '')[:60]}")
        return False

    data = {
        "title": article["title"],
        "summary": article["summary"],
        "publisher": article["media_name"],
        "published_at": published_at,
        "origin_url": article["url"],
        "category": article["category"],
        "isforeign": article["isforeign"],
        "keywords": article.get("keywords", []),
        "reporter": article.get("reporter"),
    }

    try:
        result = (
            _get_client()
            .table("articles")
            .upsert(data, on_conflict="origin_url", ignore_duplicates=True)
            .execute()
        )
        if result.data:
            print(f"  [Supabase] 저장 완료: {article['title'][:40]}...")
            return True
        print(f"  [Supabase] 중복 기사 건너뜀: {article['url'][:60]}...")
        return False
    except Exception as e:
        print(f"  [Supabase] 저장 오류: {e}")
        return False


# ==============================================================================
# 국회 의안 (bills 테이블)
# ==============================================================================

FINAL_BILL_STATUSES = {"가결", "부결", "철회", "공포", "폐기"}


def _to_date(s: str) -> str | None:
    """날짜 문자열을 'YYYY-MM-DD'로 정규화. 빈 값이면 None 반환.
    - 'YYYYMMDD'   (8자리 숫자) → 'YYYY-MM-DD'
    - 'YYYY-MM-DD' (이미 ISO)  → 그대로 반환
    """
    s = (s or "").strip()
    if len(s) == 8 and s.isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:]}"
    if len(s) == 10 and s[4] == "-" and s[7] == "-":
        return s
    return None


def _derive_bill_status(bill: dict) -> str:
    if bill.get("공포일"):
        return "공포"
    rgs = bill.get("본회의심의결과", "")
    if "가결" in rgs:
        return "가결"
    if "부결" in rgs:
        return "부결"
    if "철회" in rgs:
        return "철회"
    for field in ("소관위처리결과", "법사위처리결과"):
        r = bill.get(field, "")
        if "철회" in r:
            return "철회"
        if "폐기" in r:
            return "폐기"
    return "진행중"


def get_existing_bill_nos(bill_nos: list[str]) -> set[str]:
    """bill_nos 중 이미 DB에 존재하는 bill_no 집합 반환."""
    if not bill_nos:
        return set()
    try:
        result = (
            _get_client()
            .table("bills")
            .select("bill_no")
            .in_("bill_no", bill_nos)
            .execute()
        )
        return {row["bill_no"] for row in (result.data or [])}
    except Exception as e:
        print(f"  [Supabase] 의안 조회 오류: {e}")
        return set()


def get_pending_bills() -> list[dict]:
    """status가 확정되지 않은 법안의 bill_id, bill_no 목록 반환."""
    try:
        result = (
            _get_client()
            .table("bills")
            .select("bill_id,bill_no")
            .not_.in_("status", list(FINAL_BILL_STATUSES))
            .execute()
        )
        return result.data or []
    except Exception as e:
        print(f"  [Supabase] 진행중 의안 조회 오류: {e}")
        return []


def save_bill(bill: dict) -> bool:
    """신규 법안을 bills 테이블에 삽입합니다."""
    ai = bill.get("AI요약") or {}
    age_raw = bill.get("대수", "")
    data = {
        "bill_id":          bill["의안ID"],
        "bill_no":          bill["의안번호"],
        "bill_name":        bill["의안명"],
        "committee":        bill.get("소관위원회") or None,
        "propose_dt":       _to_date(bill.get("제안일", "")),
        "age":              int(age_raw) if age_raw and age_raw.isdigit() else None,
        "detail_link":      bill.get("상세링크") or None,
        "member_list":      bill.get("발의자명단링크") or None,
        "proposer":         bill.get("제안자") or None,
        "rst_proposer":     bill.get("대표발의자") or None,
        "publ_proposer":    bill.get("공동발의자") or None,
        "summary":          bill.get("주요내용") or None,
        "ppsr_kind":        bill.get("제안자구분") or None,
        "jrcmit_cmmt_dt":   _to_date(bill.get("소관위회부일", "")),
        "jrcmit_prsnt_dt":  _to_date(bill.get("소관위상정일", "")),
        "jrcmit_proc_dt":   _to_date(bill.get("소관위처리일", "")),
        "jrcmit_proc_rslt": bill.get("소관위처리결과") or None,
        "law_cmmt_dt":      _to_date(bill.get("법사위회부일", "")),
        "law_prsnt_dt":     _to_date(bill.get("법사위체계처리일", "")),
        "law_proc_dt":      _to_date(bill.get("법사위처리일", "")),
        "law_proc_rslt":    bill.get("법사위처리결과") or None,
        "rgs_prsnt_dt":     _to_date(bill.get("본회의상정일", "")),
        "rgs_rsln_dt":      _to_date(bill.get("본회의의결일", "")),
        "rgs_conf_rslt":    bill.get("본회의심의결과") or None,
        "prom_law_nm":      bill.get("공포법률명") or None,
        "prom_dt":          _to_date(bill.get("공포일", "")),
        "prom_no":          bill.get("공포번호") or None,
        "status":           _derive_bill_status(bill),
        "ai_reason":        ai.get("reason") or None,
        "ai_content":       ai.get("summary") or None,
        "ai_benefit":       ai.get("benefit") or None,
        "ai_consideration": ai.get("consideration") or None,
        "category":         ai.get("category") or None,
    }
    try:
        result = _get_client().table("bills").insert(data).execute()
        if result.data:
            print(f"  [Supabase] 의안 저장: {bill['의안명'][:40]}")
            return True
        return False
    except Exception as e:
        print(f"  [Supabase] 의안 저장 오류: {e}")
        return False


def get_bills_without_category() -> list[dict]:
    """category가 NULL인 bills 목록(bill_id, bill_name, summary) 반환."""
    try:
        result = (
            _get_client()
            .table("bills")
            .select("bill_id,bill_name,summary")
            .is_("category", "null")
            .not_.is_("summary", "null")
            .execute()
        )
        return result.data or []
    except Exception as e:
        print(f"  [Supabase] 카테고리 없는 의안 조회 오류: {e}")
        return []


def update_bill_category(bill_id: str, category: str) -> bool:
    """bill_id에 해당하는 법안의 category 필드만 갱신."""
    try:
        result = (
            _get_client()
            .table("bills")
            .update({"category": category})
            .eq("bill_id", bill_id)
            .execute()
        )
        if result.data:
            print(f"  [Supabase] 카테고리 갱신: {bill_id} → {category}")
            return True
        return False
    except Exception as e:
        print(f"  [Supabase] 카테고리 갱신 오류 ({bill_id}): {e}")
        return False


def update_bill_status(bill_id: str, detail: dict) -> bool:
    """3차 API 결과로 진행 상태 및 위원회 관련 필드를 갱신합니다. AI 재실행 없음."""
    bill_for_status = {
        "공포일":         detail.get("PROM_DT", ""),
        "본회의심의결과": detail.get("RGS_CONF_RSLT", ""),
        "소관위처리결과": detail.get("JRCMIT_PROC_RSLT", ""),
        "법사위처리결과": detail.get("LAW_PROC_RSLT", ""),
    }
    new_status = _derive_bill_status(bill_for_status)

    data = {
        "committee":        detail.get("JRCMIT_NM") or None,
        "jrcmit_cmmt_dt":   _to_date(detail.get("JRCMIT_CMMT_DT", "")),
        "jrcmit_prsnt_dt":  _to_date(detail.get("JRCMIT_PRSNT_DT", "")),
        "jrcmit_proc_dt":   _to_date(detail.get("JRCMIT_PROC_DT", "")),
        "jrcmit_proc_rslt": detail.get("JRCMIT_PROC_RSLT") or None,
        "law_cmmt_dt":      _to_date(detail.get("LAW_CMMT_DT", "")),
        "law_prsnt_dt":     _to_date(detail.get("LAW_PRSNT_DT", "")),
        "law_proc_dt":      _to_date(detail.get("LAW_PROC_DT", "")),
        "law_proc_rslt":    detail.get("LAW_PROC_RSLT") or None,
        "rgs_prsnt_dt":     _to_date(detail.get("RGS_PRSNT_DT", "")),
        "rgs_rsln_dt":      _to_date(detail.get("RGS_RSLN_DT", "")),
        "rgs_conf_rslt":    detail.get("RGS_CONF_RSLT") or None,
        "prom_law_nm":      detail.get("PROM_LAW_NM") or None,
        "prom_dt":          _to_date(detail.get("PROM_DT", "")),
        "prom_no":          detail.get("PROM_NO") or None,
        "status":           new_status,
    }
    try:
        result = (
            _get_client()
            .table("bills")
            .update(data)
            .eq("bill_id", bill_id)
            .execute()
        )
        if result.data:
            print(f"  [Supabase] 갱신 완료: {bill_id} → {new_status}")
            return True
        return False
    except Exception as e:
        print(f"  [Supabase] 갱신 오류: {e}")
        return False
