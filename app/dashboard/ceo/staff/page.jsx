'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function StaffManagement() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [importing, setImporting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editStaff, setEditStaff] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '', email: '', phone: '', role: 'staff', division: '', designation: ''
  })
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchStaff()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'ceo') router.push('/')
  }

  const fetchStaff = async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    if (data) setStaff(data)
    setLoading(false)
  }

  const handleImportCSV = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setMessage('⏳ Sedang import staff...')
    const text = await file.text()
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    let success = 0, failed = 0, errors = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const values = line.split(',').map(v => v.trim())
      const row = {}
      headers.forEach((h, idx) => { row[h] = values[idx] || '' })
      if (!row.name) continue
      try {
        const { data: authData } = await fetch('/api/create-staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: row.email, name: row.name, phone: row.phone || '', designation: row.designation || '', role: row.role || 'staff', division: row.division || '', status: row.status || 'active' })
        }).then(r => r.json())
        if (authData?.error) { failed++; errors.push(`${row.name}: ${authData.error}`) }
        else success++
      } catch (err) { failed++; errors.push(`${row.name}: ${err.message}`) }
    }
    await fetchStaff()
    setImporting(false)
    setMessage(errors.length > 0 ? `✅ ${success} berjaya | ❌ ${failed} gagal` : `✅ ${success} staff berjaya diimport!`)
  }

  const handleSaveStaff = async () => {
    if (!formData.full_name || !formData.email) {
      setMessage('❌ Nama dan email wajib diisi!')
      return
    }
    setSaving(true)
    setMessage('')
    if (editStaff) {
      const { error } = await supabase.from('profiles').update({
        full_name: formData.full_name,
        phone: formData.phone || null,
        role: formData.role,
        division: formData.division || null,
        designation: formData.designation || null
      }).eq('id', editStaff.id)
      if (error) setMessage('❌ Error: ' + error.message)
      else { setMessage('✅ Staff berjaya dikemaskini!'); setShowForm(false); setEditStaff(null); fetchStaff() }
    } else {
      const { data, error } = await fetch('/api/create-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, name: formData.full_name, phone: formData.phone, designation: formData.designation, role: formData.role, division: formData.division, status: 'active' })
      }).then(r => r.json())
      if (error || data?.error) setMessage('❌ Error: ' + (error || data?.error))
      else { setMessage('✅ Staff berjaya ditambah!'); setShowForm(false); fetchStaff() }
    }
    setSaving(false)
  }

  const handleEdit = (s) => {
    setEditStaff(s)
    setFormData({ full_name: s.full_name, email: s.email, phone: s.phone || '', role: s.role, division: s.division || '', designation: s.designation || s.position || '' })
    setShowForm(true)
  }

  const handleDeactivate = async (s) => {
    const action = s.is_active ? 'deactivate' : 'activate'
    const confirm = window.confirm(`${action === 'deactivate' ? 'Deactivate' : 'Activate semula'} ${s.full_name}?`)
    if (!confirm) return
    const { error } = await supabase.from('profiles').update({ is_active: !s.is_active }).eq('id', s.id)
    if (error) setMessage('❌ Error: ' + error.message)
    else { setMessage(`✅ ${s.full_name} dah ${action === 'deactivate' ? 'dideactivate' : 'diactivate semula'}!`); fetchStaff() }
  }

  const getRoleBadge = (role) => {
    const styles = { ceo: 'bg-purple-100 text-purple-700', hoo: 'bg-blue-100 text-blue-700', assigner: 'bg-green-100 text-green-700', staff: 'bg-gray-100 text-gray-700' }
    return styles[role] || 'bg-gray-100 text-gray-700'
  }

  const getDivisionBadge = (division) => {
    const styles = { tax: 'bg-orange-100 text-orange-700', account: 'bg-blue-100 text-blue-700', accounting: 'bg-blue-100 text-blue-700', advisory: 'bg-green-100 text-green-700', crm: 'bg-pink-100 text-pink-700', support: 'bg-yellow-100 text-yellow-700' }
    return styles[division] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">AMACC PMS</h1>
          <p className="text-blue-200 text-sm">Staff Management</p>
        </div>
        <Link href="/dashboard/ceo" className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg text-sm">← Balik Dashboard</Link>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Senarai Staff ({staff.length})</h2>
          <div className="flex gap-3">
            <button onClick={() => { setShowForm(true); setEditStaff(null); setFormData({ full_name: '', email: '', phone: '', role: 'staff', division: '', designation: '' }) }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              + Tambah Staff
            </button>
            <label className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${importing ? 'bg-gray-300 text-gray-500' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
              {importing ? '⏳ Importing...' : '📂 Import CSV'}
              <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} disabled={importing} />
            </label>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg text-sm ${message.includes('❌') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-bold mb-4">{editStaff ? 'Edit Staff' : 'Tambah Staff Baru'}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Nama Penuh *</label>
                  <input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nama penuh" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Email *</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                    disabled={!!editStaff}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" placeholder="email@example.com" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Phone</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="01x-xxxxxxx" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Role *</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="staff">Staff</option>
                    <option value="hoo">HOO</option>
                    <option value="assigner">Assigner</option>
                    <option value="ceo">CEO</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Division</label>
                  <select value={formData.division} onChange={e => setFormData({...formData, division: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Pilih Division —</option>
                    <option value="tax">Tax</option>
                    <option value="account">Account</option>
                    <option value="advisory">Advisory</option>
                    <option value="crm">CRM</option>
                    <option value="support">Support</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Jawatan</label>
                  <input type="text" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})}
                    className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Contoh: Senior Executive" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={handleSaveStaff} disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button onClick={() => { setShowForm(false); setEditStaff(null) }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium">
                  Batal
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nama</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Phone</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Division</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map((s) => (
                  <tr key={s.id} className={`hover:bg-gray-50 ${!s.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{s.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.phone || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${getRoleBadge(s.role)}`}>{s.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      {s.division ? <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${getDivisionBadge(s.division)}`}>{s.division}</span> : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {s.is_active !== false ? 'Aktif' : 'Tidak Aktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(s)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">✏️ Edit</button>
                        <button onClick={() => handleDeactivate(s)}
                          className={`text-xs font-medium ${s.is_active !== false ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}>
                          {s.is_active !== false ? '🔴 Resign' : '🟢 Aktif'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}