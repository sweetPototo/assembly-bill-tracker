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
      - summary      → summary
      - media_name   → publisher
      - published_at → published_at (ISO 8601 문자열, 없으면 현재 UTC 시각 사용)
    """
    from datetime import datetime, timezone
    published_at = article.get("published_at") or datetime.now(timezone.utc).isoformat()

    data = {
        "title": article["title"],
        "summary": article["summary"],
        "publisher": article["media_name"],
        "published_at": published_at,
        "origin_url": article["url"],
        "category": article["category"],
        "isforeign": article["isforeign"],
        "keywords": article.get("keywords", []),
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
