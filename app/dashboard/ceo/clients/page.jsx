'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function ClientManagement() {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    company_name: '',
    client_type: 'company',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    address: ''
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => { fetchClients() }, [])

  async function fetchClients() {
    setLoading(true)
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('company_name')
    setClients(data || [])
    setLoading(false)
  }

  async function handleAddClient(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('clients').insert([formData])
    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('Client added successfully!')
      setFormData({ company_name: '', client_type: 'company', contact_person: '', contact_email: '', contact_phone: '', address: '' })
      setShowForm(false)
      fetchClients()
    }
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  const companies = clients.filter(c => c.client_type === 'company' || !c.client_type)
  const individuals = clients.filter(c => c.client_type === 'individual')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">AMACC PMS</h1>
          <p className="text-blue-200 text-sm">Client Management</p>
        </div>
        <button onClick={() => router.push('/dashboard/ceo')} className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-medium">
          ← Back
        </button>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-gray-800">All Clients ({clients.length})</h2>
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Add Client
          </button>
        </div>

        {message && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm">{message}</div>}

        {showForm && (
          <div className="bg-white p-6 rounded-xl shadow-sm border mb-6">
            <h3 className="font-bold text-gray-800 mb-4">Add New Client</h3>
            <form onSubmit={handleAddClient} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Type</label>
                <select
                  value={formData.client_type}
                  onChange={(e) => setFormData({...formData, client_type: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="company">Company</option>
                  <option value="individual">Individual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.client_type === 'company' ? 'Company Name' : 'Individual Name'}
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Client'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? <p className="text-gray-500">Loading...</p> : (
          <div className="space-y-6">
            {/* Companies */}
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">🏢 Companies ({companies.length})</h3>
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Company Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Contact Person</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {companies.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-3 text-gray-400">No companies yet.</td></tr>
                    ) : companies.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 font-medium">{c.company_name}</td>
                        <td className="px-4 py-3 text-gray-600">{c.contact_person || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{c.contact_email || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{c.contact_phone || '-'}</td>
                        <td className="px-4 py-3"><span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">Active</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Individuals */}
            <div>
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">👤 Individuals ({individuals.length})</h3>
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Individual Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Contact Person</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {individuals.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-3 text-gray-400">No individuals yet.</td></tr>
                    ) : individuals.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 font-medium">{c.company_name}</td>
                        <td className="px-4 py-3 text-gray-600">{c.contact_person || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{c.contact_email || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{c.contact_phone || '-'}</td>
                        <td className="px-4 py-3"><span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs">Active</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}