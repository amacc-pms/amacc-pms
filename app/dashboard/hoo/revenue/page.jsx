'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function HOORevenue() {
  const [profile, setProfile] = useState(null)
  const [revenueData, setRevenueData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [summary, setSummary] = useState({ totalInvoice: 0, totalNet: 0, totalJobs: 0 })
  const router = useRouter()

  const SST_RATE = 0.08

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    if (!profileData || profileData.role !== 'hoo') { router.push('/'); return }
    setProfile(profileData)
    fetchRevenue(profileData.division)
  }

  const fetchRevenue = async (division) => {
    const serviceMap = {
      tax: ['Form C', 'Form B', 'Form E', 'Form TF', 'Form N', 'Form Q', 'Form BE', 'Tax Audit', 'Tax MA', 'CP204', 'Tax Estimation'],
      accounting: ['Account Yearly (Current)', 'Account Yearly (Backlog)', 'Account Monthly', 'Account In Advance', 'Account Dormant', 'Accounts Review'],
      advisory: ['SPC', 'SST Registration', 'Coaching & Training', 'Advisory services']
    }
    const services = serviceMap[division] || []

    const { data: jobs } = await supabase
      .from('jobs')
      .select('*, clients(company_name)')
      .in('service_type', services)
      .order('created_at', { ascending: false })

    if (!jobs) { setLoading(false); return }

    const jobIds = jobs.map(j => j.id)

    const { data: assignments } = await supabase
      .from('job_assignments')
      .select('*')
      .in('job_id', jobIds)

    const { data: staffList } = await supabase
      .from('profiles')
      .select('id, full_name')

    const staffMap = {}
    if (staffList) staffList.forEach(s => { staffMap[s.id] = s.full_name })

    const result = jobs.map(job => {
      const invoiceValue = Number(job.invoice_value) || 0
      const sstAmount = invoiceValue * SST_RATE
      const netRevenue = invoiceValue - sstAmount

      const jobAssignments = (assignments || []).filter(a => a.job_id === job.id)

      const staffRevenue = jobAssignments.map(a => ({
        staff_id: a.staff_id,
        full_name: staffMap[a.staff_id] || '-',
        role: a.role,
        percentage: a.revenue_percentage || 0,
        amount: netRevenue * ((a.revenue_percentage || 0) / 100)
      }))

      return {
        ...job,
        invoiceValue,
        sstAmount,
        netRevenue,
        staffRevenue
      }
    })

    setRevenueData(result)

    const totalInvoice = result.reduce((s, j) => s + j.invoiceValue, 0)
    const totalNet = result.reduce((s, j) => s + j.netRevenue, 0)
    setSummary({ totalInvoice, totalNet, totalJobs: result.length })
    setLoading(false)
  }

  const getStatusBadge = (status) => {
    const badges = { pending: 'bg-yellow-100 text-yellow-700', in_progress: 'bg-blue-100 text-blue-700', review: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700' }
    return badges[status] || 'bg-gray-100 text-gray-700'
  }

  const getStatusLabel = (status) => {
    const labels = { pending: 'Belum Mula', in_progress: 'Sedang Berjalan', review: 'Dalam Semakan', completed: 'Selesai' }
    return labels[status] || status
  }

  const formatRM = (amount) => `RM ${Number(amount).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}`

  const filteredData = filterStatus ? revenueData.filter(j => j.status === filterStatus) : revenueData

  if (!profile) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-orange-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">AMACC PMS</h1>
          <p className="text-orange-200 text-sm">Revenue — {profile.division?.toUpperCase()}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/hoo')}
            className="bg-orange-700 hover:bg-orange-800 px-4 py-2 rounded-lg text-sm">
            ← Balik Dashboard
          </button>
        </div>
      </div>

      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Revenue Attribution</h2>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <p className="text-sm text-gray-500 mb-1">Total Invoice</p>
            <p className="text-2xl font-bold text-gray-800">{formatRM(summary.totalInvoice)}</p>
            <p className="text-xs text-gray-400 mt-1">{summary.totalJobs} job</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <p className="text-sm text-gray-500 mb-1">SST (8%)</p>
            <p className="text-2xl font-bold text-red-500">{formatRM(summary.totalInvoice * SST_RATE)}</p>
            <p className="text-xs text-gray-400 mt-1">Ditolak dari invoice</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <p className="text-sm text-gray-500 mb-1">Net Revenue</p>
            <p className="text-2xl font-bold text-green-600">{formatRM(summary.totalNet)}</p>
            <p className="text-xs text-gray-400 mt-1">Selepas tolak SST</p>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6 flex gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Filter by Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">— Semua Status —</option>
              <option value="pending">Belum Mula</option>
              <option value="in_progress">Sedang Berjalan</option>
              <option value="review">Dalam Semakan</option>
              <option value="completed">Selesai</option>
            </select>
          </div>
          <button onClick={() => setFilterStatus('')}
            className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-200">
            Reset
          </button>
        </div>

        {/* Revenue List */}
        {loading ? <p className="text-gray-500">Loading...</p> : (
          <div className="space-y-4">
            {filteredData.length === 0 && (
              <div className="bg-white rounded-xl border p-8 text-center">
                <p className="text-gray-400">Tiada data revenue.</p>
              </div>
            )}
            {filteredData.map((job) => (
              <div key={job.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {/* Job Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-800">{job.clients?.company_name}</p>
                      <p className="text-sm text-gray-500">{job.invoice_number} • {job.service_type}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(job.status)}`}>
                      {getStatusLabel(job.status)}
                    </span>
                  </div>

                  {/* Revenue Breakdown */}
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Invoice</p>
                      <p className="font-semibold text-gray-800 text-sm">{formatRM(job.invoiceValue)}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-red-400">SST 8%</p>
                      <p className="font-semibold text-red-500 text-sm">- {formatRM(job.sstAmount)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-green-500">Net Revenue</p>
                      <p className="font-semibold text-green-600 text-sm">{formatRM(job.netRevenue)}</p>
                    </div>
                  </div>
                </div>

                {/* Staff Revenue */}
                <div className="p-4">
                  <p className="text-xs font-medium text-gray-600 mb-3">💰 Agihan Revenue Staff</p>
                  {job.staffRevenue.length === 0 ? (
                    <p className="text-sm text-gray-400">Belum ada staff diassign</p>
                  ) : (
                    <div className="space-y-2">
                      {job.staffRevenue.map((sr, i) => (
                        <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-gray-700">{sr.full_name}</p>
                            <p className="text-xs text-gray-400 capitalize">{sr.role} • {sr.percentage}%</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600 text-sm">{formatRM(sr.amount)}</p>
                            <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1">
                              <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${sr.percentage}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}