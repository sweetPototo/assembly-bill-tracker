'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/admin/feedback', label: '받은 피드백' },
  { href: '/admin/reports',  label: '오류 신고' },
  { href: '/admin/notices',  label: '공지사항' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (pathname === '/admin/login') {
      setChecking(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/admin/login')
      else setChecking(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session && pathname !== '/admin/login') router.replace('/admin/login')
    })
    return () => subscription.unsubscribe()
  }, [pathname, router])

  if (pathname === '/admin/login') return <>{children}</>
  if (checking) return (
    <div className="min-h-screen flex items-center justify-center text-sm text-slate-400">
      확인 중...
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-12 flex items-center gap-6">
        <span className="text-sm font-bold text-slate-700 flex-shrink-0">짧은 국회 관리자</span>
        <nav className="flex gap-1">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={async () => { await supabase.auth.signOut(); router.replace('/admin/login') }}
          className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          로그아웃
        </button>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
