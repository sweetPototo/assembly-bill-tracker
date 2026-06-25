'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserCircle } from 'lucide-react'
import { CATEGORIES } from '@/lib/supabase'

const categoryHref = (id: number) => {
  if (id === -1) return '/'
  if (id === -2) return '/foreign'
  return `/category/${id}`
}

export default function TopNav() {
  const pathname = usePathname()

  const isActive = (id: number) => {
    if (id === -1) return pathname === '/'
    if (id === -2) return pathname === '/foreign'
    return pathname === `/category/${id}`
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950 border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4">

        <div className="flex items-center justify-between h-[48px]">
          <Link
            href="/"
            className="text-blue-400 font-extrabold text-xl tracking-tight hover:text-blue-300 transition-colors"
          >
            3줄 신문
          </Link>
          <button aria-label="마이페이지" className="text-slate-400 hover:text-slate-100 transition-colors">
            <UserCircle className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex overflow-x-auto scrollbar-hide gap-1 h-[52px] items-center">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={categoryHref(cat.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                isActive(cat.id)
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </Link>
          ))}
          <button className="flex-shrink-0 ml-auto px-4 py-1.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors">
            마이페이지
          </button>
        </nav>

      </div>
    </header>
  )
}
