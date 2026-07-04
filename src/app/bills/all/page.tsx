import BillList from '@/components/BillList'

export default async function BillsAllPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  return (
    <main className="max-w-3xl mx-auto px-4 pt-[116px] pb-16">
      <h1 className="text-xl font-bold text-slate-800 mb-4">전체 발의안</h1>
      <BillList filter="all" initialSearch={params} />
    </main>
  )
}
