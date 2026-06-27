import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
