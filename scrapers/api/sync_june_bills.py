"""
6월 발의안 일괄 처리
====================
1차 API에서 6월(PROPOSE_DT 20260601~20260630) 법안만 추려
assembly_bill.py의 기존 로직(2·3차 API + AI 요약 + DB 저장)을 그대로 실행합니다.
"""

import os
import sys
from itertools import count

from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from api.assembly_bill import fetch_bill_list, fetch_bill_summary, fetch_bill_detail
from utils.ai_client import call_openai, ASSEMBLY_BILL
from utils.supabase_client import get_existing_bill_nos, save_bill

JUNE_START = "2026-06-27"
JUNE_END   = "2026-06-30"


def _in_june(propose_dt: str) -> bool:
    return JUNE_START <= propose_dt <= JUNE_END


def _before_june(propose_dt: str) -> bool:
    return propose_dt < JUNE_START


def sync_june_bills(page_size: int = 20) -> int:
    print(f"\n[6월 법안 처리] {JUNE_START} ~ {JUNE_END}")
    inserted = 0

    for page in count(1):
        print(f"  [1차 API] 페이지 {page} 요청 중...")
        bills = fetch_bill_list(page, page_size)
        if not bills:
            print("  수신된 법안 없음, 중단.")
            break

        june_bills = [b for b in bills if _in_june(b.get("PROPOSE_DT", ""))]
        oldest_dt  = min((b.get("PROPOSE_DT", "") for b in bills), default="")

        print(f"  {len(bills)}건 수신 — 6월 해당 {len(june_bills)}건 (이 페이지 최고령: {oldest_dt})")

        if june_bills:
            bill_nos = [b.get("BILL_NO", "") for b in june_bills]
            existing = get_existing_bill_nos(bill_nos)
            new_bills = [b for b in june_bills if b.get("BILL_NO", "") not in existing]
            print(f"  신규 {len(new_bills)}건 / 기존 {len(existing)}건")

            for i, bill in enumerate(new_bills, start=1):
                bill_no   = bill.get("BILL_NO", "")
                bill_id   = bill.get("BILL_ID", "")
                bill_name = bill.get("BILL_NAME", "")
                print(f"    [{i}/{len(new_bills)}] {bill_no} {bill_name[:35]}")

                summary    = fetch_bill_summary(bill_no)
                detail     = fetch_bill_detail(bill_id)
                ai_summary = call_openai(bill_name, summary, ASSEMBLY_BILL) if summary else None

                record = {
                    "의안ID":          bill_id,
                    "의안번호":         bill_no,
                    "의안명":           bill_name,
                    "소관위원회":       bill.get("COMMITTEE", ""),
                    "제안일":           bill.get("PROPOSE_DT", ""),
                    "대수":             bill.get("AGE", ""),
                    "상세링크":         bill.get("DETAIL_LINK", ""),
                    "발의자명단링크":   bill.get("MEMBER_LIST", ""),
                    "제안자":           bill.get("PROPOSER", ""),
                    "대표발의자":       bill.get("RST_PROPOSER", ""),
                    "공동발의자":       bill.get("PUBL_PROPOSER", ""),
                    "주요내용":         summary,
                    "AI요약":           ai_summary,
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

        # 페이지의 모든 법안이 6월 이전이면 더 이상 볼 필요 없음
        if _before_june(oldest_dt):
            print("  6월 이전 법안 도달 → 중단")
            break

    print(f"\n[완료] 총 {inserted}건 저장")
    return inserted


if __name__ == "__main__":
    sync_june_bills()
