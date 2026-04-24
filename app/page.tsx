'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Get user role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (!profile) {
      setError('Profile not found. Please contact admin.')
      setLoading(false)
      return
    }

    // Redirect based on role
    if (profile.role === 'ceo') {
      router.push('/dashboard/ceo')
    } else if (profile.role === 'hoo') {
      router.push('/dashboard/hoo')
    } else if (profile.role === 'assigner') {
      router.push('/dashboard/assigner')
    } else {
      router.push('/dashboard/staff')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="bg-blue-600 text-white text-2xl font-bold py-3 px-6 rounded-xl inline-block mb-4">
            AMACC
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Practice Management System</h1>
          <p className="text-gray-500 mt-1">Log masuk untuk teruskan</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="nama@amacc.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? 'Log masuk...' : 'Log Masuk'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          AMACC Consulting Services Sdn Bhd
        </p>
      </div>
    </div>
  )
}