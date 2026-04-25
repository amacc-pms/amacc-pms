'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function RevenueDashboard() {
  const [revenueData, setRevenueData] = useState([])
  const [staffSummary, setStaffSummary] = useState([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !['ceo'].includes(prof.role)) { router.push('/'); return }
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(currentMonth)
    await loadRevenue()
  }

  async function loadRevenue() {
    const { data, error } = await supabase
      .from('revenue_attribution_view')
      .select('*')
      .order('assigned_at', { ascending: false })

    if (error) { console.error(error); return }

    setRevenueData(data || [])

    // Kira summary per staff
    const summary = {}
    data?.forEach(row => {
      // Exec
      if (row.exec_id && row.exec_earned_revenue > 0) {
        if (!summary[row.exec_id]) summary[row.exec_id] = { name: row.exec_name, exec_revenue: 0, reviewer_revenue: 0, de_revenue: 0, total: 0, jobs: new Set() }
        summary[row.exec_id].exec_revenue += Number(row.exec_earned_revenue || 0)
        summary[row.exec_id].jobs.add(row.job_id)
      }
      // Reviewer
      if (row.reviewer_id && row.reviewer_earned_revenue > 0) {
        if (!summary[row.reviewer_id]) summary[row.reviewer_id] = { name: row.reviewer_name, exec_revenue: 0, reviewer_revenue: 0, de_revenue: 0, total: 0, jobs: new Set() }
        summary[row.reviewer_id].reviewer_revenue += Number(row.reviewer_earned_revenue || 0)
        summary[row.reviewer_id].jobs.add(row.job_id)
      }
    })

    // Kira total
    Object.keys(summary).forEach(id => {
      summary[id].total = summary[id].exec_revenue + summary[id].reviewer_revenue + summary[id].de_revenue
      summary[id].job_count = summary[id].jobs.size
    })

    // Sort by total revenue
    const sortedSummary = Object.entries(summary)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total)

    setStaffSummary(sortedSummary)
    setLoading(false)
  }

  function getMonthOptions() {
    const months = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' })
      months.push({ value, label })
    }
    return months
  }

  const totalEarned = staffSummary.reduce((sum, s) => sum + s.total, 0)

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-500">Loading...</div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-700 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <div className="font-bold text-lg">AMACC PMS</div>
          <div className="text-sm opacity-80">Revenue Attribution</div>
        </div>
        <button onClick={() => router.push('/dashboard/ceo')} className="bg-white text-blue-700 px-3 py-1 rounded text-sm font-medium">← Balik</button>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">💰 Revenue Attribution — Earned</h1>
        <p className="text-sm text-gray-500 mb-6">Kiraan berdasarkan bilangan hari pegang job (daily proration). Revenue "Realised" bila job selesai.</p>

        {/* Total Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Total Earned (Semua Staff)</div>
            <div className="text-2xl font-bold text-green-600">RM {totalEarned.toLocaleString('ms-MY', {minimumFractionDigits: 2})}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Bilangan Staff</div>
            <div className="text-2xl font-bold text-blue-600">{staffSummary.length}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Bilangan Jobs</div>
            <div className="text-2xl font-bold text-purple-600">{revenueData.length}</div>
          </div>
        </div>

        {/* Staff Revenue Summary */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h2 className="font-semibold text-gray-700">📊 Summary Revenue Per Staff</h2>
          </div>
          {staffSummary.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Tiada data revenue lagi</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 text-gray-600">Staff</th>
                  <th className="text-right px-4 py-3 text-gray-600">Exec Revenue (80/75%)</th>
                  <th className="text-right px-4 py-3 text-gray-600">Reviewer Revenue (20%)</th>
                  <th className="text-right px-4 py-3 text-gray-600">Bilangan Jobs</th>
                  <th className="text-right px-4 py-3 text-gray-600 font-bold">Total Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffSummary.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="px-4 py-3 text-right text-blue-600">
                      {s.exec_revenue > 0 ? `RM ${s.exec_revenue.toLocaleString('ms-MY', {minimumFractionDigits: 2})}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-purple-600">
                      {s.reviewer_revenue > 0 ? `RM ${s.reviewer_revenue.toLocaleString('ms-MY', {minimumFractionDigits: 2})}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">{s.job_count}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">
                      RM {s.total.toLocaleString('ms-MY', {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail per Job */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h2 className="font-semibold text-gray-700">📋 Detail Revenue Per Job</h2>
          </div>
          {revenueData.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Tiada data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-4 py-3 text-gray-600">Klien / Job</th>
                    <th className="text-left px-4 py-3 text-gray-600">Exec</th>
                    <th className="text-right px-4 py-3 text-gray-600">Hari Pegang</th>
                    <th className="text-right px-4 py-3 text-gray-600">Total Hari Job</th>
                    <th className="text-right px-4 py-3 text-gray-600">Exec Earned</th>
                    <th className="text-right px-4 py-3 text-gray-600">Reviewer Earned</th>
                    <th className="text-left px-4 py-3 text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {revenueData.map(row => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.company_name}</div>
                        <div className="text-xs text-gray-500">{row.invoice_number} • {row.service_type}</div>
                        <div className="text-xs text-green-600">RM {Number(row.invoice_value).toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-3 text-blue-600">{row.exec_name}</td>
                      <td className="px-4 py-3 text-right">{row.days_held} hari</td>
                      <td className="px-4 py-3 text-right">{row.total_job_days} hari</td>
                      <td className="px-4 py-3 text-right font-medium text-blue-600">
                        RM {Number(row.exec_earned_revenue || 0).toLocaleString('ms-MY', {minimumFractionDigits: 2})}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-purple-600">
                        RM {Number(row.reviewer_earned_revenue || 0).toLocaleString('ms-MY', {minimumFractionDigits: 2})}
                      </td>
                      <td className="px-4 py-3">
                        {row.ended_at
                          ? <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">Tamat</span>
                          : <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Aktif</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}