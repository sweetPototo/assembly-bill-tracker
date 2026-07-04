'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const BILL_NAV = [
  { href: '/bills',        label: '홈' },
  { href: '/bills/all',    label: '전체 발의안' },
  { href: '/bills/active', label: '진행중인 법' },
  { href: '/bills/closed', label: '종료된 법' },
  { href: '/notices',      label: '공지사항' },
]

export default function TopNav() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4">

        <div className="flex items-center h-[52px]">
          <Link
            href="/bills"
            className="text-blue-600 font-extrabold text-xl tracking-tight hover:text-blue-500 transition-colors py-2"
          >
            짧은 국회
          </Link>
        </div>

        <nav className="flex overflow-x-auto scrollbar-hide gap-1 pb-2">
          {BILL_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-shrink-0 px-4 h-11 flex items-center rounded-full text-sm font-semibold transition-all active:scale-95 ${
                isActive(item.href)
                  ? 'bg-blue-400 text-white shadow-md shadow-blue-400/30'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

      </div>
    </header>
  )
}
