'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function TimesheetAlert() {
  const [profile, setProfile] = useState(null)
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState('')
  const [filterName, setFilterName] = useState('')
  const [filterPeriod, setFilterPeriod] = useState('today')
  const [unlocking, setUnlocking] = useState(null)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (!prof || !['hoo', 'ceo'].includes(prof.role)) { router.push('/'); return }
    setProfile(prof)
    setSelectedDate(yesterday)
    await loadTimesheetStatus(yesterday)
  }

  async function loadTimesheetStatus(checkDate) {
    setLoading(true)

    // Load semua staff
    const { data: allStaff } = await supabase
      .from('profiles')
      .select('id, full_name, role, division, is_blocked, blocked_since')
      .eq('role', 'staff')
      .order('full_name')

    if (!allStaff) { setLoading(false); return }

    // Load timesheet logs untuk tarikh tu
    const { data: logs } = await supabase
      .from('timesheets')
      .select('staff_id, hours_logged')
      .eq('log_date', checkDate)

    const loggedStaffIds = new Set(logs?.map(l => l.staff_id) || [])
    const hoursMap = {}
    logs?.forEach(l => {
      hoursMap[l.staff_id] = (hoursMap[l.staff_id] || 0) + Number(l.hours_logged)
    })

    // Mark setiap staff status
    const staffWithStatus = allStaff.map(staff => ({
      ...staff,
      hasLogged: loggedStaffIds.has(staff.id),
      totalHours: hoursMap[staff.id] || 0
    }))

    setStaffList(staffWithStatus)
    setLoading(false)
  }

  async function unlockStaff(staffId, staffName) {
    setUnlocking(staffId)
    await supabase.from('profiles').update({
      is_blocked: false,
      unblocked_by: profile.id,
      unblocked_at: new Date().toISOString(),
      unlock_reason: `Unlocked by HOO ${profile.full_name}`
    }).eq('id', staffId)

    await supabase.from('timesheet_unlocks').insert({
      staff_id: staffId,
      unlocked_by: profile.id,
      unlock_reason: `Manual unlock by ${profile.full_name}`,
      unlock_type: 'block',
      date_for: selectedDate
    })

    setMessage(`✅ ${staffName} dah di-unlock!`)
    setTimeout(() => setMessage(''), 3000)
    setUnlocking(null)
    await loadTimesheetStatus(selectedDate)
  }

  function getDateOptions() {
    const options = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.now() - i * 86400000)
      const val = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('ms-MY', { weekday: 'short', day: 'numeric', month: 'short' })
      options.push({ val, label })
    }
    return options
  }

  const filteredStaff = staffList.filter(s => 
    filterName === '' || s.full_name.toLowerCase().includes(filterName.toLowerCase())
  )

  const notLoggedStaff = filteredStaff.filter(s => !s.hasLogged)
  const loggedStaff = filteredStaff.filter(s => s.hasLogged)
  const complianceRate = staffList.length > 0 ? Math.round((loggedStaff.length / staffList.length) * 100) : 0

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-gray-500">Loading...</div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-orange-500 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <div className="font-bold text-lg">AMACC PMS</div>
          <div className="text-sm opacity-80">Timesheet Alert Dashboard</div>
        </div>
        <button onClick={() => router.push('/dashboard/hoo')} className="bg-white text-orange-500 px-3 py-1 rounded text-sm font-medium">← Balik</button>
      </nav>

      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">⏰ Timesheet Alert — Staff Belum Log</h1>

        {message && <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-green-700">{message}</div>}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-3xl font-bold text-red-500">{notLoggedStaff.length}</div>
            <div className="text-sm text-gray-500">Belum Log</div>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-3xl font-bold text-green-500">{loggedStaff.length}</div>
            <div className="text-sm text-gray-500">Dah Log</div>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className={`text-3xl font-bold ${complianceRate >= 80 ? 'text-green-500' : complianceRate >= 50 ? 'text-orange-500' : 'text-red-500'}`}>
              {complianceRate}%
            </div>
            <div className="text-sm text-gray-500">Compliance Rate</div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-lg border p-4 mb-6 flex gap-4 flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-gray-500 mb-1">Tarikh</label>
            <select
              value={selectedDate}
              onChange={e => { setSelectedDate(e.target.value); loadTimesheetStatus(e.target.value) }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {getDateOptions().map(d => (
                <option key={d.val} value={d.val}>{d.label} {d.val === yesterday ? '(Semalam)' : d.val === today ? '(Hari Ini)' : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-gray-500 mb-1">Cari Nama</label>
            <input
              type="text"
              placeholder="Taip nama staff..."
              value={filterName}
              onChange={e => setFilterName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Belum Log */}
        <div className="bg-white rounded-lg border border-red-200 overflow-hidden mb-6">
          <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex justify-between items-center">
            <h2 className="font-semibold text-red-700">🔴 Belum Log — {notLoggedStaff.length} orang</h2>
            <span className="text-xs text-red-500">Perlu tindakan</span>
          </div>
          {notLoggedStaff.length === 0 ? (
            <div className="p-6 text-center text-gray-400">✅ Semua staff dah log!</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 text-gray-600">Nama Staff</th>
                  <th className="text-left px-4 py-3 text-gray-600">Division</th>
                  <th className="text-left px-4 py-3 text-gray-600">Status Block</th>
                  <th className="text-left px-4 py-3 text-gray-600">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {notLoggedStaff.map(staff => (
                  <tr key={staff.id} className="hover:bg-red-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{staff.full_name}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{staff.division || '-'}</td>
                    <td className="px-4 py-3">
                      {staff.is_blocked
                        ? <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">🔒 Blocked</span>
                        : <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">⚠️ Belum Log</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {staff.is_blocked && (
                        <button
                          onClick={() => unlockStaff(staff.id, staff.full_name)}
                          disabled={unlocking === staff.id}
                          className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50"
                        >
                          {unlocking === staff.id ? 'Unlocking...' : '🔓 Unlock'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Dah Log */}
        <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
          <div className="px-4 py-3 bg-green-50 border-b border-green-200">
            <h2 className="font-semibold text-green-700">✅ Dah Log — {loggedStaff.length} orang</h2>
          </div>
          {loggedStaff.length === 0 ? (
            <div className="p-6 text-center text-gray-400">Tiada staff yang log lagi</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 text-gray-600">Nama Staff</th>
                  <th className="text-left px-4 py-3 text-gray-600">Division</th>
                  <th className="text-right px-4 py-3 text-gray-600">Total Jam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loggedStaff.map(staff => (
                  <tr key={staff.id} className="hover:bg-green-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{staff.full_name}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{staff.division || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">{staff.totalHours} jam</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}