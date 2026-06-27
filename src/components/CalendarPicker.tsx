'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface CalendarPickerProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
  onClose: () => void
}

const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const DAY_NAMES   = ['일','월','화','수','목','금','토']

const midnight = (d: Date) => {
  const c = new Date(d); c.setHours(0,0,0,0); return c
}

// "YYYY-MM-DD" 키 생성 — 날짜 비교용
const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth()    &&
  a.getDate()     === b.getDate()

export default function CalendarPicker({ selectedDate, onDateChange, onClose }: CalendarPickerProps) {
  const today = midnight(new Date())

  // 현재 보고 있는 달 (1일 기준 Date)
  // 자바의 YearMonth 개념과 동일
  const [viewMonth, setViewMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  )

  // 기사가 있는 날짜 키 집합 — 자바의 Set<String> activeDates와 동일
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set())
  const [fetching, setFetching]       = useState(false)
  const [ready, setReady]             = useState(false)  // 첫 조회 완료 여부

  const panelRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 또는 ESC 키로 닫기
  const handleClose = useCallback(onClose, [onClose])
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) handleClose()
    }
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [handleClose])

  // viewMonth가 바뀔 때마다 해당 월의 기사 날짜 조회
  // 자바의 @Service.getActiveDates(YearMonth)와 동일
  useEffect(() => {
    const fetch = async () => {
      setFetching(true)
      const year  = viewMonth.getFullYear()
      const month = viewMonth.getMonth()
      const start = new Date(year, month, 1)
      const end   = new Date(year, month + 1, 0, 23, 59, 59, 999)

      const { data } = await supabase
        .from('articles')
        .select('published_at')
        .gte('published_at', start.toISOString())
        .lte('published_at', end.toISOString())

      if (data) {
        setActiveDates(new Set(data.map(r => toKey(new Date(r.published_at)))))
      }
      setFetching(false)
      setReady(true)
    }
    fetch()
  }, [viewMonth])

  // 캘린더 그리드 셀 생성
  // null = 이전/다음 달 빈 칸, Date = 해당 날짜
  const year        = viewMonth.getFullYear()
  const month       = viewMonth.getMonth()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth    = new Date(year, month + 1, 0).getDate()

  const cells: (Date | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const canGoNextMonth = new Date(year, month + 1, 1) <= today

  return (
    // 패널: 달력 버튼 기준 오른쪽 아래에 absolute 위치
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 z-50 w-72 bg-slate-50 border border-slate-200 rounded-2xl shadow-2xl shadow-black/60 p-4"
    >
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewMonth(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-900">
          {year}년 {MONTH_NAMES[month]}
          {ready && fetching && <span className="ml-2 text-xs text-slate-500">…</span>}
        </span>
        <button
          onClick={() => setViewMonth(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
          disabled={!canGoNextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {!ready ? (
        /* 첫 조회 완료 전 — 달력 크기를 미리 확보해 팝업이 갑자기 커지는 것을 방지 */
        <div className="h-48 flex items-center justify-center">
          <span className="text-slate-500 text-sm">불러오는 중…</span>
        </div>
      ) : (
        <>
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-xs text-slate-500 font-medium py-1">{d}</div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />

              const key        = toKey(day)
              const isSelected = isSameDay(day, selectedDate)
              const isToday    = isSameDay(day, today)
              const isFuture   = day > today
              // 월 이동 중 재조회 시엔 비활성 처리 안 함 (깜박임 방지)
              const isDisabled = isFuture || (!fetching && !activeDates.has(key))

              return (
                <button
                  key={key}
                  disabled={isDisabled}
                  onClick={() => { onDateChange(midnight(day)); onClose() }}
                  className={[
                    'flex items-center justify-center h-8 w-full rounded-lg text-sm font-medium transition-colors',
                    isSelected   ? 'bg-blue-400 text-white'                                  : '',
                    !isSelected && isToday ? 'text-blue-600 ring-1 ring-blue-500/40'    : '',
                    !isSelected && !isToday && !isDisabled ? 'text-slate-700 hover:bg-slate-100' : '',
                    isDisabled   ? 'text-slate-700 cursor-not-allowed'                   : '',
                  ].join(' ')}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
