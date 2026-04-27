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
  const [statusForm, setStatusForm] = useState({ status: '', progress_primary: 0, progress_secondary: 0, progress_de: 0 })
  const [modalTab, setModalTab] = useState('detail')
  const [instructions, setInstructions] = useState([])
  const [loadingInstructions, setLoadingInstructions] = useState(false)
  const [newInstruction, setNewInstruction] = useState({ message: '', urgency: 'normal', instruction_type: 'instruction' })
  const [postingInstruction, setPostingInstruction] = useState(false)
  const router = useRouter()

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof) { router.push('/'); return }
    if (!['staff', 'hoo', 'hoo_mp', 'ceo'].includes(prof.role)) { router.push('/'); return }
    setProfile(prof)
    await checkHardBlock(prof)
    await loadJobs(prof.id)
    await calculateUnearned(prof.id)
  }

  async function checkHardBlock(prof) {
    const now = new Date()
    const hour = now.getHours()
    if (hour < 10) return
    const { data: activeJobs } = await supabase.from('jobs').select('id')
      .or(`assigned_exec.eq.${prof.id},assigned_reviewer.eq.${prof.id},assigned_de.eq.${prof.id}`)
      .not('status', 'eq', 'completed').limit(1)
    if (!activeJobs || activeJobs.length === 0) return
    const { data: yesterdayLog } = await supabase.from('timesheets').select('id')
      .eq('staff_id', prof.id).eq('log_date', yesterday).limit(1)
    if (!yesterdayLog || yesterdayLog.length === 0) {
      await supabase.from('profiles').update({ is_blocked: true, blocked_since: new Date().toISOString() }).eq('id', prof.id)
      setIsBlocked(true)
      setMissedDate(yesterday)
    }
  }

  async function loadJobs(staffId) {
    const { data } = await supabase.from('jobs')
      .select(`*, clients(company_name)`)
      .or(`assigned_exec.eq.${staffId},assigned_reviewer.eq.${staffId},assigned_de.eq.${staffId}`)
      .not('status', 'eq', 'completed').order('due_date')
    setJobs(data || [])
    const { data: logs } = await supabase.from('timesheets').select('*')
      .eq('staff_id', staffId).eq('log_date', today)
    const logsMap = {}
    const notesMap = {}
    logs?.forEach(l => { logsMap[l.job_id] = l.hours_logged; notesMap[l.job_id] = l.note || '' })
    setTodayLogs(logsMap)
    setNotes(notesMap)
    setLoading(false)
  }

  async function calculateUnearned(staffId) {
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const { data: logs } = await supabase.from('timesheets').select('log_date')
      .eq('staff_id', staffId).gte('log_date', firstOfMonth)
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
    const { data: activeJobs } = await supabase.from('jobs')
      .select('id, invoice_value, assigned_exec, assigned_reviewer, assigned_de')
      .or(`assigned_exec.eq.${staffId},assigned_reviewer.eq.${staffId},assigned_de.eq.${staffId}`)
      .not('status', 'eq', 'completed')
    let dailyRate = 0
    activeJobs?.forEach(job => {
      const invoiceVal = Number(job.invoice_value || 0)
      if (job.assigned_exec === staffId) dailyRate += (invoiceVal * (job.assigned_de ? 0.75 : 0.80)) / 30
      if (job.assigned_reviewer === staffId && job.assigned_reviewer !== job.assigned_exec) dailyRate += (invoiceVal * 0.20) / 30
      if (job.assigned_de === staffId) dailyRate += (invoiceVal * 0.05) / 30
    })
    const unearned = dailyRate * missedDays
    setUnearnedRevenue({ thisMonth: activeJobs?.length > 0 ? unearned : 0, allTime: activeJobs?.length > 0 ? unearned : 0, missedDays: activeJobs?.length > 0 ? missedDays : 0 })
  }

  async function openJobDetail(job) {
    setSelectedJob(job)
    setModalTab('detail')
    setLoadingDetail(true)
    setStatusForm({ status: job.status || 'in_progress', progress_primary: job.completion_percentage || 0, progress_secondary: job.completion_secondary || 0, progress_de: job.completion_de || 0 })

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

    let pendingDays = 0, pendingLevel = null
    if (job.status === 'pending_client' && job.updated_at) {
      pendingDays = Math.floor((new Date() - new Date(job.updated_at)) / (1000 * 60 * 60 * 24))
      if (pendingDays >= 30) pendingLevel = 'kiv'
      else if (pendingDays >= 14) pendingLevel = 'red'
      else if (pendingDays >= 7) pendingLevel = 'orange'
      else if (pendingDays >= 3) pendingLevel = 'yellow'
    }

    setJobDetail({
      execId: job.assigned_exec, reviewerId: job.assigned_reviewer, deId: job.assigned_de,
      exec: execRes.data?.full_name || '-', reviewer: reviewerRes.data?.full_name || '-', de: deRes.data?.full_name || '-',
      execHours, reviewerHours, deHours, totalHours, pendingDays, pendingLevel,
      isSolo: job.assigned_exec === job.assigned_reviewer,
    })
    setLoadingDetail(false)
  }

  async function loadInstructions(jobId) {
    setLoadingInstructions(true)
    const { data } = await supabase.from('job_instructions')
      .select(`*, created_by_profile:profiles!job_instructions_created_by_fkey(full_name, role), resolved_by_profile:profiles!job_instructions_resolved_by_fkey(full_name)`)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
    setInstructions(data || [])
    // Mark as read
    if (profile && data) {
      for (const inst of data) {
        await supabase.from('instruction_reads').upsert({ instruction_id: inst.id, staff_id: profile.id }, { onConflict: 'instruction_id,staff_id' })
      }
    }
    setLoadingInstructions(false)
  }

  async function postInstruction() {
    if (!newInstruction.message.trim() || !selectedJob || !profile) return
    setPostingInstruction(true)
    const isHooOrCeo = ['hoo', 'hoo_mp', 'ceo'].includes(profile.role)
    const instType = isHooOrCeo ? newInstruction.instruction_type : 'reply'

    const { data: inst } = await supabase.from('job_instructions').insert({
      job_id: selectedJob.id,
      created_by: profile.id,
      instruction_type: instType,
      urgency: isHooOrCeo ? newInstruction.urgency : 'normal',
      message: newInstruction.message.trim(),
      status: 'open'
    }).select().single()

    // Send email for urgent/critical
    if (inst && isHooOrCeo && ['urgent', 'critical'].includes(newInstruction.urgency)) {
      const recipients = []
      if (jobDetail?.execId) {
        const { data: ep } = await supabase.from('profiles').select('email, full_name').eq('id', jobDetail.execId).single()
        if (ep) recipients.push(ep)
      }
      if (jobDetail?.reviewerId && jobDetail.reviewerId !== jobDetail.execId) {
        const { data: rp } = await supabase.from('profiles').select('email, full_name').eq('id', jobDetail.reviewerId).single()
        if (rp) recipients.push(rp)
      }
      if (jobDetail?.deId) {
        const { data: dp } = await supabase.from('profiles').select('email, full_name').eq('id', jobDetail.deId).single()
        if (dp) recipients.push(dp)
      }
      // Trigger email via API
      await fetch('/api/send-instruction-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients, urgency: newInstruction.urgency,
          message: newInstruction.message,
          jobName: selectedJob.clients?.company_name,
          serviceType: selectedJob.service_type,
          senderName: profile.full_name
        })
      })
    }

    setNewInstruction({ message: '', urgency: 'normal', instruction_type: 'instruction' })
    await loadInstructions(selectedJob.id)
    setPostingInstruction(false)
  }

  async function resolveInstruction(instructionId) {
    if (!profile) return
    await supabase.from('job_instructions').update({
      status: 'resolved', resolved_by: profile.id, resolved_at: new Date().toISOString()
    }).eq('id', instructionId)
    await loadInstructions(selectedJob.id)
  }

  async function reopenInstruction(instructionId) {
    await supabase.from('job_instructions').update({ status: 'reopened', resolved_by: null, resolved_at: null }).eq('id', instructionId)
    await loadInstructions(selectedJob.id)
  }

  async function updateJobStatus() {
    if (!selectedJob || !profile) return
    setUpdatingStatus(true)
    await supabase.from('jobs').update({
      status: statusForm.status, completion_percentage: statusForm.progress_primary,
      completion_secondary: statusForm.progress_secondary, completion_de: statusForm.progress_de,
      updated_at: new Date().toISOString(),
    }).eq('id', selectedJob.id)
    setMessage('Γ£à Status job berjaya dikemaskini!')
    setSelectedJob(null); setJobDetail(null)
    await loadJobs(profile.id)
    setUpdatingStatus(false)
    setTimeout(() => setMessage(''), 3000)
  }

  async function saveTimesheets() {
    if (!profile) return
    setSaving(true)
    for (const job of jobs.filter(j => !['completed','kiv'].includes(j.status))) {
      await supabase.from('timesheets').upsert({
        staff_id: profile.id, job_id: job.id, log_date: today,
        hours_logged: Number(todayLogs[job.id] || 0), note: notes[job.id] || '', status: job.status
      }, { onConflict: 'staff_id,job_id,log_date' })
    }
    if (isBlocked) {
      await supabase.from('profiles').update({ is_blocked: false, unblocked_at: new Date().toISOString() }).eq('id', profile.id)
      setIsBlocked(false)
    }
    setMessage('Γ£à Timesheet berjaya disimpan!')
    setTimeout(() => setMessage(''), 3000)
    setSaving(false)
  }

  const getStatusLabel = (s) => ({ not_started: 'ΓÜ¬ Belum Mula', in_progress: '≡ƒö╡ Dalam Proses', pending_client: '≡ƒƒí Pending Client', pending_authority: '≡ƒƒá Pending LHDN/Auditor', completed: 'Γ£à Selesai', kiv: '≡ƒôî KIV' }[s] || s)

  const getPendingAlert = (level, days) => {
    if (!level) return null
    const c = { yellow: { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-700', label: `ΓÜá∩╕Å Pending Client ${days} hari ΓÇö Follow up segera!` }, orange: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', label: `≡ƒö╢ Pending Client ${days} hari ΓÇö Urgent!` }, red: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', label: `≡ƒÜ¿ Pending Client ${days} hari ΓÇö Kritikal! Maklumkan HOO!` }, kiv: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', label: `≡ƒôî Pending Client ${days} hari ΓÇö Akan masuk KIV` } }[level]
    return <div className={`${c.bg} border ${c.border} rounded-lg p-3 mb-4`}><p className={`text-sm font-medium ${c.text}`}>{c.label}</p></div>
  }

  const getUrgencyBadge = (urgency) => ({
    normal: <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">≡ƒƒó Normal</span>,
    urgent: <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">≡ƒƒí Urgent</span>,
    critical: <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">≡ƒö┤ Kritikal</span>,
  }[urgency] || null)

  const getTypeBadge = (type) => ({
    instruction: <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">≡ƒôó Instruction</span>,
    reply: <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">≡ƒÆ¼ Reply</span>,
    update: <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">≡ƒöä Update</span>,
  }[type] || null)

  const isHooOrCeo = profile && ['hoo', 'hoo_mp', 'ceo'].includes(profile.role)
  const isExec = jobDetail && profile && jobDetail.execId === profile.id
  const canEditExec = isExec
  const canEditReviewer = jobDetail && profile && jobDetail.reviewerId === profile.id && !jobDetail.isSolo
  const canEditDe = jobDetail && profile && jobDetail.deId === profile.id

  const openInstructionsCount = instructions.filter(i => i.status === 'open' && i.instruction_type === 'instruction').length

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-500">Loading...</div></div>

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">≡ƒöÆ</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Timesheet Belum Dikemaskini!</h1>
          <p className="text-gray-600 mb-2">Awak belum log hours untuk:</p>
          <p className="text-lg font-bold text-red-500 mb-6">{new Date(missedDate).toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <button onClick={() => setIsBlocked(false)} className="w-full bg-red-500 text-white py-3 rounded-lg font-medium hover:bg-red-600 mb-3">≡ƒô¥ Log Timesheet Sekarang</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="w-full bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">Log Keluar</button>
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
          <button onClick={() => router.push('/dashboard/staff/osm')} className="bg-purple-500 text-white px-3 py-1 rounded text-sm font-medium hover:bg-purple-400">≡ƒôï OSM</button>
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
          <div className="bg-white rounded-lg border p-3"><div className="text-xs text-gray-500">Jobs Aktif</div><div className="text-2xl font-bold text-blue-600">{aktifJobs.length}</div></div>
          <div className="bg-white rounded-lg border p-3"><div className="text-xs text-gray-500">Overdue</div><div className="text-2xl font-bold text-red-500">{jobs.filter(j => j.due_date && new Date(j.due_date) < new Date()).length}</div></div>
          <div className="bg-white rounded-lg border p-3"><div className="text-xs text-gray-500">Unearned Bulan Ini</div><div className="text-lg font-bold text-orange-500">RM {unearnedRevenue.thisMonth.toFixed(2)}</div><div className="text-xs text-gray-400">{unearnedRevenue.missedDays} hari tak log</div></div>
          <div className="bg-white rounded-lg border p-3"><div className="text-xs text-gray-500">Jam Hari Ini</div><div className="text-lg font-bold text-green-600">{Object.values(todayLogs).reduce((a,b) => a + Number(b), 0)} jam</div></div>
        </div>

        {unearnedRevenue.missedDays > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <p className="text-orange-700 font-medium">ΓÜá∩╕Å {unearnedRevenue.missedDays} hari bulan ini tiada timesheet</p>
            <p className="text-orange-600 text-sm">Anggaran revenue tidak dikira: <strong>RM {unearnedRevenue.thisMonth.toFixed(2)}</strong></p>
          </div>
        )}

        {message && <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-green-700">{message}</div>}

        <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveTab('aktif')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'aktif' ? 'bg-blue-500 text-white' : 'bg-white border text-gray-600'}`}>Aktif ({aktifJobs.length})</button>
          <button onClick={() => setActiveTab('timesheet')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'timesheet' ? 'bg-blue-500 text-white' : 'bg-white border text-gray-600'}`}>≡ƒô¥ Log Hari Ini</button>
          <button onClick={() => setActiveTab('kiv')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'kiv' ? 'bg-blue-500 text-white' : 'bg-white border text-gray-600'}`}>KIV ({kivJobs.length})</button>
        </div>

        {activeTab === 'aktif' && (
          <div className="space-y-4">
            {aktifJobs.length === 0 ? <div className="bg-white rounded-lg border p-8 text-center text-gray-400">Tiada jobs aktif</div>
            : aktifJobs.map(job => (
              <div key={job.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer" onClick={() => openJobDetail(job)}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-blue-600">{job.clients?.company_name}</h3>
                    <p className="text-sm text-gray-500">{job.invoice_number} ΓÇó {job.service_type}</p>
                    <p className="text-green-600 font-bold text-sm">RM {Number(job.invoice_value || 0).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500">Due: {job.due_date ? new Date(job.due_date).toLocaleDateString('ms-MY') : '-'}</span>
                    {job.due_date && new Date(job.due_date) < new Date() && <div className="text-xs text-red-500 font-medium">ΓÜá∩╕Å OVERDUE</div>}
                    <div className="mt-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">Lihat Detail ΓåÆ</div>
                  </div>
                </div>
                {job.job_description && <div className="bg-gray-50 rounded p-2 text-sm text-gray-600">≡ƒôï {job.job_description}</div>}
                {job.completion_percentage > 0 && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{width: `${job.completion_percentage}%`}}></div>
                    </div>
                    <span className="text-xs text-gray-500">{job.completion_percentage}% siap</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'timesheet' && (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-blue-700 text-sm">≡ƒô¥ Update jam untuk job yang awak buat hari ni sahaja.</p>
            </div>
            <div className="space-y-3">
              {aktifJobs.map(job => (
                <div key={job.id} className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="font-medium text-sm">{job.clients?.company_name}</p>
                      <p className="text-xs text-gray-500">{job.invoice_number} ΓÇó {job.service_type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" max="12" step="0.5" value={todayLogs[job.id] || 0}
                        onChange={e => setTodayLogs({...todayLogs, [job.id]: e.target.value})}
                        className="w-16 border rounded px-2 py-1 text-center text-sm" />
                      <span className="text-xs text-gray-500">jam</span>
                    </div>
                  </div>
                  {Number(todayLogs[job.id]) > 0 && (
                    <input type="text" placeholder="Nota kerja (optional)" value={notes[job.id] || ''}
                      onChange={e => setNotes({...notes, [job.id]: e.target.value})}
                      className="w-full border rounded px-3 py-1 text-sm mt-1" />
                  )}
                </div>
              ))}
            </div>
            <button onClick={saveTimesheets} disabled={saving} className="w-full mt-4 bg-blue-500 text-white py-3 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50">
              {saving ? 'Menyimpan...' : '≡ƒÆ╛ Simpan Semua Timesheet'}
            </button>
          </div>
        )}

        {activeTab === 'kiv' && (
          <div className="space-y-3">
            {kivJobs.length === 0 ? <div className="bg-white rounded-lg border p-8 text-center text-gray-400">Tiada jobs KIV</div>
            : kivJobs.map(job => (
              <div key={job.id} onClick={() => openJobDetail(job)} className="bg-white rounded-lg border border-yellow-200 p-4 cursor-pointer hover:shadow-sm">
                <h3 className="font-bold text-blue-600">{job.clients?.company_name}</h3>
                <p className="text-sm text-gray-500">{job.invoice_number} ΓÇó {job.service_type}</p>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">KIV</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FULLSCREEN MODAL */}
      {selectedJob && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
          {/* Header */}
          <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-10">
            <div>
              <h2 className="text-xl font-bold">{selectedJob.clients?.company_name}</h2>
              <p className="text-blue-200 text-sm">{selectedJob.invoice_number} ΓÇó {selectedJob.service_type}</p>
            </div>
            <button onClick={() => { setSelectedJob(null); setJobDetail(null) }} className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50">Γ£ò Tutup</button>
          </div>

          {/* Modal Tabs */}
          <div className="bg-gray-100 px-6 flex gap-2 sticky top-16 z-10 border-b">
            <button onClick={() => setModalTab('detail')} className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${modalTab === 'detail' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              ≡ƒôï Detail & Status
            </button>
            <button onClick={() => { setModalTab('instructions'); loadInstructions(selectedJob.id) }}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${modalTab === 'instructions' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              ≡ƒôó Instructions
              {openInstructionsCount > 0 && <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{openInstructionsCount}</span>}
            </button>
          </div>

          <div className="max-w-4xl mx-auto p-6">

            {/* ===== DETAIL TAB ===== */}
            {modalTab === 'detail' && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <p className="text-xs text-green-500 font-medium">Invoice Value</p>
                    <p className="text-xl font-bold text-green-700">RM {Number(selectedJob.invoice_value || 0).toLocaleString()}</p>
                  </div>
                  <div className={`rounded-xl p-4 border ${selectedJob.due_date && new Date(selectedJob.due_date) < new Date() ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                    <p className="text-xs text-gray-500 font-medium">Due Date</p>
                    <p className="font-bold text-gray-800">{selectedJob.due_date ? new Date(selectedJob.due_date).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</p>
                    {selectedJob.due_date && new Date(selectedJob.due_date) < new Date() && <p className="text-xs text-red-500 font-bold mt-1">ΓÜá∩╕Å OVERDUE</p>}
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p className="text-xs text-gray-500 font-medium">Financial Year End</p>
                    <p className="font-bold text-gray-800">{selectedJob.financial_year_end || '-'}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p className="text-xs text-gray-500 font-medium">Budget Hours</p>
                    <p className="font-bold text-gray-800">{selectedJob.budgeted_hours || '-'} jam</p>
                  </div>
                </div>

                {selectedJob.job_description && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <p className="text-xs text-blue-500 font-bold mb-2">≡ƒôï SKOP KERJA</p>
                    <p className="text-blue-900">{selectedJob.job_description}</p>
                  </div>
                )}

                {jobDetail && getPendingAlert(jobDetail.pendingLevel, jobDetail.pendingDays)}

                {loadingDetail ? <div className="text-center py-12 text-gray-400">ΓÅ│ Loading...</div>
                : jobDetail && (
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Team & Hours */}
                    <div>
                      <h3 className="font-bold text-gray-700 text-lg mb-4">≡ƒæÑ Team & Hours</h3>
                      <div className="space-y-3">
                        {/* EXEC */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="text-xs text-blue-500 font-bold">EXEC {jobDetail.isSolo ? '(SOLO)' : ''}</p>
                              <p className="font-bold text-gray-800">{jobDetail.exec}</p>
                              <p className="text-xs text-blue-600">{jobDetail.isSolo ? '80%' : '75%'} revenue</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Hours logged</p>
                              <p className="text-xl font-bold text-blue-600">{jobDetail.execHours.toFixed(1)}</p>
                              <p className="text-xs text-gray-400">jam</p>
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progress (Primary)</span>
                            <span className="font-bold text-blue-600">{statusForm.progress_primary}%</span>
                          </div>
                          <input type="range" min="0" max="100" step="5" value={statusForm.progress_primary}
                            onChange={e => canEditExec && setStatusForm({...statusForm, progress_primary: Number(e.target.value)})}
                            disabled={!canEditExec} className={`w-full accent-blue-500 ${!canEditExec ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} />
                          <div className="w-full bg-blue-200 rounded-full h-2 mt-1">
                            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{width: `${statusForm.progress_primary}%`}}></div>
                          </div>
                          {!canEditExec && <p className="text-xs text-gray-400 mt-1">≡ƒöÆ Hanya Exec boleh edit</p>}
                        </div>

                        {/* REVIEWER */}
                        {!jobDetail.isSolo && (
                          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="text-xs text-green-500 font-bold">REVIEWER</p>
                                <p className="font-bold text-gray-800">{jobDetail.reviewer}</p>
                                <p className="text-xs text-green-600">20% revenue</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Hours logged</p>
                                <p className="text-xl font-bold text-green-600">{jobDetail.reviewerHours.toFixed(1)}</p>
                                <p className="text-xs text-gray-400">jam</p>
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>Progress (Secondary)</span>
                              <span className="font-bold text-green-600">{statusForm.progress_secondary}%</span>
                            </div>
                            <input type="range" min="0" max="100" step="5" value={statusForm.progress_secondary}
                              onChange={e => canEditReviewer && setStatusForm({...statusForm, progress_secondary: Number(e.target.value)})}
                              disabled={!canEditReviewer} className={`w-full accent-green-500 ${!canEditReviewer ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} />
                            <div className="w-full bg-green-200 rounded-full h-2 mt-1">
                              <div className="bg-green-500 h-2 rounded-full transition-all" style={{width: `${statusForm.progress_secondary}%`}}></div>
                            </div>
                            {!canEditReviewer && <p className="text-xs text-gray-400 mt-1">≡ƒöÆ Hanya Reviewer boleh edit</p>}
                          </div>
                        )}

                        {/* DE */}
                        {selectedJob.assigned_de && (
                          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="text-xs text-purple-500 font-bold">DATA ENTRY</p>
                                <p className="font-bold text-gray-800">{jobDetail.de}</p>
                                <p className="text-xs text-purple-600">5% revenue</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Hours logged</p>
                                <p className="text-xl font-bold text-purple-600">{jobDetail.deHours.toFixed(1)}</p>
                                <p className="text-xs text-gray-400">jam</p>
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>Progress (DE)</span>
                              <span className="font-bold text-purple-600">{statusForm.progress_de}%</span>
                            </div>
                            <input type="range" min="0" max="100" step="5" value={statusForm.progress_de}
                              onChange={e => canEditDe && setStatusForm({...statusForm, progress_de: Number(e.target.value)})}
                              disabled={!canEditDe} className={`w-full accent-purple-500 ${!canEditDe ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} />
                            <div className="w-full bg-purple-200 rounded-full h-2 mt-1">
                              <div className="bg-purple-500 h-2 rounded-full transition-all" style={{width: `${statusForm.progress_de}%`}}></div>
                            </div>
                            {!canEditDe && <p className="text-xs text-gray-400 mt-1">≡ƒöÆ Hanya DE boleh edit</p>}
                          </div>
                        )}

                        {/* Total */}
                        <div className="bg-gray-100 rounded-xl p-4">
                          <div className="flex justify-between items-center">
                            <p className="font-bold text-gray-700">Total Hours</p>
                            <p className="text-2xl font-bold text-gray-800">{jobDetail.totalHours.toFixed(1)} <span className="text-sm font-normal text-gray-500">jam</span></p>
                          </div>
                          {selectedJob.budgeted_hours && (
                            <div className="mt-2">
                              <div className="w-full bg-gray-300 rounded-full h-3">
                                <div className={`h-3 rounded-full transition-all ${jobDetail.totalHours / selectedJob.budgeted_hours > 0.8 ? 'bg-red-500' : 'bg-green-500'}`}
                                  style={{width: `${Math.min(100, (jobDetail.totalHours / selectedJob.budgeted_hours) * 100)}%`}}></div>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{jobDetail.totalHours.toFixed(1)} / {selectedJob.budgeted_hours} jam ({Math.round((jobDetail.totalHours / selectedJob.budgeted_hours) * 100)}%)</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Update */}
                    <div>
                      <h3 className="font-bold text-gray-700 text-lg mb-4">≡ƒôè Kemaskini Status</h3>
                      <div className="bg-white border rounded-xl p-5 space-y-4">
                        <div>
                          <label className="text-sm font-bold text-gray-600">Job Status</label>
                          <select value={statusForm.status} onChange={e => setStatusForm({...statusForm, status: e.target.value})} className="w-full mt-1 border rounded-lg px-3 py-2.5 text-sm">
                            <option value="not_started">ΓÜ¬ Belum Mula</option>
                            <option value="in_progress">≡ƒö╡ Dalam Proses</option>
                            <option value="pending_client">≡ƒƒí Pending Client</option>
                            <option value="pending_authority">≡ƒƒá Pending LHDN/Auditor</option>
                            <option value="kiv">≡ƒôî KIV</option>
                            <option value="completed">Γ£à Selesai</option>
                          </select>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs font-bold text-gray-500 mb-2">RINGKASAN PROGRESS</p>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm"><span className="text-blue-600">Primary (Exec)</span><span className="font-bold">{statusForm.progress_primary}%</span></div>
                            {!jobDetail.isSolo && <div className="flex justify-between text-sm"><span className="text-green-600">Secondary (Reviewer)</span><span className="font-bold">{statusForm.progress_secondary}%</span></div>}
                            {selectedJob.assigned_de && <div className="flex justify-between text-sm"><span className="text-purple-600">DE Progress</span><span className="font-bold">{statusForm.progress_de}%</span></div>}
                          </div>
                        </div>
                        <button onClick={updateJobStatus} disabled={updatingStatus} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 text-lg">
                          {updatingStatus ? 'ΓÅ│ Menyimpan...' : 'Γ£à Simpan Kemaskini'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ===== INSTRUCTIONS TAB ===== */}
            {modalTab === 'instructions' && (
              <div>
                {/* Post new instruction/reply */}
                <div className="bg-white border rounded-xl p-4 mb-6">
                  <h3 className="font-bold text-gray-700 mb-3">
                    {isHooOrCeo ? '≡ƒôó Hantar Instruction / Update' : '≡ƒÆ¼ Hantar Reply / Update'}
                  </h3>
                  <textarea
                    value={newInstruction.message}
                    onChange={e => setNewInstruction({...newInstruction, message: e.target.value})}
                    placeholder={isHooOrCeo ? 'Tulis instruction atau update untuk team...' : 'Tulis reply atau update progress...'}
                    className="w-full border rounded-lg px-3 py-2 text-sm mb-3 h-24 resize-none"
                  />
                  <div className="flex gap-3 items-end">
                    {isHooOrCeo && (
                      <>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 font-medium">Jenis</label>
                          <select value={newInstruction.instruction_type} onChange={e => setNewInstruction({...newInstruction, instruction_type: e.target.value})} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm">
                            <option value="instruction">≡ƒôó Instruction</option>
                            <option value="update">≡ƒöä Update</option>
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-500 font-medium">Urgency</label>
                          <select value={newInstruction.urgency} onChange={e => setNewInstruction({...newInstruction, urgency: e.target.value})} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm">
                            <option value="normal">≡ƒƒó Normal</option>
                            <option value="urgent">≡ƒƒí Urgent</option>
                            <option value="critical">≡ƒö┤ Kritikal</option>
                          </select>
                        </div>
                      </>
                    )}
                    <button onClick={postInstruction} disabled={postingInstruction || !newInstruction.message.trim()}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
                      {postingInstruction ? 'ΓÅ│ Hantar...' : '≡ƒôñ Hantar'}
                    </button>
                  </div>
                </div>

                {/* Instructions List */}
                {loadingInstructions ? <div className="text-center py-8 text-gray-400">ΓÅ│ Loading...</div>
                : instructions.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-4xl mb-2">≡ƒô¡</div>
                    <p>Tiada instruction lagi untuk job ini</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {instructions.map(inst => (
                      <div key={inst.id} className={`rounded-xl border p-4 ${inst.status === 'resolved' ? 'bg-gray-50 border-gray-200 opacity-75' : inst.urgency === 'critical' ? 'bg-red-50 border-red-300' : inst.urgency === 'urgent' ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-200'}`}>
                        {/* Instruction Header */}
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getTypeBadge(inst.instruction_type)}
                            {inst.instruction_type !== 'reply' && getUrgencyBadge(inst.urgency)}
                            {inst.status === 'resolved' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Γ£à Resolved</span>}
                            {inst.status === 'reopened' && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">≡ƒöä Reopened</span>}
                          </div>
                          <span className="text-xs text-gray-400">{new Date(inst.created_at).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        {/* Sender */}
                        <p className="text-xs text-gray-500 mb-2">
                          <span className="font-medium text-gray-700">{inst.created_by_profile?.full_name}</span>
                          <span className="ml-1 text-gray-400">({inst.created_by_profile?.role?.toUpperCase()})</span>
                        </p>

                        {/* Message */}
                        <p className="text-gray-800 text-sm leading-relaxed mb-3">{inst.message}</p>

                        {/* Resolved info */}
                        {inst.status === 'resolved' && inst.resolved_by_profile && (
                          <p className="text-xs text-green-600 mb-2">Γ£à Resolved oleh {inst.resolved_by_profile.full_name} pada {new Date(inst.resolved_at).toLocaleDateString('ms-MY')}</p>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2">
                          {/* Exec can resolve open instructions */}
                          {isExec && inst.instruction_type === 'instruction' && inst.status === 'open' && (
                            <button onClick={() => resolveInstruction(inst.id)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 font-medium">
                              Γ£à Mark Resolved
                            </button>
                          )}
                          {/* HOO/CEO can reopen resolved instructions */}
                          {isHooOrCeo && inst.status === 'resolved' && (
                            <button onClick={() => reopenInstruction(inst.id)} className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 font-medium">
                              ≡ƒöä Reopen
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
