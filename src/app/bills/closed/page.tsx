import BillList from '@/components/BillList'

export default async function BillsClosedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  return (
    <main className="max-w-3xl mx-auto px-4 pt-[116px] pb-16">
      <h1 className="text-xl font-bold text-slate-800 mb-4">종료된 법</h1>
      <BillList filter="closed" initialSearch={params} />
    </main>
  )
}
