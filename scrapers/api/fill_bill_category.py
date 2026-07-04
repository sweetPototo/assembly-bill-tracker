"""
카테고리 없는 법안 일괄 분류
============================
bills 테이블에서 category IS NULL 인 법안을 조회하고,
ASSEMBLY_CATEGORY_BILL 프롬프트로 카테고리를 받아 DB에 반영합니다.
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from utils.ai_client import call_openai, ASSEMBLY_CATEGORY_BILL
from utils.supabase_client import get_bills_without_category, update_bill_category


def fill_categories() -> int:
    bills = get_bills_without_category()
    print(f"[카테고리 미설정 법안] {len(bills)}건")

    if not bills:
        print("처리할 법안이 없습니다.")
        return 0

    updated = 0
    for i, row in enumerate(bills, start=1):
        bill_id   = row["bill_id"]
        bill_name = row.get("bill_name", "")
        summary   = row.get("summary", "")

        print(f"\n  [{i}/{len(bills)}] {bill_id} {bill_name[:40]}")

        result = call_openai("", summary, ASSEMBLY_CATEGORY_BILL)
        if not result or "category" not in result:
            print(f"  [건너뜀] AI 응답 없음 또는 category 키 누락")
            continue

        category = result["category"].strip()
        if update_bill_category(bill_id, category):
            updated += 1

    print(f"\n[완료] 총 {updated}/{len(bills)}건 카테고리 갱신")
    return updated


if __name__ == "__main__":
    fill_categories()
