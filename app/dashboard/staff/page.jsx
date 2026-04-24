'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function StaffDashboard() {
  const [profile, setProfile] = useState(null)
  const [jobs, setJobs] = useState([])
  const [timesheets, setTimesheets] = useState([])
  const [allProfiles, setAllProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [todayHours, setTodayHours] = useState({})
  const [todayNotes, setTodayNotes] = useState({})
  const [progress, setProgress] = useState({})
  const [statusMap, setStatusMap] = useState({})
  const [jobStatusMap, setJobStatusMap] = useState({})
  const [activeTab, setActiveTab] = useState('active')
  const router = useRouter()

  const today = new Date().toISOString().split('T')[0]

  const jobStatusOptions = {
    general: [
      'In Progress (10% - 70%)',
      'Pending Client Info',
      'Pending LHDN',
      'Pending Auditor',
      'Ready for Collection (80%)',
      'Completed (100%)'
    ],
    tax: [
      '10% - Opening KYC & Documentation',
      '30% - Preparing Draft/Job',
      '60% - 1st Draft/Report Ready',
      '70% - Internal Review',
      '80% - Client Approval',
      '90% - Finalise & KYC Closing',
      '100% - Completed'
    ],
    coaching: [
      'Not Started - Coaching',
      'In Progress - Coaching',
      'In Progress - Review',
      'Completed - Review',
      'Completed - Coaching'
    ]
  }

  const getProgressFromStatus = (status) => {
    const map = {
      '10% - Opening KYC & Documentation': 10,
      '30% - Preparing Draft/Job': 30,
      '60% - 1st Draft/Report Ready': 60,
      '70% - Internal Review': 70,
      '80% - Client Approval': 80,
      '90% - Finalise & KYC Closing': 90,
      '100% - Completed': 100,
      'Ready for Collection (80%)': 80,
      'Completed (100%)': 100,
      'Completed - Coaching': 100,
      'Completed - Review': 90
    }
    return map[status] || null
  }

  const getStatusType = (serviceType) => {
    if (!serviceType) return 'general'
    const taxTypes = ['Form C','Form B','Form E','Form TF','Form N','Form Q','Form BE','Tax Audit','Tax MA','CP204','Tax Estimation','Tax Investigation','SST Audit']
    const coachingTypes = ['Coaching & Training','Advisory services','SPC','SST Registration','Yayasan Incorporation']
    if (taxTypes.includes(serviceType)) return 'tax'
    if (coachingTypes.includes(serviceType)) return 'coaching'
    return 'general'
  }

  const getPendingAlert = (job) => {
    if (!job.pending_since) return null
    if (!['Pending Client Info','Pending LHDN','Pending Auditor'].includes(job.job_status)) return null
    const days = Math.floor((new Date() - new Date(job.pending_since)) / (1000 * 60 * 60 * 24))
    if (job.job_status === 'Pending Client Info') {
      if (days >= 30) return { color: 'red', label: `${days} hari — KIV!` }
      if (days >= 14) return { color: 'red', label: `${days} hari` }
      if (days >= 7) return { color: 'orange', label: `${days} hari` }
      if (days >= 3) return { color: 'yellow', label: `${days} hari` }
    }
    if (job.job_status === 'Pending Auditor') {
      if (days >= 60) return { color: 'red', label: `${days} hari — Escalate!` }
      if (days >= 30) return { color: 'orange', label: `${days} hari` }
    }
    if (job.job_status === 'Pending LHDN') {
      return { color: days >= 7 ? 'orange' : 'yellow', label: `${days} hari` }
    }
    return null
  }

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!p || p.role !== 'staff') { router.push('/'); return }
    setProfile(p)
    fetchProfiles()
    fetchJobs(p.id)
    fetchTimesheets(p.id)
  }

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name')
    if (data) {
      const map = {}
      data.forEach(x => { map[x.id] = x.full_name })
      setAllProfiles(map)
    }
  }

  const fetchJobs = async (staffId) => {
    const { data } = await supabase
      .from('jobs')
      .select('*, clients(company_name)')
      .or(`assigned_exec.eq.${staffId},assigned_reviewer.eq.${staffId},assigned_de.eq.${staffId}`)
      .order('due_date', { ascending: true })

    if (data) {
      setJobs(data)
      const p = {}, s = {}, js = {}
      data.forEach(j => {
        p[j.id] = j.completion_percentage ?? 0
        s[j.id] = j.status ?? 'in_progress'
        js[j.id] = j.job_status ?? 'In Progress (10% - 70%)'
      })
      setProgress(p)
      setStatusMap(s)
      setJobStatusMap(js)
    }
    setLoading(false)
  }

  const fetchTimesheets = async (staffId) => {
    const { data } = await supabase
      .from('timesheets')
      .select('*')
      .eq('staff_id', staffId)
      .order('log_date', { ascending: false })
    if (data) setTimesheets(data)
  }

  const handleSaveProgress = async (jobId) => {
    setSaving(true)
    const newJobStatus = jobStatusMap[jobId]
    const autoProgress = getProgressFromStatus(newJobStatus)
    const finalProgress = autoProgress !== null ? autoProgress : progress[jobId]

    // Handle pending_since
    const pendingStatuses = ['Pending Client Info', 'Pending LHDN', 'Pending Auditor']
    const job = jobs.find(j => j.id === jobId)
    const wasPending = pendingStatuses.includes(job?.job_status)
    const isPending = pendingStatuses.includes(newJobStatus)
    const pendingSince = isPending && !wasPending ? new Date().toISOString() : (isPending ? job?.pending_since : null)

    const { error } = await supabase.from('jobs').update({
      completion_percentage: finalProgress,
      status: finalProgress >= 100 ? 'completed' : 'in_progress',
      job_status: newJobStatus,
      pending_since: pendingSince
    }).eq('id', jobId)

    if (error) setMessage('❌ Error: ' + error.message)
    else {
      setProgress(prev => ({ ...prev, [jobId]: finalProgress }))
      setMessage('✅ Progress berjaya dikemaskini!')
      setTimeout(() => setMessage(''), 3000)
      fetchJobs(profile.id)
    }
    setSaving(false)
  }

  const handleSaveHours = async (jobId) => {
    const hours = parseFloat(todayHours[jobId] || 0)
    const note = todayNotes[jobId] || ''
    if (!note.trim()) { setMessage('❌ Sila isi nota kerja!'); setTimeout(() => setMessage(''), 3000); return }
    if (hours <= 0) { setMessage('❌ Sila isi jam kerja!'); setTimeout(() => setMessage(''), 3000); return }

    setSaving(true)
    const { error } = await supabase.from('timesheets').insert({
      job_id: jobId, staff_id: profile.id, log_date: today, hours_logged: hours, note: note
    })

    if (error) setMessage('❌ Error: ' + error.message)
    else {
      setMessage('✅ Log kerja berjaya disimpan!')
      setTodayHours(prev => ({ ...prev, [jobId]: '' }))
      setTodayNotes(prev => ({ ...prev, [jobId]: '' }))
      fetchTimesheets(profile.id)
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  const getRole = (job) => {
    if (!profile) return '-'
    if (job.assigned_exec === profile.id) return 'Exec'
    if (job.assigned_reviewer === profile.id) return 'Reviewer'
    if (job.assigned_de === profile.id) return 'Data Entry'
    return '-'
  }

  const isOverdue = (dueDate) => dueDate && new Date(dueDate) < new Date()
  const jobTimesheets = (jobId) => timesheets.filter(t => t.job_id === jobId)

  const activeJobs = jobs.filter(j => j.status !== 'completed')
  const completedJobs = jobs.filter(j => j.status === 'completed')
  const kivJobs = jobs.filter(j => j.is_kiv)
  const overdueJobs = activeJobs.filter(j => isOverdue(j.due_date))

  // Stats
  const totalHoursThisMonth = timesheets
    .filter(t => t.log_date?.startsWith(today.slice(0, 7)))
    .reduce((sum, t) => sum + Number(t.hours_logged), 0)

  const totalRevenue = activeJobs.reduce((sum, job) => {
    const role = getRole(job)
    const val = Number(job.invoice_value || 0)
    if (role === 'Exec') return sum + (job.assigned_de ? val * 0.75 : val * 0.80)
    if (role === 'Reviewer') return sum + val * 0.20
    if (role === 'Data Entry') return sum + val * 0.05
    return sum
  }, 0)

  const displayJobs = activeTab === 'active' ? activeJobs : activeTab === 'completed' ? completedJobs : kivJobs

  const getPendingBorderColor = (job) => {
    const alert = getPendingAlert(job)
    if (!alert) return ''
    if (alert.color === 'red') return 'border-red-400 bg-red-50'
    if (alert.color === 'orange') return 'border-orange-400 bg-orange-50'
    if (alert.color === 'yellow') return 'border-yellow-400 bg-yellow-50'
    return ''
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">AMACC PMS</h1>
          <p className="text-blue-200 text-sm">Staff Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">{profile?.full_name}</span>
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }}
            className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg text-sm">Log Keluar</button>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        {/* Welcome */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-800">Selamat Datang, {profile?.full_name}!</h2>
          <p className="text-gray-500 text-sm">Hari ini: {today}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <p className="text-xs text-gray-500">Jobs Aktif</p>
            <p className="text-2xl font-bold text-blue-600">{activeJobs.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <p className="text-xs text-gray-500">Overdue</p>
            <p className={`text-2xl font-bold ${overdueJobs.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {overdueJobs.length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <p className="text-xs text-gray-500">Jam Bulan Ini</p>
            <p className="text-2xl font-bold text-purple-600">{totalHoursThisMonth.toFixed(1)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <p className="text-xs text-gray-500">Revenue Attribution</p>
            <p className="text-lg font-bold text-green-600">RM {totalRevenue.toLocaleString('ms-MY', {maximumFractionDigits: 0})}</p>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('❌') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'active', label: `Aktif (${activeJobs.length})` },
            { key: 'completed', label: `Selesai (${completedJobs.length})` },
            { key: 'kiv', label: `KIV (${kivJobs.length})` }
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : displayJobs.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500">Tiada job dalam kategori ini</div>
        ) : (
          <div className="space-y-6">
            {displayJobs.map(job => {
              const alert = getPendingAlert(job)
              return (
                <div key={job.id} className={`bg-white rounded-xl shadow-sm border-2 ${isOverdue(job.due_date) && job.status !== 'completed' ? 'border-red-300' : getPendingBorderColor(job) || 'border-gray-100'}`}>

                  {/* Job Header */}
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">{job.clients?.company_name}</h3>
                        <p className="text-sm text-gray-500">{job.invoice_number} • {job.service_type}</p>
                        <p className="text-green-600 font-semibold">RM {Number(job.invoice_value || 0).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                          {getRole(job)}
                        </span>
                        <p className={`text-xs mt-1 ${isOverdue(job.due_date) && job.status !== 'completed' ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                          Due: {job.due_date ? new Date(job.due_date).toLocaleDateString('ms-MY') : '-'}
                          {isOverdue(job.due_date) && job.status !== 'completed' && ' ⚠️'}
                        </p>
                        {job.is_kiv && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⚠️ KIV</span>}
                      </div>
                    </div>

                    {/* Alert banner */}
                    {alert && (
                      <div className={`mt-2 px-3 py-2 rounded-lg text-xs font-medium ${
                        alert.color === 'red' ? 'bg-red-100 text-red-700' :
                        alert.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        ⏳ {job.job_status} — {alert.label}
                      </div>
                    )}

                    {/* Team info */}
                    <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                      {job.assigned_exec && <span>👤 Exec: <strong>{allProfiles[job.assigned_exec] || '-'}</strong></span>}
                      {job.assigned_reviewer && job.assigned_reviewer !== job.assigned_exec && (
                        <span>🔍 Reviewer: <strong>{allProfiles[job.assigned_reviewer] || '-'}</strong></span>
                      )}
                      {job.assigned_de && <span>📊 DE: <strong>{allProfiles[job.assigned_de] || '-'}</strong></span>}
                      <span>⏱️ Budget: <strong>{job.budgeted_hours || 80} jam</strong></span>
                      <span>📝 Logged: <strong>{jobTimesheets(job.id).reduce((s,t) => s + Number(t.hours_logged), 0).toFixed(1)} jam</strong></span>
                    </div>

                    {job.job_description && (
                      <div className="mt-3 bg-blue-50 p-3 rounded-lg">
                        <p className="text-xs font-medium text-blue-700 mb-1">📋 Skop Kerja:</p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{job.job_description}</p>
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  {job.status !== 'completed' && (
                    <div className="p-5 border-b border-gray-100">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">📊 Kemaskini Status & Progress</h4>

                      {/* Job Status Dropdown */}
                      <div className="mb-3">
                        <label className="text-xs text-gray-500 mb-1 block">Status Job</label>
                        <select value={jobStatusMap[job.id] ?? 'In Progress (10% - 70%)'}
                          onChange={e => {
                            const newStatus = e.target.value
                            setJobStatusMap(prev => ({ ...prev, [job.id]: newStatus }))
                            const autoP = getProgressFromStatus(newStatus)
                            if (autoP !== null) setProgress(prev => ({ ...prev, [job.id]: autoP }))
                          }}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <optgroup label="— Job Status —">
                            {jobStatusOptions.general.map(s => <option key={s} value={s}>{s}</option>)}
                          </optgroup>
                          <optgroup label="— Tax Progress —">
                            {jobStatusOptions.tax.map(s => <option key={s} value={s}>{s}</option>)}
                          </optgroup>
                          <optgroup label="— Coaching/Advisory —">
                            {jobStatusOptions.coaching.map(s => <option key={s} value={s}>{s}</option>)}
                          </optgroup>
                        </select>
                      </div>

                      {/* Progress slider */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-sm text-gray-600 shrink-0">% Siap</span>
                        <input type="range" min="0" max="100"
                          value={progress[job.id] ?? 0}
                          onChange={e => setProgress(prev => ({ ...prev, [job.id]: parseInt(e.target.value) }))}
                          className="flex-1" />
                        <span className="text-blue-600 font-bold w-12 text-right">{progress[job.id] ?? 0}%</span>
                      </div>

                      <button onClick={() => handleSaveProgress(job.id)} disabled={saving}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm disabled:opacity-50">
                        💾 Simpan Progress
                      </button>
                    </div>
                  )}

                  {/* Log Hours */}
                  {job.status !== 'completed' && (
                    <div className="p-5 border-b border-gray-100">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">📝 Log Kerja Hari Ini ({today})</h4>
                      <textarea
                        value={todayNotes[job.id] || ''}
                        onChange={e => setTodayNotes(prev => ({ ...prev, [job.id]: e.target.value }))}
                        placeholder="Contoh: Buat reconciliation akaun bank Jan-Mac..."
                        className="w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2} />
                      <div className="flex gap-3 items-center mt-2">
                        <span className="text-sm text-gray-600">Jam:</span>
                        <input type="number" min="0" max="24" step="0.5"
                          value={todayHours[job.id] || ''}
                          onChange={e => setTodayHours(prev => ({ ...prev, [job.id]: e.target.value }))}
                          className="w-20 px-3 py-2 border rounded-lg text-sm" placeholder="0" />
                        <span className="text-sm text-gray-600">jam</span>
                        <button onClick={() => handleSaveHours(job.id)} disabled={saving}
                          className="ml-auto bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                          💾 Simpan Log
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Log History */}
                  {jobTimesheets(job.id).length > 0 && (
                    <div className="p-5">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">📅 Log History</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {jobTimesheets(job.id).map(t => (
                          <div key={t.id} className="flex justify-between items-start bg-gray-50 px-3 py-2 rounded-lg text-sm">
                            <div>
                              <span className="text-gray-400 text-xs">{t.log_date}</span>
                              <p className="text-gray-700">{t.note}</p>
                            </div>
                            <span className="text-blue-600 font-medium ml-3 shrink-0">{t.hours_logged} jam</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-2 text-right">
                        Total: {jobTimesheets(job.id).reduce((sum, t) => sum + Number(t.hours_logged), 0).toFixed(1)} jam
                        {job.budgeted_hours && ` / ${job.budgeted_hours} jam budget`}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}