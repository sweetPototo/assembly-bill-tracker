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
