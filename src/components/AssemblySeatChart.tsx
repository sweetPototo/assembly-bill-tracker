'use client'

import { useState, useMemo } from 'react'
import type { AssemblySeat } from '@/lib/supabase'

const PARTY_COLOR: Record<string, string> = {
  '더불어민주당': '#004EA2',
  '국민의힘':    '#C9151E',
  '조국혁신당':  '#06275E',
  '진보당':     '#D6001C',
  '개혁신당':   '#FF7210',
  '기본소득당':  '#00D2C3',
  '사회민주당':  '#F58400',
  '무소속':     '#94A3B8',
}

// 반원 파라미터
const CX      = 92    // 반원 중심 x
const CY      = 85    // 반원 중심 y (하단)
const R_START = 46    // 첫 번째(가장 안쪽) 행 반지름
const R_STEP  = 6     // 행 간격 (이전 11의 절반)
const N_ROWS  = 7     // 행 수
const SEAT_W  = 4.2   // 의석 사각형 한 변 크기 (이전 2.8의 1.5배)
const SEAT_RX = 0.8   // 모서리 둥글기

type SeatPos = {
  x:     number
  y:     number
  angle: number
  color: string
  party: string
}

function buildHemicycle(seats: AssemblySeat[]): {
  positions: SeatPos[]
  parties:   AssemblySeat[]
} {
  const parties = seats
    .filter(s => s.poly_nm !== '합계' && (s.sum ?? 0) > 0)
    .sort((a, b) => (b.sum ?? 0) - (a.sum ?? 0))

  const total  = parties.reduce((acc, s) => acc + (s.sum ?? 0), 0)
  const radii  = Array.from({ length: N_ROWS }, (_, i) => R_START + i * R_STEP)
  const totalR = radii.reduce((a, r) => a + r, 0)

  // 행별 의석수 = 반지름에 비례 (비율이 같아 행마다 의석 간격이 균일)
  const seatsPerRow = radii.map(r => Math.round(total * r / totalR))
  const diff = total - seatsPerRow.reduce((a, n) => a + n, 0)
  seatsPerRow[seatsPerRow.length - 1] += diff   // 반올림 오차 보정

  // 의석 위치 계산 (각도 0 = 왼쪽, π = 오른쪽)
  const positions: SeatPos[] = []
  for (let row = 0; row < N_ROWS; row++) {
    const r = radii[row]
    const n = seatsPerRow[row]
    for (let k = 0; k < n; k++) {
      const angle = (k + 0.5) * Math.PI / n
      positions.push({
        x:     CX - r * Math.cos(angle),
        y:     CY - r * Math.sin(angle),
        angle,
        color: '',
        party: '',
      })
    }
  }

  // 각도 순 정렬 → 왼쪽(angle≈0)에서 오른쪽(angle≈π)으로
  positions.sort((a, b) => a.angle - b.angle)

  // 의석수 큰 정당부터 왼쪽을 채워 색상 할당
  let idx = 0
  for (const party of parties) {
    const color = PARTY_COLOR[party.poly_nm ?? ''] ?? '#94A3B8'
    for (let i = 0; i < (party.sum ?? 0); i++) {
      positions[idx].color = color
      positions[idx].party = party.poly_nm ?? ''
      idx++
    }
  }

  return { positions, parties }
}

export default function AssemblySeatChart({ seats }: { seats: AssemblySeat[] }) {
  const [hovered, setHovered] = useState<string | null>(null)
  const { positions, parties } = useMemo(() => buildHemicycle(seats), [seats])
  const hoveredParty = hovered ? parties.find(s => s.poly_nm === hovered) : null

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 flex items-center gap-4">
      {/* 의석 배치도 */}
      <svg
        viewBox="0 0 184 90"
        style={{ width: 270, flexShrink: 0 }}
        aria-label="국회 의석 배치도"
      >
        {positions.map((seat, i) => (
          <rect
            key={i}
            x={seat.x - SEAT_W / 2}
            y={seat.y - SEAT_W / 2}
            width={SEAT_W}
            height={SEAT_W}
            rx={SEAT_RX}
            fill={seat.color}
            opacity={hovered && hovered !== seat.party ? 0.12 : 1}
            style={{ transition: 'opacity 0.12s', cursor: 'pointer' }}
            onMouseEnter={() => setHovered(seat.party)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        {hoveredParty && (
          <>
            <text
              x={CX} y={CY - 9}
              textAnchor="middle"
              style={{ fontSize: '4.5px', fill: '#64748b', fontWeight: 600 }}
            >
              {hoveredParty.poly_nm}
            </text>
            <text
              x={CX} y={CY - 2}
              textAnchor="middle"
              style={{ fontSize: '8px', fill: '#1e293b', fontWeight: 700 }}
            >
              {hoveredParty.sum}석
            </text>
          </>
        )}
      </svg>

      {/* 범례 — 차트 오른쪽 세로 1열 */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        {parties.map(s => (
          <div
            key={s.poly_nm}
            className="flex items-center gap-1 min-w-0"
            onMouseEnter={() => setHovered(s.poly_nm ?? null)}
            onMouseLeave={() => setHovered(null)}
            style={{
              opacity:    hovered && hovered !== s.poly_nm ? 0.25 : 1,
              transition: 'opacity 0.12s',
              cursor:     'default',
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: PARTY_COLOR[s.poly_nm ?? ''] ?? '#ccc' }}
            />
            <span className="text-xs text-slate-700 flex-1 truncate">{s.poly_nm}</span>
            <span className="text-xs font-medium text-slate-400 flex-shrink-0 tabular-nums">
              {s.sum}석
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
