'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AssignmentHistory() {
  const [history, setHistory] = useState([])
  const [monthlyHistory, setMonthlyHistory] = useState([])
  const [jobs, setJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [activeTab, setActiveTab] = useState('monthly')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !['hoo', 'ceo'].includes(prof.role)) { router.push('/'); return }
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setSelectedMonth(currentMonth)
    await loadJobs()
    await loadMonthlyHistory(currentMonth)
  }

  async function loadJobs() {
    const { data } = await supabase
      .from('jobs')
      .select('id, invoice_number, service_type, clients(company_name)')
      .order('created_at', { ascending: false })
    setJobs(data || [])
    setLoading(false)
  }

  async function loadHistory(jobId) {
    setSelectedJob(jobId)
    const { data } = await supabase
      .from('job_assignment_history')
      .select('*')
      .eq('job_id', jobId)
      .order('assigned_at', { ascending: false })
    setHistory(data || [])
  }

  async function loadMonthlyHistory(month) {
    setSelectedMonth(month)
    const { data } = await supabase
      .from('job_assignment_history')
      .select(`*, jobs(invoice_number, service_type, invoice_value, clients(company_name))`)
      .eq('month_year', month)
      .order('assigned_at', { ascending: false })
    setMonthlyHistory(data || [])
  }

  // Generate senarai bulan untuk dropdown (12 bulan kebelakang)
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

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-500">Loading...</div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-orange-500 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <div className="font-bold text-lg">AMACC PMS</div>
          <div className="text-sm opacity-80">Assignment History</div>
        </div>
        <button onClick={() => router.push('/dashboard/hoo')} className="bg-white text-orange-500 px-3 py-1 rounded text-sm font-medium">← Balik</button>
      </nav>

      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">📋 History Assignment Staff</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${activeTab === 'monthly' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border'}`}
          >
            📅 Semua Perubahan Bulan Ini
          </button>
          <button
            onClick={() => setActiveTab('byjob')}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${activeTab === 'byjob' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border'}`}
          >
            🔍 Cari by Job
          </button>
        </div>

        {/* Tab 1 — Monthly View */}
        {activeTab === 'monthly' && (
          <div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Bulan:</label>
              <select
                value={selectedMonth}
                onChange={e => loadMonthlyHistory(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {getMonthOptions().map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b flex justify-between items-center">
                <h2 className="font-semibold text-gray-700">Perubahan Assignment — {selectedMonth}</h2>
                <span className="text-sm text-gray-500">{monthlyHistory.length} rekod</span>
              </div>

              {monthlyHistory.length === 0 ? (
                <div className="p-8 text-center text-gray-400">Tiada perubahan assignment pada bulan ini</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-4 py-3 text-gray-600">Klien / Job</th>
                        <th className="text-left px-4 py-3 text-gray-600">Exec Baru</th>
                        <th className="text-left px-4 py-3 text-gray-600">Reviewer</th>
                        <th className="text-left px-4 py-3 text-gray-600">Data Entry</th>
                        <th className="text-left px-4 py-3 text-gray-600">Tarikh Tukar</th>
                        <th className="text-left px-4 py-3 text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {monthlyHistory.map(h => (
                        <tr key={h.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{h.jobs?.clients?.company_name}</div>
                            <div className="text-xs text-gray-500">{h.jobs?.invoice_number} • {h.jobs?.service_type}</div>
                            <div className="text-xs text-green-600 font-medium">RM {Number(h.jobs?.invoice_value || 0).toLocaleString()}</div>
                          </td>
                          <td className="px-4 py-3 text-blue-600 font-medium">{h.exec_name || '-'}</td>
                          <td className="px-4 py-3">{h.reviewer_name || '-'}</td>
                          <td className="px-4 py-3">{h.data_entry_name || '-'}</td>
                          <td className="px-4 py-3 text-gray-500">{new Date(h.assigned_at).toLocaleDateString('ms-MY')}</td>
                          <td className="px-4 py-3">
                            {h.ended_at
                              ? <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">Tamat</span>
                              : <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Aktif</span>
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
        )}

        {/* Tab 2 — By Job */}
        {activeTab === 'byjob' && (
          <div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Job:</label>
              <select
                value={selectedJob}
                onChange={e => loadHistory(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">-- Pilih Job --</option>
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.clients?.company_name} — {job.invoice_number} ({job.service_type})
                  </option>
                ))}
              </select>
            </div>

            {selectedJob && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <h2 className="font-semibold text-gray-700">History Lengkap Job Ini</h2>
                </div>
                {history.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">Tiada history untuk job ini</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-4 py-3 text-gray-600">Bulan</th>
                        <th className="text-left px-4 py-3 text-gray-600">Exec</th>
                        <th className="text-left px-4 py-3 text-gray-600">Reviewer</th>
                        <th className="text-left px-4 py-3 text-gray-600">Data Entry</th>
                        <th className="text-left px-4 py-3 text-gray-600">Mula</th>
                        <th className="text-left px-4 py-3 text-gray-600">Tamat</th>
                        <th className="text-left px-4 py-3 text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {history.map(h => (
                        <tr key={h.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{h.month_year}</td>
                          <td className="px-4 py-3 text-blue-600 font-medium">{h.exec_name || '-'}</td>
                          <td className="px-4 py-3">{h.reviewer_name || '-'}</td>
                          <td className="px-4 py-3">{h.data_entry_name || '-'}</td>
                          <td className="px-4 py-3 text-gray-500">{new Date(h.assigned_at).toLocaleDateString('ms-MY')}</td>
                          <td className="px-4 py-3 text-gray-500">{h.ended_at ? new Date(h.ended_at).toLocaleDateString('ms-MY') : '-'}</td>
                          <td className="px-4 py-3">
                            {h.ended_at
                              ? <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">Tamat</span>
                              : <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Aktif</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}