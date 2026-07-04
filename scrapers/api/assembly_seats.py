"""
국회 의석수 동기화 모듈
========================
API에서 정당별 의석 현황을 가져와 assembly_seat 테이블에 저장합니다.
매 실행 시 기존 데이터를 모두 삭제하고 최신 데이터를 삽입합니다.

API: https://open.assembly.go.kr/portal/openapi/nepjpxkkabqiqpbvk
컬럼 매핑:
  poly_group_nm ← POLY_GROUP_NM
  poly_nm       ← POLY_NM
  region        ← N1  (지역구 의석)
  representative← N2  (비례대표 의석)
  sum           ← N3  (합계)
  per           ← N4  (비율 %, 반올림 정수)
"""

import os
import sys
import xml.etree.ElementTree as ET
import requests
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from utils.supabase_client import _get_client

SEATS_URL   = "https://open.assembly.go.kr/portal/openapi/nepjpxkkabqiqpbvk"
SERVICE_KEY = os.environ.get("ASSEMBLY_API_KEY", "")


# ==============================================================================
# API 호출
# ==============================================================================

def fetch_seats() -> list[dict]:
    """국회 의석수 API에서 전체 데이터를 가져옵니다."""
    if not SERVICE_KEY:
        print("[오류] ASSEMBLY_API_KEY가 설정되지 않았습니다.")
        return []

    try:
        response = requests.get(SEATS_URL, params={
            "key": SERVICE_KEY, "type": "xml", "pIndex": 1, "pSize": 100,
        }, timeout=10)
        response.raise_for_status()

        root = ET.fromstring(response.text)

        result_code = root.findtext("head/RESULT/CODE", "")
        if result_code != "INFO-000":
            msg = root.findtext("head/RESULT/MESSAGE", "")
            print(f"[오류] API 오류: {result_code} — {msg}")
            return []

        rows = [
            {child.tag: (child.text or "").strip() for child in row}
            for row in root.findall("row")
        ]
        print(f"  [API] 수신: {len(rows)}건")
        return rows

    except ET.ParseError as e:
        print(f"[오류] XML 파싱 실패: {e}")
        return []
    except Exception as e:
        print(f"[오류] API 요청 실패: {e}")
        return []


# ==============================================================================
# DB 저장
# ==============================================================================

def _to_int(value: str) -> int | None:
    """문자열을 반올림 정수로 변환. 변환 실패 시 None 반환."""
    try:
        return round(float(value))
    except (ValueError, TypeError):
        return None


def sync_seats() -> int:
    """
    API에서 의석 데이터를 가져와 assembly_seat 테이블을 갱신합니다.
    기존 데이터를 삭제하고 최신 데이터를 삽입합니다.
    """
    print("[의석수 동기화] 시작")
    rows = fetch_seats()
    if not rows:
        print("[의석수 동기화] 데이터 없음, 중단.")
        return 0

    client = _get_client()

    # 기존 데이터 전체 삭제
    try:
        client.table("assembly_seat").delete().neq("poly_nm", "").execute()
        print("  [Supabase] 기존 데이터 삭제 완료")
    except Exception as e:
        print(f"  [Supabase] 기존 데이터 삭제 오류: {e}")
        return 0

    # 신규 데이터 삽입
    records = [
        {
            "poly_group_nm": row.get("POLY_GROUP_NM") or None,
            "poly_nm":       row.get("POLY_NM") or None,
            "region":        _to_int(row.get("N1", "")),
            "representative": _to_int(row.get("N2", "")),
            "sum":           _to_int(row.get("N3", "")),
            "per":           _to_int(row.get("N4", "")),
        }
        for row in rows
    ]

    try:
        result = client.table("assembly_seat").insert(records).execute()
        inserted = len(result.data or [])
        print(f"  [Supabase] 저장 완료: {inserted}건")
        for rec in records:
            print(f"    {rec['poly_group_nm']:12} | {rec['poly_nm']:12} | "
                  f"지역 {rec['region']:3} | 비례 {rec['representative']:3} | "
                  f"합계 {rec['sum']:3} | {rec['per']}%")
        print(f"[의석수 동기화 완료] 저장: {inserted}건")
        return inserted
    except Exception as e:
        print(f"  [Supabase] 저장 오류: {e}")
        return 0


# ==============================================================================
# 진입점
# ==============================================================================

if __name__ == "__main__":
    sync_seats()
