import BillList from '@/components/BillList'

export default function BillsAllPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 pt-[116px] pb-16">
      <h1 className="text-xl font-bold text-slate-800 mb-4">전체 발의안</h1>
      <BillList filter="all" />
    </main>
  )
}
