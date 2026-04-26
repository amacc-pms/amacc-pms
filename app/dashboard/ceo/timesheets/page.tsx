'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function CEOTimesheets() {
  const [timesheets, setTimesheets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const router = useRouter()

  useEffect(() => {
    fetchTimesheets()
  }, [selectedMonth, selectedYear])

  async function fetchTimesheets() {
    setLoading(true)
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-31`

    const { data } = await supabase
      .from('timesheets')
      .select(`
        *,
        profiles(full_name, role),
        jobs(invoice_number, clients(company_name))
      `)
      .gte('log_date', startDate)
      .lte('log_date', endDate)
      .order('log_date', { ascending: false })

    setTimesheets(data || [])
    setLoading(false)
  }

  const months = ['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis']

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">AMACC PMS</h1>
          <p className="text-blue-200 text-sm">CEO — Timesheet Monitor</p>
        </div>
        <button onClick={() => router.push('/dashboard/ceo')} className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-medium">
          ← Balik
        </button>
      </div>

      <div className="p-6">
        <div className="flex gap-4 mb-6">
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
            {months.map((m, i) => (<option key={i} value={i + 1}>{m}</option>))}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
            <option value={2024}>2024</option>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : timesheets.length === 0 ? (
          <p className="text-gray-500">Tiada timesheet untuk bulan ini.</p>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tarikh</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Staff</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Job</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Jam</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {timesheets.map((ts: any) => (
                  <tr key={ts.id}>
                    <td className="px-4 py-3">{ts.log_date}</td>
                    <td className="px-4 py-3 font-medium">{ts.profiles?.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{ts.jobs?.clients?.company_name} — {ts.jobs?.invoice_number}</td>
                    <td className="px-4 py-3 font-bold text-blue-600">{ts.hours_logged}j</td>
                    <td className="px-4 py-3">{ts.status}</td>
                    <td className="px-4 py-3 text-gray-500">{ts.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}