"""
국회 의안 동기화 모듈
=====================
Track A — 신규 법안 수집:
  1차 API에서 최신순으로 페이지를 받아, 페이지 전체가 DB에 존재하면 중단.
  신규 법안만 2·3차 API + AI 요약 후 DB 삽입.

Track B — 진행중 법안 상태 갱신:
  DB에서 미확정(status NOT IN 확정값) 법안 조회 → 3차 API로 상태만 갱신. AI 없음.
"""

import os
import sys
import xml.etree.ElementTree as ET
import requests
from itertools import count
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from utils.ai_client import call_openai, ASSEMBLY_BILL
from utils.supabase_client import (
    get_existing_bill_nos, get_pending_bills,
    save_bill, update_bill_status,
)

BILL_LIST_URL    = "https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn"
BILL_SUMMARY_URL = "https://open.assembly.go.kr/portal/openapi/BPMBILLSUMMARY"
BILL_DETAIL_URL  = "https://open.assembly.go.kr/portal/openapi/BILLINFODETAIL"
SERVICE_KEY      = os.environ.get("ASSEMBLY_API_KEY", "")


# ==============================================================================
# API 호출 함수
# ==============================================================================

def parse_xml(xml_text: str) -> list[dict]:
    try:
        root = ET.fromstring(xml_text)
        return [
            {child.tag: (child.text or "").strip() for child in row}
            for row in root.findall("row")
        ]
    except ET.ParseError as e:
        print(f"[오류] XML 파싱 실패: {e}")
        return []


def fetch_bill_list(page: int, page_size: int) -> list[dict]:
    """1차 API: 22대 의안 목록 (최신순)."""
    try:
        response = requests.get(BILL_LIST_URL, params={
            "key": SERVICE_KEY, "type": "xml",
            "pIndex": page, "pSize": page_size, "age": 22,
        }, timeout=10)
        response.raise_for_status()
        return parse_xml(response.text)
    except requests.exceptions.HTTPError as e:
        print(f"[오류] HTTP 오류: {e} — {response.text[:200]}")
        return []
    except Exception as e:
        print(f"[오류] 의안 목록 요청 실패: {e}")
        return []


def fetch_bill_summary(bill_no: str) -> str:
    """2차 API: BILL_NO로 제안이유 및 주요내용 조회."""
    try:
        response = requests.get(BILL_SUMMARY_URL, params={
            "key": SERVICE_KEY, "type": "xml", "BILL_NO": bill_no,
        }, timeout=10)
        response.raise_for_status()
        rows = parse_xml(response.text)
        return rows[0].get("SUMMARY", "") if rows else ""
    except Exception as e:
        print(f"  [오류] 요약 조회 실패 (BILL_NO={bill_no}): {e}")
        return ""


def fetch_bill_detail(bill_id: str) -> dict:
    """3차 API: BILL_ID로 의안 상세정보 조회."""
    try:
        response = requests.get(BILL_DETAIL_URL, params={
            "key": SERVICE_KEY, "type": "xml", "BILL_ID": bill_id,
        }, timeout=10)
        response.raise_for_status()
        rows = parse_xml(response.text)
        return rows[0] if rows else {}
    except Exception as e:
        print(f"  [오류] 상세정보 조회 실패 (BILL_ID={bill_id}): {e}")
        return {}


# ==============================================================================
# Track A — 신규 법안 수집
# ==============================================================================

def sync_new_bills(page_size: int = 20) -> int:
    """
    1차 API를 최신순으로 순회하며 신규 법안만 삽입.
    한 페이지의 모든 법안이 DB에 존재하면 이후 페이지는 건너뜀.
    """
    if not SERVICE_KEY:
        print("[오류] ASSEMBLY_API_KEY가 설정되지 않았습니다.")
        return 0

    print("\n[Track A] 신규 법안 수집 시작")
    inserted = 0

    for page in count(1):
        print(f"  [1차 API] 페이지 {page} 요청 중...")
        bills = fetch_bill_list(page, page_size)
        if not bills:
            print("  수신된 법안 없음, 중단.")
            break

        bill_nos  = [b.get("BILL_NO", "") for b in bills]
        existing  = get_existing_bill_nos(bill_nos)
        new_bills = [b for b in bills if b.get("BILL_NO", "") not in existing]
        print(f"  {len(bills)}건 수신 — 신규 {len(new_bills)}건 / 기존 {len(existing)}건")

        for i, bill in enumerate(new_bills, start=1):
            bill_no   = bill.get("BILL_NO", "")
            bill_id   = bill.get("BILL_ID", "")
            bill_name = bill.get("BILL_NAME", "")
            print(f"    [{i}/{len(new_bills)}] {bill_no} {bill_name[:30]}")

            summary    = fetch_bill_summary(bill_no)
            detail     = fetch_bill_detail(bill_id)
            ai_summary = call_openai(bill_name, summary, ASSEMBLY_BILL) if summary else None

            record = {
                "의안ID":        bill_id,
                "의안번호":       bill_no,
                "의안명":         bill_name,
                "소관위원회":     bill.get("COMMITTEE", ""),
                "제안일":         bill.get("PROPOSE_DT", ""),
                "대수":           bill.get("AGE", ""),
                "상세링크":       bill.get("DETAIL_LINK", ""),
                "발의자명단링크": bill.get("MEMBER_LIST", ""),
                "제안자":         bill.get("PROPOSER", ""),
                "대표발의자":     bill.get("RST_PROPOSER", ""),
                "공동발의자":     bill.get("PUBL_PROPOSER", ""),
                "주요내용":       summary,
                "AI요약":         ai_summary,
                "제안자구분":       detail.get("PPSR_KIND", ""),
                "소관위회부일":     detail.get("JRCMIT_CMMT_DT", ""),
                "소관위상정일":     detail.get("JRCMIT_PRSNT_DT", ""),
                "소관위처리일":     detail.get("JRCMIT_PROC_DT", ""),
                "소관위처리결과":   detail.get("JRCMIT_PROC_RSLT", ""),
                "법사위회부일":     detail.get("LAW_CMMT_DT", ""),
                "법사위체계처리일": detail.get("LAW_PRSNT_DT", ""),
                "법사위처리일":     detail.get("LAW_PROC_DT", ""),
                "법사위처리결과":   detail.get("LAW_PROC_RSLT", ""),
                "본회의상정일":     detail.get("RGS_PRSNT_DT", ""),
                "본회의의결일":     detail.get("RGS_RSLN_DT", ""),
                "본회의심의결과":   detail.get("RGS_CONF_RSLT", ""),
                "공포법률명":       detail.get("PROM_LAW_NM", ""),
                "공포일":           detail.get("PROM_DT", ""),
                "공포번호":         detail.get("PROM_NO", ""),
            }
            if save_bill(record):
                inserted += 1

        if not new_bills:
            print("  페이지 전체가 기존 법안 → 이후 페이지 건너뜀")
            break
        print(f"발의일 : {bill.get('PROPOSE_DT', '')}")
        print(f"의안번호 : {bill_no}")
    
    print(f"[Track A 완료] 신규 저장: {inserted}건")
    return inserted


# ==============================================================================
# Track B — 진행중 법안 상태 갱신
# ==============================================================================

def update_pending_bills() -> int:
    """
    DB에서 미확정 법안을 꺼내 3차 API로 상태·위원회 등 필드를 갱신.
    AI 재실행 없음.
    """
    print("\n[Track B] 진행중 법안 갱신 시작")
    pending = get_pending_bills()
    print(f"  진행중 법안: {len(pending)}건")

    updated = 0
    for i, row in enumerate(pending, start=1):
        bill_id = row["bill_id"]
        print(f"  [{i}/{len(pending)}] {bill_id} 조회 중...")
        detail = fetch_bill_detail(bill_id)
        if detail and update_bill_status(bill_id, detail):
            updated += 1

    print(f"[Track B 완료] 갱신: {updated}건")
    return updated


# ==============================================================================
# 진입점
# ==============================================================================

def sync_bills():
    sync_new_bills()
    update_pending_bills()


if __name__ == "__main__":
    sync_bills()
