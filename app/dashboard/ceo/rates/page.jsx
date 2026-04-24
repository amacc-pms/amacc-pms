'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function StaffRates() {
  const [profile, setProfile] = useState(null)
  const [staff, setStaff] = useState([])
  const [rates, setRates] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(null)
  const [formData, setFormData] = useState({ hourly_rate: '', effective_from: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => { checkAuth() }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profileData } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    if (!profileData || profileData.role !== 'ceo') { router.push('/'); return }
    setProfile(profileData)
    fetchData()
  }

  const fetchData = async () => {
    const { data: staffData } = await supabase
      .from('profiles')
      .select('id, full_name, role, division, position')
      .in('role', ['staff', 'hoo', 'assigner'])
      .order('full_name')

    if (staffData) {
      setStaff(staffData)
      
      const { data: ratesData } = await supabase
        .from('staff_rates')
        .select('*')
        .order('effective_from', { ascending: false })

      if (ratesData) {
        const grouped = {}
        ratesData.forEach(r => {
          if (!grouped[r.staff_id]) grouped[r.staff_id] = []
          grouped[r.staff_id].push(r)
        })
        setRates(grouped)
      }
    }
    setLoading(false)
  }

  const getCurrentRate = (staffId) => {
    const staffRates = rates[staffId] || []
    const today = new Date().toISOString().split('T')[0]
    const current = staffRates.find(r => 
      r.effective_from <= today && (!r.effective_to || r.effective_to >= today)
    )
    return current?.hourly_rate || null
  }

  const handleSetRate = async (staffId) => {
    if (!formData.hourly_rate || !formData.effective_from) {
      setMessage('❌ Sila isi semua field!')
      return
    }
    setSaving(true)
    setMessage('')

    const today = new Date().toISOString().split('T')[0]
    const effectiveFrom = formData.effective_from

    const staffRates = rates[staffId] || []
    const currentRate = staffRates.find(r => 
      r.effective_from <= today && (!r.effective_to || r.effective_to >= today)
    )

    if (currentRate) {
      const yesterday = new Date(effectiveFrom)
      yesterday.setDate(yesterday.getDate() - 1)
      await supabase
        .from('staff_rates')
        .update({ effective_to: yesterday.toISOString().split('T')[0] })
        .eq('id', currentRate.id)
    }

    const { error } = await supabase
      .from('staff_rates')
      .insert({
        staff_id: staffId,
        hourly_rate: parseFloat(formData.hourly_rate),
        effective_from: effectiveFrom,
        effective_to: null,
        created_by: profile.id
      })

    if (error) {
      setMessage('❌ Error: ' + error.message)
    } else {
      setMessage('✅ Rate berjaya disimpan!')
      setShowForm(null)
      setFormData({ hourly_rate: '', effective_from: '' })
      fetchData()
    }
    setSaving(false)
  }

  const getRoleBadge = (role) => {
    const badges = {
      hoo: 'bg-orange-100 text-orange-700',
      assigner: 'bg-purple-100 text-purple-700',
      staff: 'bg-blue-100 text-blue-700'
    }
    return badges[role] || 'bg-gray-100 text-gray-700'
  }

  if (!profile) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">AMACC PMS</h1>
          <p className="text-blue-200 text-sm">Staff Rates Management</p>
        </div>
        <button onClick={() => router.push('/dashboard/ceo')}
          className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg text-sm">
          ← Balik Dashboard
        </button>
      </div>

      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Kadar Kos Staff (Hourly Rate)</h2>
        <p className="text-gray-500 text-sm mb-6">Maklumat ini sulit — hanya CEO yang boleh lihat dan edit.</p>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        {loading ? <p className="text-gray-500">Loading...</p> : (
          <div className="space-y-3">
            {staff.map((s) => {
              const currentRate = getCurrentRate(s.id)
              const staffRates = rates[s.id] || []
              const isOpen = showForm === s.id

              return (
                <div key={s.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="p-4 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-800">{s.full_name}</p>
                      <div className="flex gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleBadge(s.role)}`}>
                          {s.role.toUpperCase()}
                        </span>
                        {s.division && <span className="text-xs text-gray-500">{s.division}</span>}
                        {s.position && <span className="text-xs text-gray-400">• {s.position}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        {currentRate ? (
                          <p className="font-semibold text-green-600">RM {Number(currentRate).toFixed(2)}/jam</p>
                        ) : (
                          <p className="text-sm text-red-400">Belum ada rate</p>
                        )}
                      </div>
                      <button
                        onClick={() => { setShowForm(isOpen ? null : s.id); setFormData({ hourly_rate: currentRate || '', effective_from: new Date().toISOString().split('T')[0] }) }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                        {isOpen ? 'Tutup' : currentRate ? 'Update Rate' : 'Set Rate'}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate (RM) <span className="text-red-500">*</span></label>
                          <input
                            type="number" min="0" step="0.50"
                            value={formData.hourly_rate}
                            onChange={(e) => setFormData({...formData, hourly_rate: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="50.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Effective From <span className="text-red-500">*</span></label>
                          <input
                            type="date"
                            value={formData.effective_from}
                            onChange={(e) => setFormData({...formData, effective_from: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => handleSetRate(s.id)} disabled={saving}
                          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                          {saving ? 'Menyimpan...' : '✅ Simpan Rate'}
                        </button>
                        <button onClick={() => setShowForm(null)}
                          className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 text-sm">
                          Batal
                        </button>
                      </div>

                      {staffRates.length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs font-medium text-gray-600 mb-2">📋 History Rate</p>
                          <div className="space-y-1">
                            {staffRates.map((r) => (
                              <div key={r.id} className="flex justify-between text-xs text-gray-500 bg-white rounded px-3 py-2">
                                <span>RM {Number(r.hourly_rate).toFixed(2)}/jam</span>
                                <span>{r.effective_from} → {r.effective_to || 'sekarang'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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