'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function StaffDashboard() {
  const [profile, setProfile] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [isBlocked, setIsBlocked] = useState(false)
  const [missedDate, setMissedDate] = useState('')
  const [todayLogs, setTodayLogs] = useState({})
  const [notes, setNotes] = useState({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('aktif')
  const [unearnedRevenue, setUnearnedRevenue] = useState({ thisMonth: 0, allTime: 0, missedDays: 0 })
  const [selectedJob, setSelectedJob] = useState(null)
  const [jobDetail, setJobDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusForm, setStatusForm] = useState({ status: '', progress_primary: 0, progress_secondary: 0 })
  const router = useRouter()

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof) { router.push('/'); return }
    if (!['staff', 'hoo', 'ceo'].includes(prof.role)) { router.push('/'); return }
    setProfile(prof)
    await checkHardBlock(prof)
    await loadJobs(prof.id)
    await calculateUnearned(prof.id)
  }

  async function checkHardBlock(prof) {
    const now = new Date()
    const hour = now.getHours()
    if (hour < 10) return
    const { data: activeJobs } = await supabase
      .from('jobs')
      .select('id')
      .or(`assigned_exec.eq.${prof.id},assigned_reviewer.eq.${prof.id},assigned_de.eq.${prof.id}`)
      .not('status', 'eq', 'completed')
      .limit(1)
    if (!activeJobs || activeJobs.length === 0) return
    const { data: yesterdayLog } = await supabase
      .from('timesheets')
      .select('id')
      .eq('staff_id', prof.id)
      .eq('log_date', yesterday)
      .limit(1)
    if (!yesterdayLog || yesterdayLog.length === 0) {
      await supabase.from('profiles').update({
        is_blocked: true,
        blocked_since: new Date().toISOString()
      }).eq('id', prof.id)
      setIsBlocked(true)
      setMissedDate(yesterday)
    }
  }

  async function loadJobs(staffId) {
    const { data } = await supabase
      .from('jobs')
      .select(`*, clients(company_name)`)
      .or(`assigned_exec.eq.${staffId},assigned_reviewer.eq.${staffId},assigned_de.eq.${staffId}`)
      .not('status', 'eq', 'completed')
      .order('due_date')
    setJobs(data || [])
    const { data: logs } = await supabase
      .from('timesheets')
      .select('*')
      .eq('staff_id', staffId)
      .eq('log_date', today)
    const logsMap = {}
    const notesMap = {}
    logs?.forEach(l => {
      logsMap[l.job_id] = l.hours_logged
      notesMap[l.job_id] = l.note || ''
    })
    setTodayLogs(logsMap)
    setNotes(notesMap)
    setLoading(false)
  }

  async function calculateUnearned(staffId) {
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const { data: logs } = await supabase
      .from('timesheets')
      .select('log_date')
      .eq('staff_id', staffId)
      .gte('log_date', firstOfMonth)
    const loggedDates = new Set(logs?.map(l => l.log_date) || [])
    let missedDays = 0
    let d = new Date(firstOfMonth)
    const yesterdayDate = new Date(yesterday)
    while (d <= yesterdayDate) {
      const dateStr = d.toISOString().split('T')[0]
      const day = d.getDay()
      if (day !== 0 && day !== 6 && !loggedDates.has(dateStr)) missedDays++
      d.setDate(d.getDate() + 1)
    }
    const { data: activeJobs } = await supabase
      .from('jobs')
      .select('id, invoice_value, assigned_exec, assigned_reviewer, assigned_de')
      .or(`assigned_exec.eq.${staffId},assigned_reviewer.eq.${staffId},assigned_de.eq.${staffId}`)
      .not('status', 'eq', 'completed')
    let dailyRate = 0
    activeJobs?.forEach(job => {
      const invoiceVal = Number(job.invoice_value || 0)
      const totalJobDays = 30
      if (job.assigned_exec === staffId) {
        const percent = job.assigned_de ? 0.75 : 0.80
        dailyRate += (invoiceVal * percent) / totalJobDays
      }
      if (job.assigned_reviewer === staffId && job.assigned_reviewer !== job.assigned_exec) {
        dailyRate += (invoiceVal * 0.20) / totalJobDays
      }
      if (job.assigned_de === staffId) {
        dailyRate += (invoiceVal * 0.05) / totalJobDays
      }
    })
    const unearnedThisMonth = dailyRate * missedDays
    setUnearnedRevenue({
      thisMonth: activeJobs && activeJobs.length > 0 ? unearnedThisMonth : 0,
      allTime: activeJobs && activeJobs.length > 0 ? unearnedThisMonth : 0,
      missedDays: activeJobs && activeJobs.length > 0 ? missedDays : 0
    })
  }

  async function openJobDetail(job) {
    setSelectedJob(job)
    setLoadingDetail(true)
    setStatusForm({
      status: job.status || 'in_progress',
      progress_primary: job.completion_percentage || 0,
      progress_secondary: job.completion_secondary || 0,
    })

    // Load exec, reviewer, DE profiles + their hours
    const [execRes, reviewerRes, deRes, execHoursRes, reviewerHoursRes, deHoursRes] = await Promise.all([
      job.assigned_exec ? supabase.from('profiles').select('full_name').eq('id', job.assigned_exec).single() : Promise.resolve({ data: null }),
      job.assigned_reviewer ? supabase.from('profiles').select('full_name').eq('id', job.assigned_reviewer).single() : Promise.resolve({ data: null }),
      job.assigned_de ? supabase.from('profiles').select('full_name').eq('id', job.assigned_de).single() : Promise.resolve({ data: null }),
      job.assigned_exec ? supabase.from('timesheets').select('hours_logged').eq('job_id', job.id).eq('staff_id', job.assigned_exec) : Promise.resolve({ data: [] }),
      job.assigned_reviewer ? supabase.from('timesheets').select('hours_logged').eq('job_id', job.id).eq('staff_id', job.assigned_reviewer) : Promise.resolve({ data: [] }),
      job.assigned_de ? supabase.from('timesheets').select('hours_logged').eq('job_id', job.id).eq('staff_id', job.assigned_de) : Promise.resolve({ data: [] }),
    ])

    const sumHours = (data) => (data || []).reduce((sum, r) => sum + Number(r.hours_logged || 0), 0)
    const execHours = sumHours(execHoursRes.data)
    const reviewerHours = sumHours(reviewerHoursRes.data)
    const deHours = sumHours(deHoursRes.data)
    const totalHours = execHours + (job.assigned_reviewer !== job.assigned_exec ? reviewerHours : 0) + deHours

    // Pending client alert level
    let pendingDays = 0
    let pendingLevel = null
    if (job.status === 'pending_client' && job.updated_at) {
      pendingDays = Math.floor((new Date() - new Date(job.updated_at)) / (1000 * 60 * 60 * 24))
      if (pendingDays >= 30) pendingLevel = 'kiv'
      else if (pendingDays >= 14) pendingLevel = 'red'
      else if (pendingDays >= 7) pendingLevel = 'orange'
      else if (pendingDays >= 3) pendingLevel = 'yellow'
    }

    setJobDetail({
      exec: execRes.data?.full_name || '-',
      reviewer: reviewerRes.data?.full_name || '-',
      de: deRes.data?.full_name || '-',
      execHours, reviewerHours, deHours, totalHours,
      pendingDays, pendingLevel,
      isSolo: job.assigned_exec === job.assigned_reviewer,
    })
    setLoadingDetail(false)
  }

  async function updateJobStatus() {
    if (!selectedJob || !profile) return
    setUpdatingStatus(true)
    await supabase.from('jobs').update({
      status: statusForm.status,
      completion_percentage: statusForm.progress_primary,
      updated_at: new Date().toISOString(),
    }).eq('id', selectedJob.id)
    setMessage('✅ Status job berjaya dikemaskini!')
    setSelectedJob(null)
    setJobDetail(null)
    await loadJobs(profile.id)
    setUpdatingStatus(false)
    setTimeout(() => setMessage(''), 3000)
  }

  async function saveTimesheets() {
    if (!profile) return
    setSaving(true)
    for (const job of jobs.filter(j => !['completed','kiv'].includes(j.status))) {
      await supabase.from('timesheets').upsert({
        staff_id: profile.id,
        job_id: job.id,
        log_date: today,
        hours_logged: Number(todayLogs[job.id] || 0),
        note: notes[job.id] || '',
        status: job.status
      }, { onConflict: 'staff_id,job_id,log_date' })
    }
    if (isBlocked) {
      await supabase.from('profiles').update({ is_blocked: false, unblocked_at: new Date().toISOString() }).eq('id', profile.id)
      setIsBlocked(false)
    }
    setMessage('✅ Timesheet berjaya disimpan!')
    setTimeout(() => setMessage(''), 3000)
    setSaving(false)
  }

  const getStatusLabel = (status) => {
    const labels = {
      'not_started': '⚪ Belum Mula',
      'in_progress': '🔵 Dalam Proses',
      'pending_client': '🟡 Pending Client',
      'pending_authority': '🟠 Pending LHDN/Auditor',
      'completed': '✅ Selesai',
      'kiv': '📌 KIV',
    }
    return labels[status] || status
  }

  const getPendingAlert = (level, days) => {
    if (!level) return null
    const configs = {
      yellow: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', label: `⚠️ Pending Client ${days} hari — Follow up segera!` },
      orange: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', label: `🔶 Pending Client ${days} hari — Urgent follow up!` },
      red: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', label: `🚨 Pending Client ${days} hari — Kritikal! Maklumkan HOO!` },
      kiv: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', label: `📌 Pending Client ${days} hari — Akan masuk KIV automatik` },
    }
    const c = configs[level]
    return <div className={`${c.bg} border ${c.border} rounded-lg p-3 mb-3`}><p className={`text-sm font-medium ${c.text}`}>{c.label}</p></div>
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-500">Loading...</div></div>

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Timesheet Belum Dikemaskini!</h1>
          <p className="text-gray-600 mb-2">Awak belum log hours untuk:</p>
          <p className="text-lg font-bold text-red-500 mb-6">{new Date(missedDate).toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div className="bg-red-50 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-red-700 font-medium mb-1">⚠️ Penting:</p>
            <p className="text-sm text-red-600">Log hours semalam sebelum boleh guna sistem. Hubungi HOO jika perlu bantuan.</p>
          </div>
          <button onClick={() => setIsBlocked(false)} className="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 mb-3">
            📝 Log Timesheet Sekarang
          </button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="w-full bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">
            Log Keluar
          </button>
        </div>
      </div>
    )
  }

  const aktifJobs = jobs.filter(j => !['completed','kiv'].includes(j.status))
  const kivJobs = jobs.filter(j => j.status === 'kiv')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <div className="font-bold text-lg">AMACC PMS</div>
          <div className="text-sm opacity-80">Staff Dashboard</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/staff/osm')} className="bg-purple-500 text-white px-3 py-1 rounded text-sm font-medium hover:bg-purple-400">📋 OSM</button>
          <span className="text-sm">{profile?.full_name}</span>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium">Log Keluar</button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800">Selamat Datang, {profile?.full_name}!</h1>
          <p className="text-sm text-gray-500">Hari ini: {new Date().toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg border p-3">
            <div className="text-xs text-gray-500">Jobs Aktif</div>
            <div className="text-2xl font-bold text-blue-600">{aktifJobs.length}</div>
          </div>
          <div className="bg-white rounded-lg border p-3">
            <div className="text-xs text-gray-500">Overdue</div>
            <div className="text-2xl font-bold text-red-500">{jobs.filter(j => j.due_date && new Date(j.due_date) < new Date()).length}</div>
          </div>
          <div className="bg-white rounded-lg border p-3">
            <div className="text-xs text-gray-500">Unearned Bulan Ini</div>
            <div className="text-lg font-bold text-orange-500">RM {unearnedRevenue.thisMonth.toFixed(2)}</div>
            <div className="text-xs text-gray-400">{unearnedRevenue.missedDays} hari tak log</div>
          </div>
          <div className="bg-white rounded-lg border p-3">
            <div className="text-xs text-gray-500">Jam Hari Ini</div>
            <div className="text-lg font-bold text-green-600">{Object.values(todayLogs).reduce((a,b) => a + Number(b), 0)} jam</div>
          </div>
        </div>

        {unearnedRevenue.missedDays > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <p className="text-orange-700 font-medium">⚠️ {unearnedRevenue.missedDays} hari bulan ini tiada timesheet</p>
            <p className="text-orange-600 text-sm">Anggaran revenue tidak dikira: <strong>RM {unearnedRevenue.thisMonth.toFixed(2)}</strong></p>
          </div>
        )}

        {message && <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-green-700">{message}</div>}

        <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveTab('aktif')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'aktif' ? 'bg-blue-500 text-white' : 'bg-white border text-gray-600'}`}>Aktif ({aktifJobs.length})</button>
          <button onClick={() => setActiveTab('timesheet')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'timesheet' ? 'bg-blue-500 text-white' : 'bg-white border text-gray-600'}`}>📝 Log Hari Ini</button>
          <button onClick={() => setActiveTab('kiv')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'kiv' ? 'bg-blue-500 text-white' : 'bg-white border text-gray-600'}`}>KIV ({kivJobs.length})</button>
        </div>

        {activeTab === 'aktif' && (
          <div className="space-y-4">
            {aktifJobs.length === 0
              ? <div className="bg-white rounded-lg border p-8 text-center text-gray-400">Tiada jobs aktif</div>
              : aktifJobs.map(job => (
              <div key={job.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <button
                      onClick={() => openJobDetail(job)}
                      className="font-bold text-blue-600 hover:text-blue-800 hover:underline text-left"
                    >
                      {job.clients?.company_name}
                    </button>
                    <p className="text-sm text-gray-500">{job.invoice_number} • {job.service_type}</p>
                    <p className="text-green-600 font-bold text-sm">RM {Number(job.invoice_value || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500">Due: {job.due_date ? new Date(job.due_date).toLocaleDateString('ms-MY') : '-'}</span>
                    {job.due_date && new Date(job.due_date) < new Date() && <div className="text-xs text-red-500 font-medium">⚠️ OVERDUE</div>}
                    <button
                      onClick={() => openJobDetail(job)}
                      className="mt-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100"
                    >
                      Lihat Detail →
                    </button>
                  </div>
                </div>
                {job.job_description && <div className="bg-gray-50 rounded p-2 text-sm text-gray-600">📋 {job.job_description}</div>}
                {job.status && (
                  <div className="mt-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700">{getStatusLabel(job.status)}</span>
                    {job.completion_percentage > 0 && (
                      <div className="mt-1">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-blue-500 h-1.5 rounded-full" style={{width: `${job.completion_percentage}%`}}></div>
                        </div>
                        <span className="text-xs text-gray-500">{job.completion_percentage}% siap</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'timesheet' && (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-blue-700 text-sm">📝 Update jam untuk job yang awak buat hari ni sahaja. Job lain kekal 0 jam.</p>
            </div>
            <div className="space-y-3">
              {aktifJobs.map(job => (
                <div key={job.id} className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="font-medium text-sm">{job.clients?.company_name}</p>
                      <p className="text-xs text-gray-500">{job.invoice_number} • {job.service_type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" max="12" step="0.5"
                        value={todayLogs[job.id] || 0}
                        onChange={e => setTodayLogs({...todayLogs, [job.id]: e.target.value})}
                        className="w-16 border rounded px-2 py-1 text-center text-sm" />
                      <span className="text-xs text-gray-500">jam</span>
                    </div>
                  </div>
                  {Number(todayLogs[job.id]) > 0 && (
                    <input type="text" placeholder="Nota kerja (optional)"
                      value={notes[job.id] || ''}
                      onChange={e => setNotes({...notes, [job.id]: e.target.value})}
                      className="w-full border rounded px-3 py-1 text-sm mt-1" />
                  )}
                </div>
              ))}
            </div>
            <button onClick={saveTimesheets} disabled={saving}
              className="w-full mt-4 bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50">
              {saving ? 'Menyimpan...' : '💾 Simpan Semua Timesheet'}
            </button>
          </div>
        )}

        {activeTab === 'kiv' && (
          <div className="space-y-3">
            {kivJobs.length === 0
              ? <div className="bg-white rounded-lg border p-8 text-center text-gray-400">Tiada jobs KIV</div>
              : kivJobs.map(job => (
              <div key={job.id} className="bg-white rounded-lg border border-yellow-200 p-4">
                <button onClick={() => openJobDetail(job)} className="font-bold text-blue-600 hover:underline">{job.clients?.company_name}</button>
                <p className="text-sm text-gray-500">{job.invoice_number} • {job.service_type}</p>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">KIV</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* JOB DETAIL MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold">{selectedJob.clients?.company_name}</h2>
                <p className="text-blue-200 text-sm">{selectedJob.invoice_number} • {selectedJob.service_type}</p>
              </div>
              <button onClick={() => { setSelectedJob(null); setJobDetail(null) }} className="text-white hover:text-blue-200 text-2xl leading-none">×</button>
            </div>

            <div className="p-6">
              {/* Job Info */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Invoice Value</p>
                  <p className="font-bold text-green-600">RM {Number(selectedJob.invoice_value || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Due Date</p>
                  <p className="font-medium text-gray-800">{selectedJob.due_date ? new Date(selectedJob.due_date).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</p>
                  {selectedJob.due_date && new Date(selectedJob.due_date) < new Date() && <p className="text-xs text-red-500 font-medium">⚠️ OVERDUE</p>}
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Financial Year End</p>
                  <p className="font-medium text-gray-800">{selectedJob.financial_year_end || '-'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Budgeted Hours</p>
                  <p className="font-medium text-gray-800">{selectedJob.budgeted_hours || '-'} jam</p>
                </div>
              </div>

              {/* Job Description */}
              {selectedJob.job_description && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5">
                  <p className="text-xs text-blue-500 font-medium mb-1">📋 Skop Kerja</p>
                  <p className="text-sm text-blue-800">{selectedJob.job_description}</p>
                </div>
              )}

              {/* Pending Client Alert */}
              {jobDetail && getPendingAlert(jobDetail.pendingLevel, jobDetail.pendingDays)}

              {loadingDetail ? (
                <div className="text-center py-4 text-gray-400">Loading details...</div>
              ) : jobDetail && (
                <>
                  {/* Team & Hours */}
                  <div className="mb-5">
                    <h3 className="font-bold text-gray-700 mb-3">👥 Team & Hours</h3>
                    <div className="space-y-2">
                      {/* Exec */}
                      <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                        <div>
                          <p className="text-xs text-blue-500 font-medium">Exec {jobDetail.isSolo ? '(Solo)' : ''}</p>
                          <p className="font-medium text-gray-800">{jobDetail.exec}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Hours logged</p>
                          <p className="font-bold text-blue-600">{jobDetail.execHours.toFixed(1)} jam</p>
                          <p className="text-xs text-gray-400">{jobDetail.isSolo ? '80%' : '75%'} revenue</p>
                        </div>
                      </div>

                      {/* Reviewer */}
                      {!jobDetail.isSolo && (
                        <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                          <div>
                            <p className="text-xs text-green-500 font-medium">Reviewer</p>
                            <p className="font-medium text-gray-800">{jobDetail.reviewer}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Hours logged</p>
                            <p className="font-bold text-green-600">{jobDetail.reviewerHours.toFixed(1)} jam</p>
                            <p className="text-xs text-gray-400">20% revenue</p>
                          </div>
                        </div>
                      )}

                      {/* DE */}
                      {selectedJob.assigned_de && (
                        <div className="flex items-center justify-between bg-purple-50 rounded-lg p-3">
                          <div>
                            <p className="text-xs text-purple-500 font-medium">Data Entry</p>
                            <p className="font-medium text-gray-800">{jobDetail.de}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">Hours logged</p>
                            <p className="font-bold text-purple-600">{jobDetail.deHours.toFixed(1)} jam</p>
                            <p className="text-xs text-gray-400">5% revenue</p>
                          </div>
                        </div>
                      )}

                      {/* Total */}
                      <div className="flex items-center justify-between bg-gray-100 rounded-lg p-3">
                        <p className="font-medium text-gray-700">Total Hours</p>
                        <div className="text-right">
                          <p className="font-bold text-gray-800">{jobDetail.totalHours.toFixed(1)} jam</p>
                          {selectedJob.budgeted_hours && (
                            <div>
                              <div className="w-24 bg-gray-300 rounded-full h-1.5 mt-1">
                                <div
                                  className={`h-1.5 rounded-full ${jobDetail.totalHours / selectedJob.budgeted_hours > 0.8 ? 'bg-red-500' : 'bg-green-500'}`}
                                  style={{width: `${Math.min(100, (jobDetail.totalHours / selectedJob.budgeted_hours) * 100)}%`}}
                                ></div>
                              </div>
                              <p className="text-xs text-gray-400">{jobDetail.totalHours.toFixed(1)} / {selectedJob.budgeted_hours} jam budget</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Update Status */}
                  <div className="border-t pt-4">
                    <h3 className="font-bold text-gray-700 mb-3">📊 Kemaskini Status</h3>

                    {/* Job Status */}
                    <div className="mb-3">
                      <label className="text-xs text-gray-500 font-medium">Job Status</label>
                      <select
                        value={statusForm.status}
                        onChange={e => setStatusForm({...statusForm, status: e.target.value})}
                        className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="not_started">⚪ Belum Mula</option>
                        <option value="in_progress">🔵 Dalam Proses</option>
                        <option value="pending_client">🟡 Pending Client</option>
                        <option value="pending_authority">🟠 Pending LHDN/Auditor</option>
                        <option value="kiv">📌 KIV</option>
                        <option value="completed">✅ Selesai</option>
                      </select>
                    </div>

                    {/* Progress Primary Slider (Exec) */}
                    <div className="mb-3">
                      <label className="text-xs text-gray-500 font-medium">Job Progress (Primary) — {statusForm.progress_primary}%</label>
                      <input
                        type="range" min="0" max="100" step="5"
                        value={statusForm.progress_primary}
                        onChange={e => setStatusForm({...statusForm, progress_primary: Number(e.target.value)})}
                        className="w-full mt-1 accent-blue-500"
                      />
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{width: `${statusForm.progress_primary}%`}}></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1">
                        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                      </div>
                    </div>

                    <button
                      onClick={updateJobStatus}
                      disabled={updatingStatus}
                      className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {updatingStatus ? 'Menyimpan...' : '✅ Simpan Kemaskini'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
