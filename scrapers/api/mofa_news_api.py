"""
외교부 보도자료 API 연동 모듈
API: https://apis.data.go.kr/1262000/pressRlsService
"""

import os
import json
import math
import requests
from dotenv import load_dotenv
from bs4 import BeautifulSoup

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE_URL = "https://apis.data.go.kr/1262000/pressRlsService/getPressRls"
SERVICE_KEY = os.environ.get("MOFA_API_KEY", "")


def strip_html(html: str) -> str:
    """HTML 태그와 &nbsp; 등 엔티티를 제거하고 순수 텍스트만 반환."""
    text = BeautifulSoup(html, "html.parser").get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def parse_items(data: dict) -> list[dict]:
    """API 응답 JSON에서 필요한 필드만 추출. 반환 필드: title, updt_date, file_url, content"""
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
            "content":   strip_html(item.get("content", "")),
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


def fetch_press_releases(page: int | None = None, page_size: int = 1) -> list[dict]:
    """
    외교부 보도자료를 조회합니다.

    Args:
        page:      페이지 번호. None이면 totalCount로 마지막 페이지를 자동 계산
        page_size: 페이지당 결과 수

    Returns:
        보도자료 dict 리스트, 실패 시 빈 리스트
    """
    if not SERVICE_KEY:
        print("[오류] MOFA_API_KEY 환경변수가 설정되지 않았습니다. scrapers/.env 를 확인하세요.")
        return []

    base_params = {
        "serviceKey": SERVICE_KEY,
        "numOfRows":  page_size,
        "returnType": "json",
    }

    if page is None:
        print("[MOFA API] totalCount 조회 중...")
        probe = _get({**base_params, "pageNo": 1, "numOfRows": 1})
        if probe is None:
            return []
        total = probe.get("response", {}).get("body", {}).get("totalCount", 0)
        page  = math.ceil(total / page_size)
        print(f"[MOFA API] 전체 {total}건 → 마지막 페이지: {page}")

    print(f"[MOFA API] 요청 중: {BASE_URL} (page={page})")
    data = _get({**base_params, "pageNo": page})
    return parse_items(data) if data else []


if __name__ == "__main__":
    items = fetch_press_releases(page=1, page_size=5)
    print(json.dumps(items, ensure_ascii=False, indent=2))
