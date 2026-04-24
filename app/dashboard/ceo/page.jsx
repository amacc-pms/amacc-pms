'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CEODashboard() {
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ total: 0, inProgress: 0, completed: 0, overdue: 0 })
  const router = useRouter()

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      if (!data || data.role !== 'ceo') { router.push('/'); return }
      setProfile(data)
      fetchStats()
    }
    getProfile()
  }, [])

  const fetchStats = async () => {
    const { data: jobs } = await supabase.from('jobs').select('status, due_date')
    if (!jobs) return
    const today = new Date().toISOString().split('T')[0]
    setStats({
      total: jobs.length,
      inProgress: jobs.filter(j => j.status === 'in_progress').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      overdue: jobs.filter(j => j.due_date && j.due_date < today && j.status !== 'completed').length
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  const menuItems = [
    { href: '/dashboard/ceo/staff', icon: '👥', title: 'Staff Management', desc: 'Urus staff & roles' },
    { href: '/dashboard/ceo/rates', icon: '💰', title: 'Staff Rates', desc: 'Kadar kos staff (sulit)' },
    { href: '/dashboard/ceo/jobs', icon: '📋', title: 'All Jobs', desc: 'Lihat semua jobs' },
    { href: '/dashboard/ceo/revenue', icon: '📊', title: 'Revenue & Cost', desc: 'Revenue, cost & profit' },
    { href: '/dashboard/ceo/timesheets', icon: '⏱️', title: 'Timesheet', desc: 'Monitor semua timesheet' },
    { href: '/dashboard/ceo/clients', icon: '🏢', title: 'Clients', desc: 'Senarai klien' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-blue-600 text-white px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">AMACC PMS</h1>
          <p className="text-blue-200 text-sm">CEO Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">{profile.full_name}</span>
          <button onClick={handleLogout}
            className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg text-sm">
            Log Keluar
          </button>
        </div>
      </div>

      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Selamat Datang, {profile.full_name}!
        </h2>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <p className="text-sm text-gray-500">Total Jobs</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <p className="text-sm text-gray-500">In Progress</p>
            <p className="text-3xl font-bold text-yellow-500 mt-1">{stats.inProgress}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <p className="text-sm text-gray-500">Completed</p>
            <p className="text-3xl font-bold text-green-500 mt-1">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <p className="text-sm text-gray-500">Overdue</p>
            <p className="text-3xl font-bold text-red-500 mt-1">{stats.overdue}</p>
          </div>
        </div>

        {/* Menu */}
        <div className="grid grid-cols-3 gap-4">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href}
              className="bg-white p-6 rounded-xl shadow-sm border hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
              <div className="text-3xl mb-2">{item.icon}</div>
              <h3 className="font-semibold text-gray-800">{item.title}</h3>
              <p className="text-gray-500 text-sm">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}