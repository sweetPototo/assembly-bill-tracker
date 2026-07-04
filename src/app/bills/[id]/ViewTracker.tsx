'use client'

import { useEffect } from 'react'

export default function ViewTracker({ billId }: { billId: string }) {
  useEffect(() => {
    const key = `viewed_bill_${billId}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    fetch(`/api/bills/${billId}/view`, { method: 'POST' })
  }, [billId])
  return null
}
