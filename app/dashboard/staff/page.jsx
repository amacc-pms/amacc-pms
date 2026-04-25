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
    
    // Check ada jobs aktif tak — kalau takde, skip block
    const { data: activeJobs } = await supabase
      .from('jobs')
      .select('id')
      .or(`assigned_exec.eq.${prof.id},assigned_reviewer.eq.${prof.id},assigned_de.eq.${prof.id}`)
      .not('status', 'eq', 'completed')
      .limit(1)
    
    if (!activeJobs || activeJobs.length === 0) return // Staff baru, skip block
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

    // Kira hari missed (exclude Saturday & Sunday)
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

    // Kira daily rate berdasarkan invoice value jobs aktif
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
    // Kalau tiada jobs aktif, unearned = 0
    setUnearnedRevenue({ 
      thisMonth: activeJobs && activeJobs.length > 0 ? unearnedThisMonth : 0, 
      allTime: activeJobs && activeJobs.length > 0 ? unearnedThisMonth : 0, 
      missedDays: activeJobs && activeJobs.length > 0 ? missedDays : 0 
    })
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
            <button onClick={() => router.push('/dashboard/staff/osm')} className="bg-purple-500 text-white px-3 py-1 rounded text-sm font-medium hover:bg-purple-400">📋 OSM</button>Log Keluar
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
            {aktifJobs.length === 0 ? <div className="bg-white rounded-lg border p-8 text-center text-gray-400">Tiada jobs aktif</div>
            : aktifJobs.map(job => (
              <div key={job.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-gray-800">{job.clients?.company_name}</h3>
                    <p className="text-sm text-gray-500">{job.invoice_number} • {job.service_type}</p>
                    <p className="text-green-600 font-bold">RM {Number(job.invoice_value).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500">Due: {job.due_date ? new Date(job.due_date).toLocaleDateString('ms-MY') : '-'}</span>
                    {job.due_date && new Date(job.due_date) < new Date() && <div className="text-xs text-red-500 font-medium">⚠️ OVERDUE</div>}
                  </div>
                </div>
                {job.job_description && <div className="bg-gray-50 rounded p-2 text-sm text-gray-600">📋 {job.job_description}</div>}
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
            {kivJobs.length === 0 ? <div className="bg-white rounded-lg border p-8 text-center text-gray-400">Tiada jobs KIV</div>
            : kivJobs.map(job => (
              <div key={job.id} className="bg-white rounded-lg border border-yellow-200 p-4">
                <h3 className="font-bold text-gray-800">{job.clients?.company_name}</h3>
                <p className="text-sm text-gray-500">{job.invoice_number} • {job.service_type}</p>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">KIV</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}