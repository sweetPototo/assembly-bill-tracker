"""
교육부 교육뉴스 API 연동 모듈
API: http://apis.data.go.kr/1250000/nesdta/getNesdta
"""

import os
import json
import math
import requests
from datetime import date
from dotenv import load_dotenv
from bs4 import BeautifulSoup

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE_URL = "http://apis.data.go.kr/1250000/nesdta/getNesdta"
SERVICE_KEY = os.environ.get("MOU_NEWS_API_KEY", "")


def today_str() -> str:
    """오늘 날짜를 YYYYMMDD 형식으로 반환."""
    return date.today().strftime("%Y%m%d")


def strip_html(html: str) -> str:
    """HTML 태그와 &nbsp; 등 엔티티를 제거하고 순수 텍스트만 반환."""
    text = BeautifulSoup(html, "html.parser").get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def parse_items(data: dict) -> list[dict]:
    """API 응답 JSON에서 필요한 필드만 추출."""
    try:
        items = data["response"]["body"]["items"]["item"]
        if isinstance(items, dict):
            items = [items]
    except (KeyError, TypeError):
        return []

    return [
        {
            "title":     item.get("title", ""),
            "updt_date": item.get("updt_date", ""),
            "file_url":  item.get("file_url", ""),
            "content":   strip_html(item.get("content", "")) if item.get("content") else "",
        }
        for item in items
    ]


def _get(params: dict) -> dict | None:
    """공통 GET 요청."""
    try:
        response = requests.get(BASE_URL, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        print(f"[오류] HTTP 오류: {e} — 응답 본문: {response.text[:300]}")
    except requests.exceptions.RequestException as e:
        print(f"[오류] 요청 실패: {e}")
    except Exception as e:
        print(f"[오류] 예외 발생: {e}")
    return None


def fetch_mou_news(page: int = 1, page_size: int = 10,
                   bgng_ymd: str | None = None, end_ymd: str | None = None) -> list[dict]:
    """
    교육부 교육뉴스를 조회합니다.

    Args:
        page:      페이지 번호 (기본 1)
        page_size: 페이지당 결과 수
        bgng_ymd:  조회 시작일 (YYYYMMDD). None이면 당일
        end_ymd:   조회 종료일 (YYYYMMDD). None이면 당일

    Returns:
        뉴스 dict 리스트, 실패 시 빈 리스트
    """
    if not SERVICE_KEY:
        print("[오류] MOU_NEWS_API_KEY 환경변수가 설정되지 않았습니다. scrapers/.env 를 확인하세요.")
        return []

    today = today_str()
    params = {
        "ServiceKey": SERVICE_KEY,
        "pageNo":     page,
        "numOfRows":  page_size,
        "bgng_ymd":   bgng_ymd or today,
        "end_ymd":    end_ymd  or today,
    }

    print(f"[MOU API] 요청 중: {BASE_URL} (page={page}, {params['bgng_ymd']}~{params['end_ymd']})")
    data = _get(params)
    return parse_items(data) if data else []


if __name__ == "__main__":
    items = fetch_mou_news(bgng_ymd="20260601", end_ymd="20260622")
    print(json.dumps(items, ensure_ascii=False, indent=2))
