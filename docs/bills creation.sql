CREATE TABLE bills (
    -- 기본 정보
    bill_id TEXT PRIMARY KEY,
    bill_no TEXT NOT NULL UNIQUE,
    bill_name TEXT NOT NULL,

    committee TEXT,

    propose_dt DATE,
    age INTEGER,

    detail_link TEXT,
    member_list TEXT,

    proposer TEXT,
    rst_proposer TEXT,
    publ_proposer TEXT,

    summary TEXT,
    ai_summary TEXT,

    ppsr_kind TEXT,

    -- 소관위원회
    jrcmit_proc_dt DATE,
    jrcmit_proc_rslt TEXT,

    -- 법제사법위원회
    law_proc_dt DATE,
    law_proc_rslt TEXT,

    -- 본회의
    rgs_rsln_dt DATE,
    rgs_conf_rslt TEXT,

    -- 공포
    prom_law_nm TEXT,
    prom_dt DATE,
    prom_no TEXT,

    -- 현재 상태
    status TEXT ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ai_reason TEXT,
ai_content TEXT,
ai_benefit TEXT,
ai_consideration TEXT,
ai_criteria TEXT
);

-- 목록 기본 정렬 (filter=all, 최근 발의안 5건)
CREATE INDEX idx_bills_propose_dt
  ON bills(propose_dt DESC NULLS LAST, bill_id DESC);

-- filter=active/closed + propose_dt 날짜 검색 + 월별 통계 진행중 COUNT
CREATE INDEX idx_bills_status_propose_dt
  ON bills(status, propose_dt DESC NULLS LAST, bill_id DESC);

-- rgs_rsln_dt 날짜 검색 + 월별 통계 가결/부결 COUNT
CREATE INDEX idx_bills_status_rgs_rsln_dt
  ON bills(status, rgs_rsln_dt DESC NULLS LAST);

-- 카테고리 다중 선택 필터 + propose_dt 정렬 (BillList 카테고리 드롭체크박스, WeeklyBillChart 드릴다운 링크)
CREATE INDEX idx_bills_category_propose_dt
  ON bills(category, propose_dt DESC NULLS LAST, bill_id DESC);

-- 조회수 TOP3 정렬 (fetchTopViewed)
CREATE INDEX idx_bills_view_count
  ON bills(view_count DESC NULLS LAST);

-- 월별 통계 '가결' COUNT: rgs_rsln_dt/prom_dt OR 범위 중 prom_dt 브랜치
CREATE INDEX idx_bills_prom_dt
  ON bills(prom_dt);

-- 월별 통계 '부결' COUNT: rgs_rsln_dt/jrcmit_proc_dt OR 범위 중 jrcmit_proc_dt 브랜치
CREATE INDEX idx_bills_jrcmit_proc_dt
  ON bills(jrcmit_proc_dt);

-- 법안명 · 요약 ILIKE 검색 (leading wildcard → trigram 필수)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_bills_bill_name_trgm ON bills USING GIN(bill_name gin_trgm_ops);
CREATE INDEX idx_bills_summary_trgm   ON bills USING GIN(summary   gin_trgm_ops);

-- 발의자 ILIKE 검색
CREATE INDEX idx_bills_rst_proposer_trgm  ON bills USING GIN(rst_proposer  gin_trgm_ops);
CREATE INDEX idx_bills_publ_proposer_trgm ON bills USING GIN(publ_proposer gin_trgm_ops);

CREATE TABLE search_logs (
  id bigserial PRIMARY KEY,
  term text NOT NULL,
  searched_at timestamptz DEFAULT NOW()
);

CREATE TABLE search_counts_monthly (
  ym     char(7)  NOT NULL, -- '2026-07'
  term   text     NOT NULL,
  cnt    bigint   NOT NULL,
  PRIMARY KEY (ym, term)
);

CREATE OR REPLACE FUNCTION increment_bill_view(bill_id_param TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE bills SET view_count = view_count + 1 WHERE bill_id = bill_id_param;
$$;

create table feedback (id bigserial primary key, content text not null, contact text, created_at timestamptz default now());
create table error_reports (id bigserial primary key, page_url text, description text not null, is_resolved boolean default false, created_at timestamptz default now());
create table notices (id bigserial primary key, title text not null, content text not null, is_published boolean default false, created_at timestamptz default now(), updated_at timestamptz default now());

create table bills_weekly_statistics (
date date,
category text,
bill_count int4,
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)

-- date 범위 조회 (fetchWeeklyStats) + (date, category) upsert 조회 (assembly_initiative_statistic.py)
CREATE INDEX idx_bills_weekly_statistics_date_category
  ON bills_weekly_statistics(date, category);

create table assembly_seat (
poly_group_nm text,
poly_nm text,
region text,
representative text,
sum int4,
per int4)