import { useState, useEffect, useCallback } from 'react'
import supabase from '../lib/supabase'

/**
 * Fetches all price sheets joined with item and city names from Supabase.
 * Transforms results into a Record<string, PriceEntry[]> keyed by city_id,
 * with each city's entries sorted alphabetically by item name.
 *
 * @returns {{ data: Record<string, { itemName: string, price: number }[]>|null, loading: boolean, error: string|null, refetch: () => void }}
 *
 * Validates: Requirements 5.2, 4.2
 */
export function usePriceSheets() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPriceSheets = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: sheets, error: fetchError } = await supabase
      .from('price_sheets')
      .select('*, items(name), cities(name)')

    if (fetchError) {
      setError(fetchError.message)
    } else {
      // Group by city_id and transform into PriceEntry objects
      const byCityId = {}

      for (const sheet of sheets) {
        const cityId = sheet.city_id
        if (!byCityId[cityId]) {
          byCityId[cityId] = []
        }
        byCityId[cityId].push({
          itemName: sheet.items?.name ?? '',
          price: sheet.price,
        })
      }

      // Sort each city's entries alphabetically by item name
      for (const cityId of Object.keys(byCityId)) {
        byCityId[cityId].sort((a, b) => a.itemName.localeCompare(b.itemName))
      }

      setData(byCityId)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchPriceSheets()
  }, [fetchPriceSheets])

  return { data, loading, error, refetch: fetchPriceSheets }
}
