'use client'

import { useEffect } from 'react'

export default function ViewTracker({ billId }: { billId: string }) {
  useEffect(() => {
    fetch(`/api/bills/${billId}/view`, { method: 'POST' })
  }, [billId])
  return null
}
