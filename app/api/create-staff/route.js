import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const body = await request.json()
    const { email, name, phone, designation, role, division, status } = body

    console.log('Creating staff:', name, email, role, division)

    if (!email || !name) {
      return Response.json({ error: 'Nama dan email wajib ada' }, { status: 400 })
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: 'Amacc@2024',
      email_confirm: true
    })

    if (authError) {
      console.log('Auth error:', authError.message)
      return Response.json({ error: authError.message }, { status: 400 })
    }

    console.log('Auth created:', authData.user.id)

    // Determine division value
    const divisionValue = division && division.trim() !== '' ? division.trim() : null

    // Create profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        full_name: name,
        email: email,
        phone: phone && phone.trim() !== '' ? phone.trim() : null,
        designation: designation && designation.trim() !== '' ? designation.trim() : null,
        role: role && role.trim() !== '' ? role.trim() : 'staff',
        division: divisionValue,
        is_active: true
      })

    if (profileError) {
      console.log('Profile error:', profileError.message)
      return Response.json({ error: profileError.message }, { status: 400 })
    }

    return Response.json({ success: true, name: name })

  } catch (err) {
    console.log('Catch error:', err.message)
    return Response.json({ error: err.message }, { status: 500 })
  }
}