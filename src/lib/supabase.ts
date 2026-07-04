import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// =========================================================
// 타입 정의 — 자바의 ArticleDto.java (DTO 클래스)와 동일
// Supabase articles 테이블 컬럼과 1:1 매핑
// =========================================================
export interface Article {
  id: string
  title: string
  summary: string        // "• Fact\n• Detail\n• Background\n• Insight" 형식
  publisher: string
  published_at: string   // ISO 8601 타임스탬프
  origin_url: string
  view_count: number
  category: number       // 0:정치 1:경제 2:사회 3:세계
  isforeign: number      // 0:국내 1:외신
  keywords: string[]     // 형태소 분석으로 추출한 명사 키워드
  reporter: string | null
  created_at: string
}

// =========================================================
// 국회 법률안 타입
// =========================================================
export interface Bill {
  bill_id:      string
  bill_no:      string
  bill_name:    string
  committee:    string | null
  propose_dt:   string | null
  rst_proposer: string | null
  status:       string | null
  category:     string | null
  ai_reason:    string | null
  view_count:   number
}

export interface BillDetail {
  bill_id:          string
  bill_no:          string
  bill_name:        string
  committee:        string | null
  propose_dt:       string | null
  proposer:         string | null
  rst_proposer:     string | null
  publ_proposer:    string | null
  member_list:      string | null
  detail_link:      string | null
  status:           string | null
  category:         string | null
  summary:          string | null
  ai_reason:        string | null
  ai_content:       string | null
  ai_benefit:       string | null
  ai_consideration: string | null
  view_count:       number
  // 진행 단계 — 소관위원회
  jrcmit_cmmt_dt:   string | null
  jrcmit_prsnt_dt:  string | null
  jrcmit_proc_dt:   string | null
  jrcmit_proc_rslt: string | null
  // 진행 단계 — 법제사법위원회
  law_cmmt_dt:      string | null
  law_prsnt_dt:     string | null
  law_proc_dt:      string | null
  law_proc_rslt:    string | null
  // 진행 단계 — 본회의
  rgs_prsnt_dt:     string | null
  rgs_rsln_dt:      string | null
  rgs_conf_rslt:    string | null
}

// =========================================================
// 국회 의석 현황
// =========================================================
export interface AssemblySeat {
  poly_group_nm: string | null
  poly_nm:       string | null
  region:        number | null
  representative:number | null
  sum:           number | null
  per:           number | null
}

export async function fetchAssemblySeats(): Promise<AssemblySeat[]> {
  // assembly_seat는 RLS로 anon 접근이 막혀 있으므로 서버 전용 service_role 클라이언트 사용
  const serverClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await serverClient
    .from('assembly_seat')
    .select('poly_group_nm, poly_nm, region, representative, sum, per')
  return data ?? []
}

export const BILL_PAGE_SIZE = 10

export async function fetchBillById(billId: string): Promise<BillDetail | null> {
  const { data, error } = await supabase
    .from('bills')
    .select(`
      bill_id, bill_no, bill_name, committee, propose_dt,
      proposer, rst_proposer, publ_proposer, member_list, detail_link,
      status, category, summary,
      ai_reason, ai_content, ai_benefit, ai_consideration,
      view_count,
      jrcmit_cmmt_dt, jrcmit_prsnt_dt, jrcmit_proc_dt, jrcmit_proc_rslt,
      law_cmmt_dt, law_prsnt_dt, law_proc_dt, law_proc_rslt,
      rgs_prsnt_dt, rgs_rsln_dt, rgs_conf_rslt
    `)
    .eq('bill_id', billId)
    .single()
  if (error) return null
  return data
}

export type BillFilter = 'all' | 'active' | 'closed'

export interface BillSearch {
  keyword?:      string
  proposer?:     string
  dateField?:    'propose_dt' | 'rgs_rsln_dt'
  dateFrom?:     string
  dateTo?:       string
  statusFilter?: 'passed' | 'rejected'
  category?:     string[]
}

// scrapers/utils/ai_client.py ASSEMBLY_CATEGORY_BILL 카테고리 목록과 동일
export const BILL_CATEGORIES = [
  '경제', '노동', '교육', '복지', '환경', '국방', '외교', '산업',
  '과학기술', '교통', '금융', '부동산', '의료', '문화', '행정', '사법', '미분류',
] as const

const CLOSED_STATUSES = ['가결', '부결', '철회', '공포', '폐기']

export async function fetchBills(
  from: number,
  filter: BillFilter = 'all',
  search: BillSearch = {},
): Promise<Bill[]> {
  let query = supabase
    .from('bills')
    .select('bill_id, bill_no, bill_name, committee, propose_dt, rst_proposer, status, category, ai_reason, view_count')

  if (filter === 'active') {
    query = query.eq('status', '진행중')
  } else if (filter === 'closed') {
    query = query.in('status', CLOSED_STATUSES)
  }

  if (search.keyword?.trim()) {
    const k = `%${search.keyword.trim()}%`
    query = query.or(`bill_name.ilike.${k},summary.ilike.${k}`)
  }

  if (search.proposer?.trim()) {
    const p = `%${search.proposer.trim()}%`
    query = query.or(`rst_proposer.ilike.${p},publ_proposer.ilike.${p}`)
  }

  const dateCol = search.dateField ?? 'propose_dt'
  if (search.dateFrom) query = query.gte(dateCol, search.dateFrom)
  if (search.dateTo)   query = query.lte(dateCol, search.dateTo)

  if (search.category?.length) query = query.in('category', search.category)

  if (search.statusFilter === 'passed')
    query = query.in('status', ['가결', '공포'])
  else if (search.statusFilter === 'rejected')
    query = query.in('status', ['부결', '철회', '폐기'])

  const { data, error } = await query
    .order('propose_dt', { ascending: false, nullsFirst: false })
    .order('bill_id',    { ascending: false })
    .range(from, from + BILL_PAGE_SIZE - 1)
  if (error) throw new Error(error.message)
  return data ?? []
}

// =========================================================
// 공지사항
// =========================================================
export interface Notice {
  id:         number
  title:      string
  content:    string
  created_at: string
  updated_at: string
}

export const NOTICE_PAGE_SIZE = 10

export async function fetchNotices(from: number): Promise<Notice[]> {
  const { data, error } = await supabase
    .from('notices')
    .select('id, title, content, created_at, updated_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .range(from, from + NOTICE_PAGE_SIZE - 1)
  if (error) throw new Error(error.message)
  return data ?? []
}

// =========================================================
// 카테고리 메타데이터 — 자바의 enum Category { 정치, 경제, ... }와 유사
// id: -1이면 '홈(전체)' 탭
// =========================================================
export const CATEGORIES = [
  { id: -1, label: '홈' },
  { id: 0,  label: '정치' },
  { id: 1,  label: '경제' },
  { id: 2,  label: '사회' },
  { id: 3,  label: '세계' },
  { id: -2, label: '외신보도' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

// 카테고리별 색상 스타일 맵 — 자바의 Map<Integer, CategoryStyle> 와 동일
export const CATEGORY_STYLE: Record<number, { badge: string; dot: string }> = {
  0: { badge: 'bg-red-50 text-red-600 border border-red-200',            dot: 'bg-red-500' },
  1: { badge: 'bg-emerald-50 text-emerald-600 border border-emerald-200', dot: 'bg-emerald-500' },
  2: { badge: 'bg-amber-50 text-amber-600 border border-amber-200',       dot: 'bg-amber-500' },
  3: { badge: 'bg-violet-50 text-violet-600 border border-violet-200',    dot: 'bg-violet-500' },
}
