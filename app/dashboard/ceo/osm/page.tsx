'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function CEOOsm() {
  const [osms, setOsms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchOsms()
  }, [])

  async function fetchOsms() {
    setLoading(true)
    const { data } = await supabase
      .from('osm')
      .select(`
        *,
        jobs(invoice_number, clients(company_name)),
        profiles(full_name)
      `)
      .order('created_at', { ascending: false })

    setOsms(data || [])
    setLoading(false)
  }

  const statusColor = (status: string) => {
    if (status === 'completed') return 'bg-green-100 text-green-700'
    if (status === 'in_progress') return 'bg-blue-100 text-blue-700'
    return 'bg-yellow-100 text-yellow-700'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">AMACC PMS</h1>
          <p className="text-blue-200 text-sm">CEO — Outstanding Matters</p>
        </div>
        <button onClick={() => router.push('/dashboard/ceo')} className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-medium">
          ← Balik
        </button>
      </div>

      <div className="p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Semua OSM ({osms.length})</h2>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : osms.length === 0 ? (
          <p className="text-gray-500">Tiada OSM.</p>
        ) : (
          <div className="space-y-3">
            {osms.map((osm: any) => (
              <div key={osm.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-800">{osm.jobs?.clients?.company_name} — {osm.jobs?.invoice_number}</p>
                    <p className="text-sm text-gray-600 mt-1">{osm.title}</p>
                    <p className="text-sm text-gray-500 mt-1">Staff: {osm.profiles?.full_name}</p>
                    {osm.due_date && <p className="text-sm text-red-500 mt-1">Due: {osm.due_date}</p>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor(osm.status)}`}>
                    {osm.status}
                  </span>
                </div>
                {osm.notes && <p className="text-sm text-gray-500 mt-2 border-t pt-2">{osm.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}