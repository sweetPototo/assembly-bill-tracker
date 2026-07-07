"""
국회 발의안 일별 통계 모듈
=========================
bills 테이블에서 특정 제안일(propose_dt)의 category별 발의안 개수를 집계해
bills_weekly_statistics 테이블에 저장합니다.

실행 주기: 매일 1회 (cron 등)
  - date = 오늘 날짜
  - (date, category) 조합이 이미 있으면 UPDATE, 없으면 INSERT
"""

import os
import sys
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from utils.supabase_client import _get_client


def fetch_bill_counts_by_category(target_date: str) -> dict[str, int]:
    """bills 테이블에서 target_date에 제안된 법안을 category별로 집계."""
    result = (
        _get_client()
        .table("bills")
        .select("category")
        .eq("propose_dt", target_date)
        .execute()
    )
    counts: dict[str, int] = {}
    for row in (result.data or []):
        cat = row.get("category") or "미분류"
        counts[cat] = counts.get(cat, 0) + 1
    return counts


def run():
    client = _get_client()
    target_date = (date.today() - timedelta(days=1)).isoformat()
    print(f"[일별 통계] date: {target_date}")

    # 카테고리별 집계
    counts = fetch_bill_counts_by_category(target_date)
    print(f"  집계된 카테고리 수: {len(counts)}")

    # 오늘 데이터가 이미 있는지 확인
    existing = (
        client
        .table("bills_weekly_statistics")
        .select("category")
        .eq("date", target_date)
        .execute()
    )
    existing_categories = {row["category"] for row in (existing.data or [])}

    ok = 0
    for category, bill_count in sorted(counts.items()):
        try:
            if category in existing_categories:
                result = (
                    client
                    .table("bills_weekly_statistics")
                    .update({"bill_count": bill_count, "updated_at": "now()"})
                    .eq("date", target_date)
                    .eq("category", category)
                    .execute()
                )
                action = "UPDATE"
            else:
                result = (
                    client
                    .table("bills_weekly_statistics")
                    .insert({"date": target_date, "category": category, "bill_count": bill_count})
                    .execute()
                )
                action = "INSERT"

            if result.data:
                print(f"  [{action}] {category}: {bill_count}건")
                ok += 1
            else:
                print(f"  [실패] {category}")
        except Exception as e:
            print(f"  [오류] {category}: {e}")

    print(f"[완료] {ok}/{len(counts)} 처리")


if __name__ == "__main__":
    run()
