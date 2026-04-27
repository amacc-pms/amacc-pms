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
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [modalTab, setModalTab] = useState('detail')
  const [jobDetail, setJobDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusForm, setStatusForm] = useState({ status: '', progress_primary: 0, progress_secondary: 0, progress_de: 0 })
  const [instructions, setInstructions] = useState([])
  const [replyText, setReplyText] = useState({})
  const [notifications, setNotifications] = useState([])
  const [showBell, setShowBell] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filterService, setFilterService] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterDueMonth, setFilterDueMonth] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [monthlySummary, setMonthlySummary] = useState({ hoursLogged: 0, revenueEarned: 0, unearned: 0, daysLogged: 0, daysMissed: 0 })
  const [todayLogs, setTodayLogs] = useState({})
  const [todayNotes, setTodayNotes] = useState({})
  const [todayLeave, setTodayLeave] = useState({})
  const [blockLogs, setBlockLogs] = useState({})
  const [blockNotes, setBlockNotes] = useState({})
  const [blockLeave, setBlockLeave] = useState({})
  const router = useRouter()

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  useEffect(() => { checkAuth() }, [])
  useEffect(() => { if (profile && jobs.length > 0) loadMonthlySummary() }, [selectedMonth, profile, jobs])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof) { router.push('/'); return }
    setProfile(prof)
    await loadJobs(user.id)
    await checkHardBlock(prof, user.id)
    await loadNotifications(user.id)
    setLoading(false)
  }

  async function loadJobs(userId) {
    const { data } = await supabase
      .from('jobs')
      .select('*, clients!jobs_client_id_fkey(company_name, id)')
      .or(`assigned_exec.eq.${userId},assigned_reviewer.eq.${userId},assigned_de.eq.${userId}`)
      .not('status', 'eq', 'completed')
      .order('due_date', { ascending: true })
    setJobs(data || [])
    const initialLogs = {}
    const initialNotes = {}
    const initialLeave = {}
    ;(data || []).forEach(j => { initialLogs[j.id] = ''; initialNotes[j.id] = ''; initialLeave[j.id] = '' })
    setTodayLogs(initialLogs)
    setTodayNotes(initialNotes)
    setTodayLeave(initialLeave)
  }

  async function checkHardBlock(prof, userId) {
    const now = new Date()
    const hour = now.getHours()
    if (hour < 10) return
    const { data: activeJobs } = await supabase
      .from('jobs')
      .select('id')
      .or(`assigned_exec.eq.${userId},assigned_reviewer.eq.${userId},assigned_de.eq.${userId}`)
      .not('status', 'eq', 'completed')
      .limit(1)
    if (!activeJobs || activeJobs.length === 0) return
    const yesterdayDay = new Date(yesterday).getDay()
    if (yesterdayDay === 0 || yesterdayDay === 6) return // Skip weekend
const { data: unlockedByHOO } = await supabase
  .from('timesheet_unlocks')
  .select('id')
  .eq('staff_id', userId)
  .eq('unlock_date', today)
  .single()
if (unlockedByHOO) return // HOO dah unlock & Sabtu (6)
    const { data: yesterdayLog } = await supabase
      .from('timesheets')
      .select('id')
      .eq('staff_id', userId)
      .eq('log_date', yesterday)
      .limit(1)
    if (!yesterdayLog || yesterdayLog.length === 0) {
      setIsBlocked(true)
      setMissedDate(yesterday)
      const { data: blockedJobs } = await supabase
        .from('jobs')
        .select('*, clients(company_name)')
        .or(`assigned_exec.eq.${userId},assigned_reviewer.eq.${userId},assigned_de.eq.${userId}`)
        .not('status', 'eq', 'completed')
      const bl = {}; const bn = {}; const blv = {}
      ;(blockedJobs || []).forEach(j => { bl[j.id] = '0'; bn[j.id] = ''; blv[j.id] = '' })
      setBlockLogs(bl); setBlockNotes(bn); setBlockLeave(blv)
    }
  }

  async function saveBlockLog() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const entries = Object.keys(blockLogs).map(jobId => ({
      staff_id: user.id,
      job_id: jobId,
      log_date: yesterday,
      hours_logged: blockLeave[jobId] ? 0 : parseFloat(blockLogs[jobId] || 0),
      note: blockLeave[jobId] ? blockLeave[jobId] : (blockNotes[jobId] || ''),
      status: 'logged'
    }))
    for (const entry of entries) {
      const { data: existing } = await supabase.from('timesheets').select('id').eq('staff_id', entry.staff_id).eq('job_id', entry.job_id).eq('log_date', entry.log_date).single()
      if (existing) {
        await supabase.from('timesheets').update({ hours_logged: entry.hours_logged, note: entry.note, status: 'logged' }).eq('id', existing.id)
      } else {
        await supabase.from('timesheets').insert(entry)
      }
    }
    setIsBlocked(false)
    setSaving(false)
    setMessage('✅ Log semalam berjaya disimpan!')
    setTimeout(() => setMessage(''), 3000)
  }

  async function saveTodayLog() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    let saved = 0
    for (const jobId of Object.keys(todayLogs)) {
      if (todayLogs[jobId] === '' && !todayLeave[jobId]) continue
      const hours = todayLeave[jobId] ? 0 : parseFloat(todayLogs[jobId] || 0)
      const note = todayLeave[jobId] ? todayLeave[jobId] : (todayNotes[jobId] || '')
      const { data: existing } = await supabase.from('timesheets').select('id').eq('staff_id', user.id).eq('job_id', jobId).eq('log_date', today).single()
      if (existing) {
        await supabase.from('timesheets').update({ hours_logged: hours, note, status: 'logged' }).eq('id', existing.id)
      } else {
        await supabase.from('timesheets').insert({ staff_id: user.id, job_id: jobId, log_date: today, hours_logged: hours, note, status: 'logged' })
      }
      saved++
    }
    setSaving(false)
    if (saved > 0) { setMessage('✅ Log hari ini berjaya disimpan!') } else { setMessage('⚠️ Tiada perubahan untuk disimpan') }
    setTimeout(() => setMessage(''), 3000)
  }

  async function loadNotifications(userId) {
    const notifs = []
    const { data: unresolvedInstructions } = await supabase
      .from('job_instructions')
      .select('id, message, urgency_level, jobs(clients(company_name))')
      .eq('assigned_to', userId)
      .neq('status', 'resolved')
    ;(unresolvedInstructions || []).forEach(i => {
      notifs.push({ id: i.id, type: 'instruction', message: `📋 Instruction: ${i.jobs?.clients?.company_name} — ${i.message?.slice(0, 40)}...`, urgency: i.urgency_level, link: '/dashboard/staff/osm' })
    })
    const { data: dueSoonJobs } = await supabase
      .from('jobs')
      .select('id, due_date, clients(company_name)')
      .or(`assigned_exec.eq.${userId},assigned_reviewer.eq.${userId}`)
      .not('status', 'eq', 'completed')
      .lte('due_date', new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0])
      .gte('due_date', today)
    ;(dueSoonJobs || []).forEach(j => {
      const daysLeft = Math.ceil((new Date(j.due_date) - new Date()) / 86400000)
      notifs.push({ id: `due_${j.id}`, type: 'due', message: `⏰ Due ${daysLeft} hari lagi: ${j.clients?.company_name}`, link: '/dashboard/staff' })
    })
    const { data: overdueJobs } = await supabase
      .from('jobs')
      .select('id, due_date, clients(company_name)')
      .or(`assigned_exec.eq.${userId},assigned_reviewer.eq.${userId}`)
      .not('status', 'eq', 'completed')
      .lt('due_date', today)
    ;(overdueJobs || []).forEach(j => {
      notifs.push({ id: `overdue_${j.id}`, type: 'overdue', message: `🔴 OVERDUE: ${j.clients?.company_name}`, link: '/dashboard/staff' })
    })
    setNotifications(notifs)
  }

  async function loadJobDetail(job) {
    setLoadingDetail(true)
    setSelectedJob(job)
    setModalTab('detail')
    const { data: execProfile } = job.assigned_exec ? await supabase.from('profiles').select('full_name').eq('id', job.assigned_exec).single() : { data: null }
    const { data: reviewerProfile } = job.assigned_reviewer ? await supabase.from('profiles').select('full_name').eq('id', job.assigned_reviewer).single() : { data: null }
    const { data: deProfile } = job.assigned_de ? await supabase.from('profiles').select('full_name').eq('id', job.assigned_de).single() : { data: null }
    const { data: timesheets } = await supabase.from('timesheets').select('*').eq('job_id', job.id).order('log_date', { ascending: false })
    const execHours = (timesheets || []).filter(t => t.staff_id === job.assigned_exec).reduce((s, t) => s + (t.hours_logged || 0), 0)
    const reviewerHours = (timesheets || []).filter(t => t.staff_id === job.assigned_reviewer).reduce((s, t) => s + (t.hours_logged || 0), 0)
    const deHours = (timesheets || []).filter(t => t.staff_id === job.assigned_de).reduce((s, t) => s + (t.hours_logged || 0), 0)
    const totalHours = execHours + reviewerHours + deHours
    const isSolo = job.assigned_exec === job.assigned_reviewer
    const { data: instrs } = await supabase.from('job_instructions').select('*, profiles(full_name)').eq('job_id', job.id).order('created_at', { ascending: false })
    setInstructions(instrs || [])
    setJobDetail({ execName: execProfile?.full_name, reviewerName: reviewerProfile?.full_name, deName: deProfile?.full_name, execHours, reviewerHours, deHours, totalHours, isSolo, timesheets: timesheets || [] })
    setStatusForm({ status: job.status || 'in_progress', progress_primary: job.progress_primary || 0, progress_secondary: job.progress_secondary || 0, progress_de: job.progress_de || 0 })
    setLoadingDetail(false)
  }

  async function updateJobStatus() {
    if (!selectedJob) return
    setUpdatingStatus(true)
    const { data: { user } } = await supabase.auth.getUser()
    const isExec = selectedJob.assigned_exec === user.id
    const isReviewer = selectedJob.assigned_reviewer === user.id
    const isDe = selectedJob.assigned_de === user.id
    const updates = { status: statusForm.status }
    if (isExec) updates.progress_primary = statusForm.progress_primary
    if (isReviewer && !jobDetail?.isSolo) updates.progress_secondary = statusForm.progress_secondary
    if (isDe) updates.progress_de = statusForm.progress_de
    await supabase.from('jobs').update(updates).eq('id', selectedJob.id)
    setJobs(prev => prev.map(j => j.id === selectedJob.id ? { ...j, ...updates } : j))
    setUpdatingStatus(false)
    setMessage('✅ Status berjaya dikemaskini!')
    setTimeout(() => setMessage(''), 3000)
  }

  async function sendReply(instrId) {
    if (!replyText[instrId]?.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('instruction_replies').insert({ instruction_id: instrId, sender_id: user.id, message: replyText[instrId] })
    setReplyText(prev => ({ ...prev, [instrId]: '' }))
    loadJobDetail(selectedJob)
  }

  async function loadMonthlySummary() {
    if (!profile) return
    const { data: logs } = await supabase
      .from('timesheets')
      .select('*, jobs!timesheets_job_id_fkey(invoice_value, assigned_exec, assigned_reviewer, assigned_de)')
      .eq('staff_id', profile.id)
      .gte('log_date', `${selectedMonth}-01`)
      .lt('log_date', `${selectedMonth.slice(0,4)}-${String(parseInt(selectedMonth.slice(5,7))+1).padStart(2,'0')}-01`)
    const hoursLogged = (logs || []).reduce((s, l) => s + (l.hours_logged || 0), 0)
    const daysLogged = new Set((logs || []).map(l => l.log_date)).size
    let revenueEarned = 0
    ;(logs || []).forEach(log => {
      const job = log.jobs
      if (!job) return
      const isExec = job.assigned_exec === profile.id
      const isReviewer = job.assigned_reviewer === profile.id
      const isDe = job.assigned_de === profile.id
      const isSolo = job.assigned_exec === job.assigned_reviewer
      const pct = isExec ? (isSolo ? 0.8 : 0.75) : isReviewer ? 0.2 : isDe ? 0.05 : 0
      revenueEarned += ((job.invoice_value || 0) / 30) * pct * (log.hours_logged || 0) / 8
    })
    const workingDays = 22
    const daysMissed = Math.max(0, workingDays - daysLogged)
    const dailyRate = revenueEarned / Math.max(daysLogged, 1)
    const unearned = dailyRate * daysMissed
    setMonthlySummary({ hoursLogged: hoursLogged.toFixed(1), revenueEarned: revenueEarned.toFixed(2), unearned: unearned.toFixed(2), daysLogged, daysMissed })
  }

  const serviceTypes = {
  'TAX': ['Form C (S/B)', 'Form B', 'Form Be', 'Form E', 'Form TF', 'Form EA', 'Form N', 'Form Q', 'Form P', 'Tax Audit', 'Tax - MA', 'CP204', 'CP204 (A)', 'CP204 (B)', 'Tax Estimation'],
  'ACCOUNTING': ['Account Yearly (Current)', 'Account Yearly (Backlog)', 'Account Monthly', 'Account In Advance', 'Account Dormant', 'Accounts Review'],
  'ADVISORY': ['SPC', 'SST Registration', 'Coaching & Training']
}

  const filteredJobs = jobs.filter(job =>{ 
    const matchSearch = searchText === '' || job.clients?.company_name?.toLowerCase().includes(searchText.toLowerCase())
    const matchService = filterService === '' || job.service_type === filterService
    const matchStatus = filterStatus === '' || job.status === filterStatus
    const matchMonth = filterMonth === '' || (job.date_assign && job.date_assign.startsWith(filterMonth))
    const matchDueMonth = filterDueMonth === '' || (job.due_date && job.due_date.startsWith(filterDueMonth))
    return matchSearch && matchService && matchStatus && matchMonth && matchDueMonth
  })

  const overdueJobs = filteredJobs.filter(j => j.due_date && j.due_date < today)
  const activeJobs = filteredJobs.filter(j => !j.due_date || j.due_date >= today)

  const statusLabel = (s) => {
    const map = { not_started: '⚪ Belum Mula', in_progress: '🔵 Dalam Proses', pending_client: '🟡 Pending Client', pending_authority: '🟠 Pending LHDN', kiv: '📌 KIV', completed: '✅ Selesai' }
    return map[s] || s
  }

  const statusColor = (s) => {
    const map = { not_started: '#94a3b8', in_progress: '#3b82f6', pending_client: '#f59e0b', pending_authority: '#f97316', kiv: '#8b5cf6', completed: '#10b981' }
    return map[s] || '#94a3b8'
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>⏳</div>
        <p style={{ color: '#64748b', marginTop: 8 }}>Memuatkan dashboard...</p>
      </div>
    </div>
  )

  // HARD BLOCK SCREEN
  if (isBlocked) return (
    <div style={{ minHeight: '100vh', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 28, maxWidth: 600, width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48 }}>🔒</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', margin: '8px 0 4px' }}>Timesheet Belum Dikemaskini</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>Log jam kerja semalam ({missedDate}) dahulu untuk teruskan</p>
        </div>
        {message && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#166534', fontSize: 14 }}>{message}</div>}
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 12 }}>ISI JAM KERJA SEMALAM — {missedDate}</p>
          {Object.keys(blockLogs).map(jobId => {
            const job = jobs.find(j => j.id === jobId)
            if (!job) return null
            return (
              <div key={jobId} style={{ background: 'white', borderRadius: 10, padding: 12, marginBottom: 10, border: '1px solid #e2e8f0' }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', margin: '0 0 8px' }}>{job.clients?.company_name} — {job.invoice_number}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Jam Kerja</label>
                    <input type="number" value={blockLogs[jobId]} onChange={e => setBlockLogs(p => ({ ...p, [jobId]: e.target.value }))}
                      min="0" max="24" step="0.5" placeholder="0"
                      style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', marginTop: 4 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Cuti/MC/PH</label>
                    <select value={blockLeave[jobId]} onChange={e => setBlockLeave(p => ({ ...p, [jobId]: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', marginTop: 4 }}>
                      <option value="">-</option>
                      <option value="Cuti">Cuti</option>
                      <option value="MC">MC</option>
                      <option value="PH">PH</option>
                      <option value="Outstation">Outstation</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Nota</label>
                    <input type="text" value={blockNotes[jobId]} onChange={e => setBlockNotes(p => ({ ...p, [jobId]: e.target.value }))}
                      placeholder="Apa yang dibuat..."
                      style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', marginTop: 4 }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <button onClick={saveBlockLog} disabled={saving}
          style={{ width: '100%', background: saving ? '#94a3b8' : '#dc2626', color: 'white', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? '⏳ Menyimpan...' : '✅ Simpan & Buka Dashboard'}
        </button>
      </div>
    </div>
  )

  // MAIN DASHBOARD
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* TOP NAV */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', margin: 0 }}>AMACC PMS</h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{profile?.full_name} • {profile?.division}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* NOTIFICATION BELL */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowBell(!showBell)}
                style={{ background: notifications.length > 0 ? '#fef2f2' : '#f1f5f9', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 18, position: 'relative' }}>
                🔔
                {notifications.length > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, background: '#dc2626', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {notifications.length}
                  </span>
                )}
              </button>
              {showBell && (
                <div style={{ position: 'absolute', right: 0, top: '110%', background: 'white', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', width: 300, zIndex: 200, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
                    🔔 Notifikasi ({notifications.length})
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Tiada notifikasi</div>
                  ) : (
                    notifications.map((n, i) => (
                      <div key={i} onClick={() => { router.push(n.link); setShowBell(false) }}
                        style={{ padding: '10px 16px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', fontSize: 12, color: '#374151', background: n.type === 'overdue' ? '#fef2f2' : n.type === 'due' ? '#fffbeb' : 'white' }}>
                        {n.message}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <button onClick={() => router.push('/dashboard/staff/osm')}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' }}>
              📋 OSM
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
              style={{ background: '#fee2e2', border: 'none', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
              Keluar
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 16px' }}>
        {message && (
          <div style={{ background: message.includes('✅') ? '#f0fdf4' : '#fffbeb', border: `1px solid ${message.includes('✅') ? '#bbf7d0' : '#fde68a'}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, color: message.includes('✅') ? '#166534' : '#92400e', fontSize: 14 }}>
            {message}
          </div>
        )}

        {/* MONTHLY SUMMARY */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>📊 Summary Bulanan</h2>
            <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              style={{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Jam Logged', value: `${monthlySummary.hoursLogged} jam`, color: '#3b82f6', bg: '#eff6ff' },
              { label: 'Revenue Earned', value: `RM ${parseFloat(monthlySummary.revenueEarned).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}`, color: '#10b981', bg: '#f0fdf4' },
              { label: 'Unearned', value: `RM ${parseFloat(monthlySummary.unearned).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}`, color: '#ef4444', bg: '#fef2f2' },
              { label: 'Hari Log', value: `${monthlySummary.daysLogged} hari`, color: '#8b5cf6', bg: '#faf5ff' },
            ].map((s, i) => (
              <div key={i} style={{ background: s.bg, borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SEARCH & FILTER */}
        <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Cari Client</label>
              <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                placeholder="Nama client..."
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Service Type</label>
              <select value={filterService} onChange={e => setFilterService(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                <option value="">Semua</option>
                {Object.entries(serviceTypes).flatMap(([div, types]) => [<option key={`h_${div}`} disabled>{'— '+div+' —'}</option>,...types.map(s => <option key={s} value={s}>{s}</option>)])}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                <option value="">Semua</option>
                <option value="in_progress">🔵 Dalam Proses</option>
                <option value="pending_client">🟡 Pending Client</option>
                <option value="pending_authority">🟠 Pending LHDN</option>
                <option value="kiv">📌 KIV</option>
                <option value="not_started">⚪ Belum Mula</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Bulan Assign</label>
              <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Due Date (Bulan)</label>
              <input type="month" value={filterDueMonth} onChange={e => setFilterDueMonth(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>
          {(searchText || filterService || filterStatus || filterMonth || filterDueMonth) && (
            <button onClick={() => { setSearchText(''); setFilterService(''); setFilterStatus(''); setFilterMonth(''); setFilterDueMonth('') }}
              style={{ marginTop: 10, background: '#fee2e2', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
              ✕ Clear Filter
            </button>
          )}
        </div>

        {/* LOG HARI INI */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>⏱️ Log Hari Ini — {today}</h2>
            <button onClick={saveTodayLog} disabled={saving}
              style={{ background: saving ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? '⏳...' : '💾 Simpan Semua'}
            </button>
          </div>
          {jobs.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Tiada job aktif</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {filteredJobs.map(job => 
                <div key={job.id} style={{ background: '#f8fafc', borderRadius: 10, padding: 12, border: '1px solid #e2e8f0' }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', margin: '0 0 4px' }}>
                    {job.clients?.company_name} <span style={{ color: '#94a3b8', fontWeight: 400 }}>— {job.invoice_number}</span>
                  </p>
                  {job.financial_year_end && <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 8px' }}>FYE: {job.financial_year_end} • {job.service_type}</p>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Jam Kerja</label>
                      <input type="number" value={todayLogs[job.id] || ''} onChange={e => setTodayLogs(p => ({ ...p, [job.id]: e.target.value }))}
                        min="0" max="24" step="0.5" placeholder="0"
                        style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', marginTop: 4 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Cuti/MC/PH</label>
                      <select value={todayLeave[job.id] || ''} onChange={e => setTodayLeave(p => ({ ...p, [job.id]: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', marginTop: 4 }}>
                        <option value="">-</option>
                        <option value="Cuti">Cuti</option>
                        <option value="MC">MC</option>
                        <option value="PH">PH</option>
                        <option value="Outstation">Outstation</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Nota Kerja</label>
                      <input type="text" value={todayNotes[job.id] || ''} onChange={e => setTodayNotes(p => ({ ...p, [job.id]: e.target.value }))}
                        placeholder="Apa yang dibuat hari ni..."
                        style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', marginTop: 4 }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* JOB LIST */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: '0 0 16px' }}>
            📁 Senarai Job ({filteredJobs.length})
          </h2>

          {overdueJobs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>🔴 OVERDUE ({overdueJobs.length})</p>
              {overdueJobs.map(job => <JobCard key={job.id} job={job} profile={profile} onClick={() => loadJobDetail(job)} today={today} statusLabel={statusLabel} statusColor={statusColor} />)}
            </div>
          )}

          {activeJobs.length === 0 && overdueJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 40 }}>📭</div>
              <p style={{ marginTop: 8 }}>Tiada job dijumpai</p>
            </div>
          ) : (
            activeJobs.map(job => <JobCard key={job.id} job={job} profile={profile} onClick={() => loadJobDetail(job)} today={today} statusLabel={statusLabel} statusColor={statusColor} />)
          )}
        </div>
      </div>

      {/* JOB DETAIL MODAL */}
      {selectedJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, overflow: 'auto' }} onClick={e => { if (e.target === e.currentTarget) setSelectedJob(null) }}>
          <div style={{ background: 'white', minHeight: '100vh', maxWidth: '100%', width: '100%', margin: '0 auto' }}>
            {/* Modal Header */}
            <div style={{ background: '#1e293b', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selectedJob.clients?.company_name}</h2>
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>{selectedJob.invoice_number} • {selectedJob.service_type}</p>
              </div>
              <button onClick={() => setSelectedJob(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                ✕ Tutup
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{ borderBottom: '2px solid #f1f5f9', padding: '0 20px', background: 'white', display: 'flex', gap: 4 }}>
              {[
                { id: 'detail', label: '📋 Detail & Status' },
                { id: 'logtoday', label: '⏱️ Log Hari Ini' },
                { id: 'instructions', label: `📢 Instructions ${instructions.length > 0 ? `(${instructions.length})` : ''}` },
              ].map(tab => (
                <button key={tab.id} onClick={() => setModalTab(tab.id)}
                  style={{ background: 'none', border: 'none', borderBottom: modalTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent', padding: '14px 16px', cursor: 'pointer', fontSize: 13, fontWeight: modalTab === tab.id ? 700 : 500, color: modalTab === tab.id ? '#3b82f6' : '#64748b', marginBottom: -2 }}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
              {loadingDetail ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⏳ Memuatkan...</div>
              ) : (

                // TAB: DETAIL & STATUS
                modalTab === 'detail' ? (
                  <div>
                    {/* Info Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                      {[
                        { label: 'Invoice Value', value: `RM ${(selectedJob.invoice_value || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}`, color: '#10b981' },
                        { label: 'Due Date', value: selectedJob.due_date ? new Date(selectedJob.due_date).toLocaleDateString('ms-MY') : '-', color: selectedJob.due_date < today ? '#dc2626' : '#3b82f6' },
                        { label: 'Financial Year End', value: selectedJob.financial_year_end || '-', color: '#8b5cf6' },
                        { label: 'Budget Hours', value: `${selectedJob.budgeted_hours || 0} jam`, color: '#f59e0b' },
                      ].map((c, i) => (
                        <div key={i} style={{ background: '#f8fafc', borderRadius: 12, padding: 14 }}>
                          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{c.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{c.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Skop Kerja */}
                    {selectedJob.job_description && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 16, marginBottom: 24 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e', margin: '0 0 8px' }}>📌 SKOP KERJA</p>
                        <p style={{ fontSize: 14, color: '#1e293b', margin: 0, lineHeight: 1.6 }}>{selectedJob.job_description}</p>
                      </div>
                    )}

                    {/* Team & Hours */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>👥 Team & Hours</h3>
                        {[
                          { role: 'EXEC', name: jobDetail?.execName, hours: jobDetail?.execHours, pct: '75-80% revenue', color: '#3b82f6', bg: '#eff6ff', progressKey: 'progress_primary', progressLabel: 'Primary', canEdit: selectedJob.assigned_exec === profile?.id },
                          !jobDetail?.isSolo && { role: 'REVIEWER', name: jobDetail?.reviewerName, hours: jobDetail?.reviewerHours, pct: '20% revenue', color: '#10b981', bg: '#f0fdf4', progressKey: 'progress_secondary', progressLabel: 'Secondary', canEdit: selectedJob.assigned_reviewer === profile?.id },
                          selectedJob.assigned_de && { role: 'DATA ENTRY', name: jobDetail?.deName, hours: jobDetail?.deHours, pct: '5% revenue', color: '#8b5cf6', bg: '#faf5ff', progressKey: 'progress_de', progressLabel: 'DE', canEdit: selectedJob.assigned_de === profile?.id },
                        ].filter(Boolean).map((item, i) => (
                          <div key={i} style={{ background: item.bg, borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${item.color}20` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: item.color }}>{item.role}</span>
                                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{item.name || '-'}</p>
                                <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{item.pct}</p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{(item.hours || 0).toFixed(1)}</span>
                                <span style={{ fontSize: 11, color: '#64748b' }}> jam</span>
                              </div>
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 11, color: '#64748b' }}>Progress {item.progressLabel}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: item.color }}>{statusForm[item.progressKey]}%</span>
                              </div>
                              <input type="range" min="0" max="100" value={statusForm[item.progressKey]}
                                onChange={e => item.canEdit && setStatusForm(p => ({ ...p, [item.progressKey]: parseInt(e.target.value) }))}
                                disabled={!item.canEdit}
                                style={{ width: '100%', accentColor: item.color, cursor: item.canEdit ? 'pointer' : 'not-allowed' }} />
                              {!item.canEdit && <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0' }}>🔒 Hanya {item.role} boleh edit</p>}
                            </div>
                          </div>
                        ))}
                        {/* View History Button */}
                        <button onClick={() => router.push(`/dashboard/staff/timesheet-history?job=${selectedJob.id}`)}
                          style={{ width: '100%', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer', marginTop: 8 }}>
                          📊 Lihat History Timesheet
                        </button>
                      </div>

                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>📊 Kemaskini Status</h3>
                        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16 }}>
                          <div style={{ marginBottom: 14 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Job Status</label>
                            <select value={statusForm.status} onChange={e => setStatusForm(p => ({ ...p, status: e.target.value }))}
                              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, marginTop: 4, boxSizing: 'border-box' }}>
                              <option value="not_started">⚪ Belum Mula</option>
                              <option value="in_progress">🔵 Dalam Proses</option>
                              <option value="pending_client">🟡 Pending Client</option>
                              <option value="pending_authority">🟠 Pending LHDN/Auditor</option>
                              <option value="kiv">📌 KIV</option>
                              <option value="completed">✅ Selesai</option>
                            </select>
                          </div>
                          <div style={{ background: 'white', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', margin: '0 0 8px' }}>RINGKASAN PROGRESS</p>
                            {[
                              { label: 'Primary (Exec)', key: 'progress_primary', color: '#3b82f6' },
                              { label: 'Secondary (Reviewer)', key: 'progress_secondary', color: '#10b981' },
                              selectedJob.assigned_de && { label: 'DE Progress', key: 'progress_de', color: '#8b5cf6' },
                            ].filter(Boolean).map((p, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 13, color: p.color }}>{p.label}</span>
                                <span style={{ fontSize: 13, fontWeight: 700 }}>{statusForm[p.key]}%</span>
                              </div>
                            ))}
                          </div>
                          <button onClick={updateJobStatus} disabled={updatingStatus}
                            style={{ width: '100%', background: updatingStatus ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: updatingStatus ? 'not-allowed' : 'pointer' }}>
                            {updatingStatus ? '⏳ Menyimpan...' : '✅ Simpan Kemaskini'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                // TAB: LOG HARI INI (dalam modal — untuk job ini je)
                ) : modalTab === 'logtoday' ? (
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>⏱️ Log Jam Kerja — {selectedJob.clients?.company_name}</h3>
                    <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Isi jam kerja untuk job ini sahaja. Atau guna "Log Hari Ini" di dashboard untuk log semua job sekaligus.</p>
                    <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                          <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Jam Kerja Hari Ini</label>
                          <input type="number" value={todayLogs[selectedJob.id] || ''} onChange={e => setTodayLogs(p => ({ ...p, [selectedJob.id]: e.target.value }))}
                            min="0" max="24" step="0.5" placeholder="0"
                            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Cuti/MC/PH</label>
                          <select value={todayLeave[selectedJob.id] || ''} onChange={e => setTodayLeave(p => ({ ...p, [selectedJob.id]: e.target.value }))}
                            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}>
                            <option value="">-</option>
                            <option value="Cuti">Cuti</option>
                            <option value="MC">MC</option>
                            <option value="PH">PH</option>
                            <option value="Outstation">Outstation</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Nota Kerja</label>
                        <textarea value={todayNotes[selectedJob.id] || ''} onChange={e => setTodayNotes(p => ({ ...p, [selectedJob.id]: e.target.value }))}
                          placeholder="Apa yang dibuat hari ni untuk job ini..."
                          rows={3}
                          style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
                      </div>
                      <button onClick={saveTodayLog} disabled={saving}
                        style={{ width: '100%', background: saving ? '#94a3b8' : '#3b82f6', color: 'white', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                        {saving ? '⏳ Menyimpan...' : '💾 Simpan Log'}
                      </button>
                    </div>

                    {/* Recent logs for this job */}
                    {jobDetail?.timesheets && jobDetail.timesheets.length > 0 && (
                      <div style={{ marginTop: 20 }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 10 }}>Log Terkini (Job Ini)</h4>
                        {jobDetail.timesheets.slice(0, 5).map(log => (
                          <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                            <span style={{ color: '#475569' }}>{log.log_date}</span>
                            <span style={{ fontWeight: 700, color: '#3b82f6' }}>{log.hours_logged} jam</span>
                            <span style={{ color: '#94a3b8' }}>{log.note || '-'}</span>
                          </div>
                        ))}
                        <button onClick={() => router.push(`/dashboard/staff/timesheet-history?job=${selectedJob.id}`)}
                          style={{ width: '100%', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer', marginTop: 8 }}>
                          📊 Lihat Semua History →
                        </button>
                      </div>
                    )}
                  </div>

                // TAB: INSTRUCTIONS
                ) : modalTab === 'instructions' ? (
                  <div>
                    {instructions.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                        <div style={{ fontSize: 32 }}>📭</div>
                        <p style={{ marginTop: 8 }}>Tiada instruction untuk job ini</p>
                      </div>
                    ) : (
                      instructions.map(instr => (
                        <div key={instr.id} style={{ background: instr.urgency_level === 'kritikal' ? '#fef2f2' : instr.urgency_level === 'urgent' ? '#fffbeb' : '#f8fafc', borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${instr.urgency_level === 'kritikal' ? '#fecaca' : instr.urgency_level === 'urgent' ? '#fde68a' : '#e2e8f0'}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, background: instr.urgency_level === 'kritikal' ? '#dc2626' : instr.urgency_level === 'urgent' ? '#f59e0b' : '#64748b', color: 'white', padding: '2px 8px', borderRadius: 20 }}>
                              {(instr.urgency_level || 'normal').toUpperCase()}
                            </span>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>{instr.profiles?.full_name} • {new Date(instr.created_at).toLocaleDateString('ms-MY')}</span>
                          </div>
                          <p style={{ fontSize: 14, color: '#1e293b', margin: '0 0 12px', lineHeight: 1.6 }}>{instr.message}</p>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input type="text" value={replyText[instr.id] || ''} onChange={e => setReplyText(p => ({ ...p, [instr.id]: e.target.value }))}
                              placeholder="Tulis reply..."
                              style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
                            <button onClick={() => sendReply(instr.id)}
                              style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                              Hantar
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : null
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function JobCard({ job, profile, onClick, today, statusLabel, statusColor }) {
  const isOverdue = job.due_date && job.due_date < today
  const isDueSoon = job.due_date && !isOverdue && new Date(job.due_date) <= new Date(Date.now() + 3 * 86400000)
  const userRole = job.assigned_exec === profile?.id ? 'EXEC' : job.assigned_reviewer === profile?.id ? 'REVIEWER' : 'DE'
  const progress = userRole === 'EXEC' ? (job.progress_primary || 0) : userRole === 'REVIEWER' ? (job.progress_secondary || 0) : (job.progress_de || 0)

  return (
    <div onClick={onClick} style={{ background: isOverdue ? '#fef2f2' : '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 10, cursor: 'pointer', border: `1px solid ${isOverdue ? '#fecaca' : isDueSoon ? '#fde68a' : '#e2e8f0'}`, transition: 'box-shadow 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{job.clients?.company_name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{job.invoice_number} • {job.service_type}{job.financial_year_end ? ` • FYE: ${job.financial_year_end}` : ''}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ background: statusColor(job.status) + '20', color: statusColor(job.status), fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 }}>
            {statusLabel(job.status)}
          </span>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: isOverdue ? '#dc2626' : isDueSoon ? '#f59e0b' : '#94a3b8', fontWeight: isOverdue || isDueSoon ? 700 : 400 }}>
            {job.due_date ? `Due: ${new Date(job.due_date).toLocaleDateString('ms-MY')}` : '-'}
            {isOverdue ? ' ⚠️' : isDueSoon ? ' ⏰' : ''}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1, marginRight: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>Progress ({userRole})</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6' }}>{progress}%</span>
          </div>
          <div style={{ background: '#e2e8f0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
            <div style={{ background: progress >= 100 ? '#10b981' : progress >= 70 ? '#3b82f6' : '#f59e0b', height: '100%', width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
        <span style={{ fontSize: 11, background: userRole === 'EXEC' ? '#dbeafe' : userRole === 'REVIEWER' ? '#d1fae5' : '#ede9fe', color: userRole === 'EXEC' ? '#1d4ed8' : userRole === 'REVIEWER' ? '#065f46' : '#5b21b6', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
          {userRole}
        </span>
      </div>
    </div>
  )
}
