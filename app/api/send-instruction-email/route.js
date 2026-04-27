import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  try {
    const { recipients, urgency, message, jobName, serviceType, senderName } = await request.json()

    if (!recipients || recipients.length === 0) {
      return Response.json({ success: false, error: 'No recipients' }, { status: 400 })
    }

    const urgencyConfig = {
      urgent: {
        emoji: '🟡',
        label: 'URGENT',
        color: '#D97706',
        bg: '#FFFBEB',
        border: '#FDE68A',
      },
      critical: {
        emoji: '🔴',
        label: 'KRITIKAL',
        color: '#DC2626',
        bg: '#FEF2F2',
        border: '#FECACA',
      }
    }

    const config = urgencyConfig[urgency] || urgencyConfig.urgent

    const emailsSent = []

    for (const recipient of recipients) {
      if (!recipient.email) continue

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1E3A5F; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">AMACC Practice Management System</h2>
            <p style="color: #BFDBFE; margin: 5px 0 0 0;">Job Instruction — ${config.emoji} ${config.label}</p>
          </div>
          
          <div style="background: ${config.bg}; padding: 25px; border-radius: 0 0 8px 8px; border: 1px solid ${config.border};">
            <p style="font-size: 16px; color: #111827;">Salam <strong>${recipient.full_name}</strong>,</p>
            
            <div style="background: white; border-left: 4px solid ${config.color}; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #6B7280; font-weight: bold;">JOB</p>
              <p style="margin: 0 0 4px 0; font-weight: bold; color: #111827;">${jobName}</p>
              <p style="margin: 0; color: #6B7280; font-size: 13px;">${serviceType}</p>
            </div>

            <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #E5E7EB;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #6B7280; font-weight: bold;">INSTRUCTION DARI ${senderName?.toUpperCase()}</p>
              <p style="margin: 0; color: #111827; line-height: 1.6;">${message}</p>
            </div>

            <div style="background: ${config.color}; padding: 12px 15px; border-radius: 8px; margin: 15px 0;">
              <p style="margin: 0; color: white; font-weight: bold; text-align: center;">${config.emoji} ${config.label} — Tindakan Segera Diperlukan</p>
            </div>

            <p style="color: #6B7280; font-size: 13px; margin-top: 20px;">
              Log masuk ke sistem untuk lihat details dan mark sebagai resolved:
            </p>
            <a href="https://pms.zynovalab.com/dashboard/staff" 
               style="display: inline-block; background: #1E3A5F; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 5px;">
              Buka AMACC PMS →
            </a>

            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #9CA3AF; font-size: 11px; margin: 0;">Email ini dijana automatik oleh AMACC PMS. Jangan reply email ini.</p>
          </div>
        </div>
      `

      await resend.emails.send({
        from: 'AMACC PMS <noreply@zynovalab.com>',
        to: [recipient.email],
        subject: `${config.emoji} [${config.label}] Instruction: ${jobName} — ${serviceType}`,
        html
      })

      emailsSent.push(recipient.email)
    }

    return Response.json({
      success: true,
      message: `${emailsSent.length} email dihantar`,
      emailsSent
    })

  } catch (error) {
    console.error('Send instruction email error:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
