'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function HOODashboard() {
  const [jobs, setJobs] = useState([])
  const [myJobs, setMyJobs] = useState([])
  const [profile, setProfile] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [teamStats, setTeamStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [mainTab, setMainTab] = useState('jobs')
  const [selectedJob, setSelectedJob] = useState(null)
  const [modalTab, setModalTab] = useState('detail')
  const [jobDetail, setJobDetail] = useState(null)
  const [instructions, setInstructions] = useState([])
  const [assignHistory, setAssignHistory] = useState([])
  const [dueDateHistory, setDueDateHistory] = useState([])
  const [fyeHistory, setFyeHistory] = useState([])
  const [jobTimesheets, setJobTimesheets] = useState([])
  const [newInstruction, setNewInstruction] = useState('')
  const [newUrgency, setNewUrgency] = useState('normal')
  const [sendingInstr, setSendingInstr] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignData, setAssignData] = useState({ assigned_exec: '', assigned_reviewer: '', assigned_de: '', has_de: false, budgeted_hours: 80, due_date: '', due_date_reason: '', financial_year_end: '', fye_reason: '', financial_year_end: '', fye_reason: '' })
  const [searchText, setSearchText] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDiv, setFilterDiv] = useState('')
  const [activeSection, setActiveSection] = useState('unassigned')
  const [selectedStaff, setSelectedStaff] = useState(null)
  const [staffTimesheets, setStaffTimesheets] = useState([])
  const [loadingStaffTS, setLoadingStaffTS] = useState(false)
  const [teamFilterStaff, setTeamFilterStaff] = useState('')
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const currentMonth = new Date().toISOString().slice(0, 7)

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !['hoo', 'ceo'].includes(prof.role)) { router.push('/'); return }
    setProfile(prof)
    await loadData(prof)
  }

  async function loadData(prof) {
    let query = supabase.from('jobs').select('*, clients!jobs_client_id_fkey(company_name)').order('created_at', { ascending: false })
    if (prof?.role === 'hoo' && prof?.division) query = query.eq('division', prof.division)
    const { data: jobsData } = await query
    setJobs(jobsData || [])

    const { data: myJobsData } = await supabase.from('jobs')
      .select('*, clients!jobs_client_id_fkey(company_name)')
      .or(`assigned_exec.eq.${prof.id},assigned_reviewer.eq.${prof.id}`)
      .not('status', 'eq', 'completed')
    setMyJobs(myJobsData || [])

    const { data: profilesData } = await supabase.from('profiles').select('id, full_name, role, is_active, division').eq('is_active', true).order('full_name')
    setProfiles(profilesData || [])

    // Load team stats
    await loadTeamStats(jobsData || [], profilesData || [], prof)
    setLoading(false)
  }

  async function loadTeamStats(allJobs, allProfiles, prof) {
    const divProfiles = prof.role === 'ceo' ? allProfiles : allProfiles.filter(p => p.division === prof.division)
    const staffList = divProfiles.filter(p => ['staff', 'hoo'].includes(p.role))
    const stats = []
    for (const staff of staffList) {
      const staffJobs = allJobs.filter(j => j.assigned_exec === staff.id || j.assigned_reviewer === staff.id)
      const activeJobs = staffJobs.filter(j => j.status !== 'completed')
      const overdueJobs = staffJobs.filter(j => j.due_date && j.due_date < today && j.status !== 'completed')
      const pendingJobs = staffJobs.filter(j => ['pending_client', 'pending_authority'].includes(j.status))
      const { data: tsData } = await supabase.from('timesheets').select('hours_logged').eq('staff_id', staff.id).gte('log_date', `${currentMonth}-01`).lt('log_date', `${currentMonth.slice(0,4)}-${String(parseInt(currentMonth.slice(5,7))+1).padStart(2,'0')}-01`)
      const hoursThisMonth = (tsData || []).reduce((s, t) => s + (t.hours_logged || 0), 0)
      stats.push({ ...staff, activeJobs: activeJobs.length, overdueJobs: overdueJobs.length, pendingJobs: pendingJobs.length, hoursThisMonth: hoursThisMonth.toFixed(1) })
    }
    setTeamStats(stats)
  }

  async function openJobModal(job) {
    setSelectedJob(job)
    setModalTab('detail')
    setJobTimesheets([])
    const { data: execP } = job.assigned_exec ? await supabase.from('profiles').select('full_name').eq('id', job.assigned_exec).single() : { data: null }
    const { data: reviewerP } = job.assigned_reviewer ? await supabase.from('profiles').select('full_name').eq('id', job.assigned_reviewer).single() : { data: null }
    const { data: deP } = job.assigned_de ? await supabase.from('profiles').select('full_name').eq('id', job.assigned_de).single() : { data: null }
    const { data: timesheets } = await supabase.from('timesheets').select('*, profiles(full_name)').eq('job_id', job.id).order('log_date', { ascending: false })
    const totalHours = (timesheets || []).reduce((s, t) => s + (t.hours_logged || 0), 0)
    const execHours = (timesheets || []).filter(t => t.staff_id === job.assigned_exec).reduce((s, t) => s + (t.hours_logged || 0), 0)
    const reviewerHours = (timesheets || []).filter(t => t.staff_id === job.assigned_reviewer).reduce((s, t) => s + (t.hours_logged || 0), 0)
    const deHours = (timesheets || []).filter(t => t.staff_id === job.assigned_de).reduce((s, t) => s + (t.hours_logged || 0), 0)
    setJobTimesheets(timesheets || [])
    setJobDetail({ execName: execP?.full_name, reviewerName: reviewerP?.full_name, deName: deP?.full_name, totalHours, execHours, reviewerHours, deHours })
    const { data: instrs } = await supabase.from('job_instructions').select('*, profiles(full_name), instruction_replies(*, profiles(full_name))').eq('job_id', job.id).order('created_at', { ascending: false })
    setInstructions(instrs || [])
    const { data: history } = await supabase.from('job_assignment_history').select('*').eq('job_id', job.id).order('assigned_at', { ascending: false })
    setAssignHistory(history || [])
    const { data: ddHistory } = await supabase.from('due_date_history').select('*, profiles(full_name)').eq('job_id', job.id).order('created_at', { ascending: false })
    setDueDateHistory(ddHistory || [])
    const { data: fyeHist } = await supabase.from('fye_history').select('*').eq('job_id', job.id).order('created_at', { ascending: false })
    setFyeHistory(fyeHist || [])
  }

  function openAssign(job, e) {
    if (e) e.stopPropagation()
    setSelectedJob(job)
      setAssignData({assigned_exec: '', assigned_reviewer: '', assigned_de: '', has_de: false, budgeted_hours: 80, due_date: '', due_date_reason: '', financial_year_end: '', fye_reason: ''})
    setAssigning(true)
  }

  async function saveAssignment() {
    if (!assignData.assigned_exec) { alert('Exec wajib dipilih!'); return }
    const now = new Date()
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const execProfile = profiles.find(p => p.id === assignData.assigned_exec)
    const reviewerProfile = profiles.find(p => p.id === (assignData.assigned_reviewer || assignData.assigned_exec))
    const deProfile = assignData.has_de ? profiles.find(p => p.id === assignData.assigned_de) : null

    // Log due date change if changed
    if (assignData.due_date && assignData.due_date !== selectedJob.due_date) {
      await supabase.from('due_date_history').insert({
        job_id: selectedJob.id,
        old_due_date: selectedJob.due_date || null,
        new_due_date: assignData.due_date,
        changed_by: profile.id,
        changed_by_name: profile.full_name,
        reason: assignData.due_date_reason || 'Dikemaskini oleh HOO'
      })
    }
    if (assignData.financial_year_end && assignData.financial_year_end !== selectedJob.financial_year_end) {
      await supabase.from('fye_history').insert({
        job_id: selectedJob.id,
        old_fye: selectedJob.financial_year_end || null,
        new_fye: assignData.financial_year_end,
        changed_by: profile.id,
        changed_by_name: profile.full_name,
        reason: assignData.fye_reason || 'Dikemaskini oleh HOO'
      })
    }

    if (selectedJob.assigned_exec) {
      await supabase.from('job_assignment_history').update({ ended_at: now.toISOString() }).eq('job_id', selectedJob.id).is('ended_at', null)
    }
    await supabase.from('job_assignment_history').insert({ job_id: selectedJob.id, exec_id: assignData.assigned_exec, reviewer_id: assignData.assigned_reviewer || assignData.assigned_exec, data_entry_id: assignData.has_de ? assignData.assigned_de : null, assigned_by: profile.id, assigned_at: now.toISOString(), month_year: monthYear, exec_name: execProfile?.full_name || '', reviewer_name: reviewerProfile?.full_name || '', data_entry_name: deProfile?.full_name || null })
    const updates = { assigned_exec: assignData.assigned_exec, assigned_reviewer: assignData.assigned_reviewer || assignData.assigned_exec, assigned_de: assignData.has_de ? assignData.assigned_de : null, budgeted_hours: assignData.budgeted_hours, status: 'in_progress' }
    if (assignData.due_date) updates.due_date = assignData.due_date
    if (assignData.financial_year_end) updates.financial_year_end = assignData.financial_year_end
    const { error } = await supabase.from('jobs').update(updates).eq('id', selectedJob.id)
    if (error) { alert('Error: ' + error.message); return }
    alert('✅ Assignment berjaya!')
    setAssigning(false)
    setSelectedJob(null)
    await loadData(profile)
  }

  async function sendInstruction() {
    if (!newInstruction.trim()) return
    setSendingInstr(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('job_instructions').insert({ job_id: selectedJob.id, assigned_to: selectedJob.assigned_exec, message: newInstruction, urgency_level: newUrgency, status: 'open', created_by: user.id })
    setNewInstruction('')
    setNewUrgency('normal')
    const { data: instrs } = await supabase.from('job_instructions').select('*, profiles(full_name), instruction_replies(*, profiles(full_name))').eq('job_id', selectedJob.id).order('created_at', { ascending: false })
    setInstructions(instrs || [])
    setSendingInstr(false)
  }

  async function loadStaffTimesheets(staffId) {
    setLoadingStaffTS(true)
    const { data } = await supabase.from('timesheets').select('*, jobs(invoice_number, clients!jobs_client_id_fkey(company_name))').eq('staff_id', staffId).gte('log_date', `${currentMonth}-01`).order('log_date', { ascending: false })
    setStaffTimesheets(data || [])
    setLoadingStaffTS(false)
  }

  const STATUS_LABELS = { not_started: '⚪ Belum Mula', in_progress: '🔵 Dalam Proses', pending_client: '🟡 Pending Client', pending_authority: '🟠 Pending LHDN', kiv: '📌 KIV', completed: '✅ Selesai' }
  const STATUS_COLORS = { not_started: '#94a3b8', in_progress: '#3b82f6', pending_client: '#f59e0b', pending_authority: '#f97316', kiv: '#8b5cf6', completed: '#10b981' }
  const DIV_COLORS = { TAX: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' }, ACCOUNT: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' }, ADVISORY: { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' } }

  const filteredJobs = jobs.filter(job => {
    const matchSearch = searchText === '' || (job.clients?.company_name ?? '').toLowerCase().includes(searchText.toLowerCase())
    const matchStatus = filterStatus === '' || job.status === filterStatus
    const matchDiv = filterDiv === '' || job.division === filterDiv
    return matchSearch && matchStatus && matchDiv
  })

  const unassignedJobs = filteredJobs.filter(j => !j.assigned_exec)
  const metrics = { total: jobs.length, unassigned: jobs.filter(j => !j.assigned_exec).length, inProgress: jobs.filter(j => j.status === 'in_progress').length, pending: jobs.filter(j => ['pending_client','pending_authority'].includes(j.status)).length, overdue: jobs.filter(j => j.due_date && j.due_date < today && j.status !== 'completed').length, completed: jobs.filter(j => j.status === 'completed').length }

  const filteredTeamStats = teamFilterStaff ? teamStats.filter(s => s.id === teamFilterStaff) : teamStats

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><p>Memuatkan...</p></div>

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* NAV */}
      <div style={{ background: '#ea580c', color: 'white', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>AMACC PMS</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>{profile?.full_name} • HOO {profile?.division}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => router.push('/dashboard/staff')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>📁 My Jobs</button>
          <button onClick={() => router.push('/dashboard/hoo/timesheet-alert')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>⏰ Alert</button>
          <button onClick={() => router.push('/dashboard/hoo/osm')} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>📋 OSM</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} style={{ background: 'white', border: 'none', color: '#ea580c', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Keluar</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>

        {/* METRICS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Jumlah Job', value: metrics.total, color: '#1e293b', bg: '#f1f5f9' },
            { label: 'Belum Assign', value: metrics.unassigned, color: '#dc2626', bg: '#fef2f2' },
            { label: 'In Progress', value: metrics.inProgress, color: '#2563eb', bg: '#eff6ff' },
            { label: 'Pending', value: metrics.pending, color: '#d97706', bg: '#fffbeb' },
            { label: 'Overdue', value: metrics.overdue, color: '#dc2626', bg: '#fef2f2' },
            { label: 'Selesai', value: metrics.completed, color: '#16a34a', bg: '#f0fdf4' },
          ].map((m, i) => (
            <div key={i} style={{ background: m.bg, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* MAIN TABS */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #e2e8f0' }}>
          {[{ id: 'jobs', label: '📋 Jobs' }, { id: 'team', label: '👥 Team' }].map(tab => (
            <button key={tab.id} onClick={() => setMainTab(tab.id)}
              style={{ padding: '10px 20px', border: 'none', borderBottom: mainTab === tab.id ? '3px solid #ea580c' : '3px solid transparent', background: 'none', fontSize: 14, fontWeight: mainTab === tab.id ? 700 : 500, color: mainTab === tab.id ? '#ea580c' : '#64748b', cursor: 'pointer', marginBottom: -2 }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: JOBS */}
        {mainTab === 'jobs' && (
          <div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {[{ id: 'unassigned', label: `🔴 Belum Assign (${unassignedJobs.length})` }, { id: 'all', label: `📋 Semua Job (${filteredJobs.length})` }].map(tab => (
                <button key={tab.id} onClick={() => setActiveSection(tab.id)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: activeSection === tab.id ? '#1e293b' : '#e2e8f0', color: activeSection === tab.id ? 'white' : '#475569' }}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ background: 'white', borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Cari Client</label>
                  <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Nama client..."
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Status</label>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                    <option value="">Semua Status</option>
                    <option value="not_started">⚪ Belum Mula</option>
                    <option value="in_progress">🔵 Dalam Proses</option>
                    <option value="pending_client">🟡 Pending Client</option>
                    <option value="pending_authority">🟠 Pending LHDN</option>
                    <option value="kiv">📌 KIV</option>
                    <option value="completed">✅ Selesai</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Division</label>
                  <select value={filterDiv} onChange={e => setFilterDiv(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                    <option value="">Semua Division</option>
                    <option value="TAX">TAX</option>
                    <option value="ACCOUNT">ACCOUNT</option>
                    <option value="ADVISORY">ADVISORY</option>
                  </select>
                </div>
              </div>
              {(searchText || filterStatus || filterDiv) && (
                <button onClick={() => { setSearchText(''); setFilterStatus(''); setFilterDiv('') }}
                  style={{ marginTop: 10, background: '#fee2e2', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
                  ✕ Clear Filter
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(activeSection === 'unassigned' ? unassignedJobs : filteredJobs).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', background: 'white', borderRadius: 12 }}>
                  <div style={{ fontSize: 40 }}>{activeSection === 'unassigned' ? '🎉' : '📭'}</div>
                  <p>{activeSection === 'unassigned' ? 'Semua job dah assign!' : 'Tiada job dijumpai'}</p>
                </div>
              ) : (activeSection === 'unassigned' ? unassignedJobs : filteredJobs).map(job => {
                const isOverdue = job.due_date && job.due_date < today && job.status !== 'completed'
                const divStyle = DIV_COLORS[job.division] || { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' }
                const daysSinceCreate = job.created_at ? Math.floor((new Date() - new Date(job.created_at)) / 86400000) : 0
                return (
                  <div key={job.id} onClick={() => openJobModal(job)}
                    style={{ background: isOverdue ? '#fff5f5' : 'white', borderRadius: 12, padding: 16, border: `1px solid ${isOverdue ? '#fecaca' : '#e2e8f0'}`, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{job.clients?.company_name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: divStyle.bg, color: divStyle.color, border: `1px solid ${divStyle.border}` }}>{job.division}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: (STATUS_COLORS[job.status] || '#94a3b8') + '20', color: STATUS_COLORS[job.status] || '#94a3b8' }}>{STATUS_LABELS[job.status] || 'Belum Assign'}</span>
                          {isOverdue && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626' }}>⚠️ OVERDUE</span>}
                          {!job.assigned_exec && daysSinceCreate >= 3 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef2f2', color: '#dc2626' }}>🔴 {daysSinceCreate} hari belum assign!</span>}
                        </div>
                        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>{job.invoice_number} • {job.service_type}{job.financial_year_end ? ` • FYE: ${job.financial_year_end}` : ''}{job.financial_year_end ? ` • FYE: ${job.financial_year_end}` : ''}{job.financial_year_end ? ` • FYE: ${job.financial_year_end}` : ''}</p>
                        {job.invoice_value && <p style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', margin: '0 0 4px' }}>RM {Number(job.invoice_value).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}</p>}
                        {job.job_description && <p style={{ fontSize: 12, color: '#475569', margin: '4px 0', background: '#fffbeb', padding: '6px 10px', borderRadius: 6, borderLeft: '3px solid #f59e0b' }}>📋 {job.job_description}</p>}
                        <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#64748b', flexWrap: 'wrap' }}>
                          <span>👤 Exec: <strong style={{ color: '#1e293b' }}>{job.exec_name || '—'}</strong></span>
                          <span>🔍 Reviewer: <strong style={{ color: '#1e293b' }}>{job.reviewer_name || '—'}</strong></span>
                          <span>📅 Due: <strong style={{ color: isOverdue ? '#dc2626' : '#1e293b' }}>{job.due_date ? new Date(job.due_date).toLocaleDateString('ms-MY') : '—'}</strong></span>
                          <span>⏱️ Budget: <strong style={{ color: '#1e293b' }}>{job.budgeted_hours || 0} jam</strong></span>
                        </div>
                      </div>
                      <button onClick={e => openAssign(job, e)}
                        style={{ marginLeft: 12, padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: job.assigned_exec ? '#16a34a' : '#dc2626', color: 'white', whiteSpace: 'nowrap' }}>
                        {job.assigned_exec ? '✏️ Edit' : '👤 Assign'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB: TEAM */}
        {mainTab === 'team' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Filter Staff:</label>
              <select value={teamFilterStaff} onChange={e => setTeamFilterStaff(e.target.value)}
                style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}>
                <option value="">Semua Staff</option>
                {teamStats.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {filteredTeamStats.map(staff => (
                <div key={staff.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', margin: 0 }}>{staff.full_name}</p>
                        <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>{staff.division} • {staff.role}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6', margin: 0 }}>{staff.hoursThisMonth}</p>
                        <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>jam bulan ini</p>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 18, fontWeight: 800, color: '#2563eb', margin: 0 }}>{staff.activeJobs}</p>
                      <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>Job Aktif</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', margin: 0 }}>{staff.overdueJobs}</p>
                      <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>Overdue</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b', margin: 0 }}>{staff.pendingJobs}</p>
                      <p style={{ fontSize: 10, color: '#64748b', margin: 0 }}>Pending</p>
                    </div>
                  </div>
                  <div style={{ padding: '10px 16px' }}>
                    <button onClick={async () => { setSelectedStaff(selectedStaff?.id === staff.id ? null : staff); if (selectedStaff?.id !== staff.id) await loadStaffTimesheets(staff.id) }}
                      style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                      {selectedStaff?.id === staff.id ? '▲ Tutup Timesheet' : '▼ Lihat Timesheet Bulan Ini'}
                    </button>
                    {selectedStaff?.id === staff.id && (
                      <div style={{ marginTop: 10 }}>
                        {loadingStaffTS ? <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Memuatkan...</p> :
                          staffTimesheets.length === 0 ? <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>Tiada log bulan ini</p> :
                          staffTimesheets.map(ts => (
                            <div key={ts.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                              <div>
                                <span style={{ color: '#64748b' }}>{ts.log_date}</span>
                                <span style={{ color: '#94a3b8', marginLeft: 6 }}>{ts.jobs?.clients?.company_name || '-'}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <span style={{ fontWeight: 700, color: '#3b82f6' }}>{ts.hours_logged} jam</span>
                                {ts.note && <span style={{ color: '#94a3b8' }}>{ts.note.slice(0, 20)}...</span>}
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* JOB DETAIL MODAL */}
      {selectedJob && !assigning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, overflow: 'auto' }} onClick={e => { if (e.target === e.currentTarget) setSelectedJob(null) }}>
          <div style={{ background: 'white', minHeight: '100vh', maxWidth: 800, margin: '0 auto' }}>
            <div style={{ background: '#1e293b', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selectedJob.clients?.company_name}</h2>
                <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>{selectedJob.invoice_number} • {selectedJob.service_type}</p>
              </div>
              <button onClick={() => setSelectedJob(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '8px 16px', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>✕ Tutup</button>
            </div>
            <div style={{ borderBottom: '2px solid #f1f5f9', padding: '0 20px', background: 'white', display: 'flex', gap: 4 }}>
              {[{ id: 'detail', label: '📋 Detail' }, { id: 'instructions', label: `📢 Instructions (${instructions.length})` }, { id: 'timesheet', label: '⏱️ Timesheet' }, { id: 'history', label: '🕐 History' }].map(tab => (
                <button key={tab.id} onClick={() => setModalTab(tab.id)}
                  style={{ background: 'none', border: 'none', borderBottom: modalTab === tab.id ? '3px solid #3b82f6' : '3px solid transparent', padding: '14px 14px', cursor: 'pointer', fontSize: 13, fontWeight: modalTab === tab.id ? 700 : 500, color: modalTab === tab.id ? '#3b82f6' : '#64748b', marginBottom: -2 }}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div style={{ padding: 20 }}>

              {/* DETAIL TAB */}
              {modalTab === 'detail' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Invoice Value', value: `RM ${(selectedJob.invoice_value || 0).toLocaleString('ms-MY', { minimumFractionDigits: 2 })}`, color: '#16a34a' },
                      { label: 'Due Date', value: selectedJob.due_date ? new Date(selectedJob.due_date).toLocaleDateString('ms-MY') : '-', color: '#3b82f6' },
                      { label: 'Budget Hours', value: `${selectedJob.budgeted_hours || 0} jam`, color: '#f59e0b' },
                      { label: 'Jam Logged', value: `${jobDetail?.totalHours || 0} jam`, color: '#8b5cf6' },
                    ].map((c, i) => (
                      <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{c.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{c.value}</div>
                      </div>
                    ))}
                  </div>
                  {selectedJob.job_description && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: '#92400e', margin: '0 0 6px' }}>📌 SKOP KERJA</p>
                      <p style={{ fontSize: 14, color: '#1e293b', margin: 0, lineHeight: 1.6 }}>{selectedJob.job_description}</p>
                    </div>
                  )}
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', margin: '0 0 10px' }}>👥 TEAM</p>
                    {[
                      { role: 'EXEC', name: jobDetail?.execName, hours: jobDetail?.execHours, color: '#3b82f6' },
                      { role: 'REVIEWER', name: jobDetail?.reviewerName, hours: jobDetail?.reviewerHours, color: '#10b981' },
                      jobDetail?.deName && { role: 'DATA ENTRY', name: jobDetail?.deName, hours: jobDetail?.deHours, color: '#8b5cf6' },
                    ].filter(Boolean).map((t, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: 12, color: t.color, fontWeight: 700 }}>{t.role}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{t.name || '—'}</span>
                        <span style={{ fontSize: 12, color: '#64748b' }}>{t.hours?.toFixed(1) || 0} jam</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={e => openAssign(selectedJob, e)} style={{ width: '100%', background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    ✏️ Edit Assignment & Due Date
                  </button>
                </div>
              )}

              {/* INSTRUCTIONS TAB */}
              {modalTab === 'instructions' && (
                <div>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: '0 0 10px' }}>📤 Hantar Instruction Baru</p>
                    <textarea value={newInstruction} onChange={e => setNewInstruction(e.target.value)} placeholder="Tulis instruction untuk staff..." rows={3}
                      style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', resize: 'vertical', marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <select value={newUrgency} onChange={e => setNewUrgency(e.target.value)}
                        style={{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}>
                        <option value="normal">Normal</option>
                        <option value="urgent">🟡 Urgent</option>
                        <option value="kritikal">🔴 Kritikal</option>
                      </select>
                      <button onClick={sendInstruction} disabled={sendingInstr}
                        style={{ flex: 1, background: sendingInstr ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: sendingInstr ? 'not-allowed' : 'pointer' }}>
                        {sendingInstr ? '⏳ Menghantar...' : '📤 Hantar'}
                      </button>
                    </div>
                  </div>
                  {instructions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}><div style={{ fontSize: 32 }}>📭</div><p>Tiada instruction lagi</p></div>
                  ) : instructions.map(instr => (
                    <div key={instr.id} style={{ background: instr.urgency_level === 'kritikal' ? '#fef2f2' : instr.urgency_level === 'urgent' ? '#fffbeb' : '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 12, border: `1px solid ${instr.urgency_level === 'kritikal' ? '#fecaca' : instr.urgency_level === 'urgent' ? '#fde68a' : '#e2e8f0'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, background: instr.urgency_level === 'kritikal' ? '#dc2626' : instr.urgency_level === 'urgent' ? '#f59e0b' : '#64748b', color: 'white', padding: '2px 8px', borderRadius: 20 }}>{(instr.urgency_level || 'normal').toUpperCase()}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{instr.profiles?.full_name} • {new Date(instr.created_at).toLocaleDateString('ms-MY')}</span>
                      </div>
                      <p style={{ fontSize: 14, color: '#1e293b', margin: '0 0 10px', lineHeight: 1.6 }}>{instr.message}</p>
                      {(instr.instruction_replies || []).length > 0 && (
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', margin: '0 0 6px' }}>REPLIES:</p>
                          {instr.instruction_replies.map(r => (
                            <div key={r.id} style={{ background: 'white', borderRadius: 6, padding: '6px 10px', marginBottom: 4, fontSize: 12 }}>
                              <span style={{ fontWeight: 600, color: '#3b82f6' }}>{r.profiles?.full_name}: </span>
                              <span style={{ color: '#475569' }}>{r.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TIMESHEET TAB */}
              {modalTab === 'timesheet' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Total Jam', value: `${jobDetail?.totalHours || 0} jam`, color: '#8b5cf6' },
                      { label: 'Budget', value: `${selectedJob.budgeted_hours || 0} jam`, color: '#f59e0b' },
                      { label: 'Baki', value: `${Math.max(0, (selectedJob.budgeted_hours || 0) - (jobDetail?.totalHours || 0))} jam`, color: '#10b981' },
                      { label: 'Guna', value: `${selectedJob.budgeted_hours ? Math.round((jobDetail?.totalHours || 0) / selectedJob.budgeted_hours * 100) : 0}%`, color: (jobDetail?.totalHours || 0) > (selectedJob.budgeted_hours || 0) * 0.8 ? '#dc2626' : '#3b82f6' },
                    ].map((c, i) => (
                      <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.value}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{c.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', margin: '0 0 10px' }}>JAM PER AHLI TEAM</p>
                    {[
                      { role: 'EXEC', name: jobDetail?.execName, hours: jobDetail?.execHours, color: '#3b82f6' },
                      { role: 'REVIEWER', name: jobDetail?.reviewerName, hours: jobDetail?.reviewerHours, color: '#10b981' },
                      jobDetail?.deName && { role: 'DATA ENTRY', name: jobDetail?.deName, hours: jobDetail?.deHours, color: '#8b5cf6' },
                    ].filter(Boolean).map((t, i) => (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: t.color, fontWeight: 700 }}>{t.role} — {t.name || '—'}</span>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{(t.hours || 0).toFixed(1)} jam</span>
                        </div>
                        <div style={{ background: '#e2e8f0', borderRadius: 4, height: 6 }}>
                          <div style={{ background: t.color, height: '100%', borderRadius: 4, width: `${jobDetail?.totalHours ? Math.min(100, (t.hours || 0) / jobDetail.totalHours * 100) : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', margin: '0 0 10px' }}>LOG BY TARIKH</p>
                  {jobTimesheets.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Tiada log lagi</p> :
                    jobTimesheets.map(ts => (
                      <div key={ts.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                        <span style={{ color: '#64748b' }}>{ts.log_date}</span>
                        <span style={{ color: '#475569' }}>{ts.profiles?.full_name}</span>
                        <span style={{ fontWeight: 700, color: '#3b82f6' }}>{ts.hours_logged} jam</span>
                        <span style={{ color: '#94a3b8', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ts.note || '-'}</span>
                      </div>
                    ))
                  }
                </div>
              )}

              {/* HISTORY TAB */}
              {modalTab === 'history' && (
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>📅 History Tukar Due Date</p>
                  {dueDateHistory.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>Tiada perubahan due date</p>
                  ) : dueDateHistory.map((h, i) => (
                    <div key={i} style={{ background: '#fffbeb', borderRadius: 10, padding: 12, marginBottom: 8, border: '1px solid #fde68a' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                          {h.old_due_date ? new Date(h.old_due_date).toLocaleDateString('ms-MY') : 'Tiada'} → {new Date(h.new_due_date).toLocaleDateString('ms-MY')}
                        </span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(h.created_at).toLocaleDateString('ms-MY')}</span>
                      </div>
                      <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Oleh: {h.changed_by_name} {h.reason ? `— ${h.reason}` : ''}</p>
                    </div>
                  ))}

                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: '20px 0 12px' }}>📆 History Tukar FYE</p>
                  {fyeHistory.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 20 }}>Tiada perubahan FYE</p>
                  ) : fyeHistory.map((h, i) => (
                    <div key={i} style={{ background: '#eff6ff', borderRadius: 10, padding: 12, marginBottom: 8, border: '1px solid #bfdbfe' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>
                          {h.old_fye || 'Tiada'} → {h.new_fye}
                        </span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(h.created_at).toLocaleDateString('ms-MY')}</span>
                      </div>
                      <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Oleh: {h.changed_by_name} {h.reason ? `— ${h.reason}` : ''}</p>
                    </div>
                  ))}
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', margin: '20px 0 12px' }}>👥 History Assignment</p>
                  {assignHistory.length === 0 ? (
                    <p style={{ color: '#94a3b8', fontSize: 13 }}>Tiada history assignment</p>
                  ) : assignHistory.map((h, i) => (
                    <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{h.month_year}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(h.assigned_at).toLocaleDateString('ms-MY')}</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#475569' }}>
                        <span>👤 Exec: <strong>{h.exec_name || '—'}</strong></span>
                        <span style={{ marginLeft: 16 }}>🔍 Reviewer: <strong>{h.reviewer_name || '—'}</strong></span>
                        {h.data_entry_name && <span style={{ marginLeft: 16 }}>📝 DE: <strong>{h.data_entry_name}</strong></span>}
                      </div>
                      {h.ended_at && <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>Tamat: {new Date(h.ended_at).toLocaleDateString('ms-MY')}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {assigning && selectedJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 16, overflow: 'auto' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 500 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 4px' }}>Assign Staff</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>{selectedJob.clients?.company_name} — {selectedJob.invoice_number}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Exec (Wajib)</label>
                <select value={assignData.assigned_exec} onChange={e => setAssignData({...assignData, assigned_exec: e.target.value})}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                  <option value="">-- Pilih Exec --</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Reviewer (kosong = sama dengan Exec)</label>
                <select value={assignData.assigned_reviewer} onChange={e => setAssignData({...assignData, assigned_reviewer: e.target.value})}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                  <option value="">-- Sama dengan Exec --</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="hasDE" checked={assignData.has_de} onChange={e => setAssignData({...assignData, has_de: e.target.checked})} style={{ width: 16, height: 16 }} />
                <label htmlFor="hasDE" style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Ada Data Entry?</label>
              </div>
              {assignData.has_de && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Data Entry</label>
                  <select value={assignData.assigned_de} onChange={e => setAssignData({...assignData, assigned_de: e.target.value})}
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
                    <option value="">-- Pilih Data Entry --</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Budgeted Hours</label>
                <input type="number" value={assignData.budgeted_hours} onChange={e => setAssignData({...assignData, budgeted_hours: Number(e.target.value)})}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Due Date</label>
                <input type="date" value={assignData.due_date} onChange={e => setAssignData({...assignData, due_date: e.target.value})}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              {assignData.due_date && assignData.due_date !== selectedJob.due_date && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Sebab Tukar Due Date</label>
                  <input type="text" value={assignData.due_date_reason} onChange={e => setAssignData({...assignData, due_date_reason: e.target.value})}
                    placeholder="Contoh: Client minta extend, audit delay..."
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #fde68a', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', background: '#fffbeb' }} />
                </div>
              )}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Financial Year End</label>
                <input type="text" value={assignData.financial_year_end} onChange={e => setAssignData({...assignData, financial_year_end: e.target.value})}
                  placeholder="Contoh: 31-Dec-24"
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              {assignData.financial_year_end && assignData.financial_year_end !== selectedJob.financial_year_end && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Sebab Tukar FYE</label>
                  <input type="text" value={assignData.fye_reason} onChange={e => setAssignData({...assignData, fye_reason: e.target.value})}
                    placeholder="Contoh: Client tukar FYE..."
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #fde68a', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', background: '#fffbeb' }} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={saveAssignment} style={{ flex: 1, background: '#2563eb', color: 'white', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>✅ Simpan</button>
              <button onClick={() => setAssigning(false)} style={{ flex: 1, background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}