import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import TopNav from '@/components/TopNav'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: '짧은 신문',
  description: '바쁜 일상 속 우리의 권리를 지키는 짧은 시국 뉴스',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90' font-weight='bold' fill='%2360a5fa'>3</text></svg>",
  },
}

// RootLayout — 자바의 BaseController 또는 모든 페이지에 공통 적용되는 레이아웃 컴포넌트
// Next.js App Router에서 이 파일은 모든 페이지를 감싸는 HTML 껍데기 역할을 합니다.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${inter.className} antialiased bg-white text-slate-900 min-h-screen`}>
        <TopNav />
        {children}
      </body>
    </html>
  )
}
