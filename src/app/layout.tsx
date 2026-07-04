import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ConditionalTopNav from '@/components/ConditionalTopNav'
import Footer from '@/components/Footer'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: '짧은 국회',
  description: '바쁜 일상 속 우리의 권리를 지키는 짧은 시국 뉴스',
  icons: {
    icon: '/icon.png',
  },
}

// RootLayout — 자바의 BaseController 또는 모든 페이지에 공통 적용되는 레이아웃 컴포넌트
// Next.js App Router에서 이 파일은 모든 페이지를 감싸는 HTML 껍데기 역할을 합니다.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${inter.className} antialiased bg-white text-slate-900 min-h-screen`}>
        <ConditionalTopNav />
        {children}
        <Footer />
      </body>
    </html>
  )
}
