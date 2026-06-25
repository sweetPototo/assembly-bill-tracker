'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import CalendarPicker from './CalendarPicker'

interface WeeklyDatePickerProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
const WINDOW_SIZE = 7

// KST 날짜 문자열 (YYYY-MM-DD) — 서버·클라이언트 모두 동일
const toKSTDateStr = (d: Date) =>
  d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

// KST 기준 날짜의 UTC 자정 Date 반환
// new Date("YYYY-MM-DD") = UTC 자정 → toISOString()이 서버·클라이언트에서 완전히 동일
// → key prop 불일치(hydration mismatch)와 이에 따른 이벤트 핸들러 미등록 문제 해소
const toUTCMidnight = (d: Date): Date => new Date(toKSTDateStr(d))

const isSameDay = (a: Date, b: Date) => toKSTDateStr(a) === toKSTDateStr(b)

export default function WeeklyDatePicker({ selectedDate, onDateChange }: WeeklyDatePickerProps) {
  const today = toUTCMidnight(new Date())
  const [calendarOpen, setCalendarOpen] = useState(false)

  // 윈도우 오른쪽 끝: selectedDate + 3일, 오늘을 넘으면 오늘로 고정
  const ideal = new Date(toUTCMidnight(selectedDate))
  ideal.setUTCDate(ideal.getUTCDate() + Math.floor(WINDOW_SIZE / 2))
  const windowEnd = ideal > today ? today : ideal

  // 윈도우 왼쪽 끝: 오른쪽 끝에서 6일 전
  const windowStart = new Date(windowEnd)
  windowStart.setUTCDate(windowStart.getUTCDate() - (WINDOW_SIZE - 1))

  // 7개 UTC 자정 Date → key(toISOString())가 서버·클라이언트에서 동일 → hydration 일치
  const days: Date[] = Array.from({ length: WINDOW_SIZE }, (_, i) => {
    const d = new Date(windowStart)
    d.setUTCDate(d.getUTCDate() + i)
    return d
  })

  const shiftDay = (delta: -1 | 1) => {
    const next = toUTCMidnight(selectedDate)
    next.setUTCDate(next.getUTCDate() + delta)
    if (next <= today) onDateChange(next)
  }

  return (
    <div className="flex justify-center items-center py-2">

      {/* ← 이전 날짜 */}
      <button
        onClick={() => shiftDay(-1)}
        aria-label="이전 날짜"
        className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* 7일 윈도우 */}
      <div className="flex gap-1">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate)
          const isToday    = isSameDay(day, today)

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateChange(toUTCMidnight(day))}
              className={`flex flex-col items-center justify-center w-9 h-12 sm:w-11 sm:h-14 rounded-xl transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : isToday
                  ? 'bg-slate-800 text-blue-400 ring-1 ring-blue-500/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {/* getUTCDay/Date 사용 → 서버·클라이언트 렌더 내용 동일 */}
              <span className="text-xs font-medium leading-none">
                {DAY_NAMES[day.getUTCDay()]}
              </span>
              <span className="text-lg font-bold leading-none mt-1">
                {day.getUTCDate()}
              </span>
            </button>
          )
        })}
      </div>

      {/* → 다음 날짜 */}
      <button
        onClick={() => shiftDay(1)}
        disabled={isSameDay(selectedDate, today)}
        aria-label="다음 날짜"
        className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* 달력 버튼 + 팝업 */}
      <div className="relative ml-1">
        <button
          onClick={() => setCalendarOpen(o => !o)}
          aria-label="달력으로 날짜 선택"
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
            calendarOpen
              ? 'bg-slate-700 text-slate-100'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
          }`}
        >
          <CalendarDays className="w-5 h-5" />
        </button>

        {calendarOpen && (
          <CalendarPicker
            selectedDate={selectedDate}
            onDateChange={onDateChange}
            onClose={() => setCalendarOpen(false)}
          />
        )}
      </div>

    </div>
  )
}
