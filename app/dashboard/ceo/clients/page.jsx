'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ClientManagement() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    address: '',
      client_type: 'company'
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    fetchClients()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || !['ceo', 'assigner'].includes(profile.role)) router.push('/')
  }

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('company_name')
    if (data) setClients(data)
    setLoading(false)
  }

  const handleAddClient = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('clients')
      .insert({
        ...formData,
        created_by: user.id
      })

    if (error) {
      setMessage('❌ Error: ' + error.message)
      setSaving(false)
      return
    }

    setMessage('✅ Klien berjaya ditambah!')
    setFormData({
      company_name: '',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      address: ''
    })
    setShowForm(false)
    fetchClients()
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">AMACC PMS</h1>
          <p className="text-blue-200 text-sm">Client Management</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/ceo')}
          className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg text-sm"
        >
          ← Balik Dashboard
        </button>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            Senarai Klien ({clients.length})
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            + Tambah Klien
          </button>
        </div>

        {message && (
          <div className={`p-3 rounded-lg mb-4 ${message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        {showForm && (
          <div className="bg-white p-6 rounded-xl shadow-sm border mb-6">
            <h3 className="font-bold text-gray-800 mb-4">Tambah Klien Baru</h3>
            <form onSubmit={handleAddClient} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Syarikat *</label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="md:col-span-2">
  <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Klien</label>
  <select
    value={formData.client_type}
    onChange={(e) => setFormData({...formData, client_type: e.target.value})}
    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option value="company">Syarikat (Company)</option>
    <option value="individual">Individu (Personal)</option>
  </select>
</div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Contact Person</label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Telefon</label>
                <input
                  type="text"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Klien'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : clients.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
            <div className="text-5xl mb-4">🏢</div>
            <p className="text-gray-500">Belum ada klien. Klik "+ Tambah Klien" untuk mula.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nama Syarikat</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Contact Person</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Telefon</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{c.company_name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.contact_person || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.contact_email || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.contact_phone || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {c.is_active ? 'Aktif' : 'Tidak Aktif'}
                      </span>
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