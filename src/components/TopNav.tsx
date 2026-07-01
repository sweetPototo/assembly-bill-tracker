'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserCircle } from 'lucide-react'

const BILL_NAV = [
  { href: '/bills',        label: '발의안 홈' },
  { href: '/bills/active', label: '진행중인 법' },
  { href: '/bills/closed', label: '종료된 법' },
]

export default function TopNav() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4">

        <div className="flex items-center justify-between h-[48px]">
          <Link
            href="/bills"
            className="text-blue-600 font-extrabold text-xl tracking-tight hover:text-blue-500 transition-colors"
          >
            짧은 신문
          </Link>
          <button aria-label="마이페이지" className="text-slate-500 hover:text-slate-900 transition-colors">
            <UserCircle className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex overflow-x-auto scrollbar-hide gap-1 h-[52px] items-center">
          {BILL_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
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
