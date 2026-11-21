// Pluggable outgoing mail for sign-in codes and password resets.
//
// SMTP_URL (nodemailer connection URL, e.g. smtps://user:pass@mail.example:465)
// is the transport. Wicker Study has no other mail provider: Clerk used to send
// these emails itself. Without SMTP_URL, development prints the message to the
// console and production refuses, so a sign-up never waits on a code that was
// never sent.

let transport = null

export function mailConfigured(env = process.env) {
  return Boolean(String(env.SMTP_URL || '').trim())
}

export function mailFrom(env = process.env) {
  return String(env.EMAIL_FROM || '').trim() || 'Wicker Study <noreply@study.wicker.life>'
}

export class MailNotConfiguredError extends Error {
  constructor() {
    super('Email delivery is not configured (SMTP_URL is unset).')
    this.name = 'MailNotConfiguredError'
  }
}

async function smtp() {
  if (!transport) {
    const { default: nodemailer } = await import('nodemailer')
    transport = nodemailer.createTransport(String(process.env.SMTP_URL).trim())
  }
  return transport
}

export async function sendMail({ to, subject, text, html }, env = process.env) {
  if (mailConfigured(env)) {
    await (await smtp()).sendMail({ from: mailFrom(env), to, subject, text, html })
    return { delivered: true, transport: 'smtp' }
  }
  if (env.NODE_ENV === 'production') throw new MailNotConfiguredError()
  console.info(`[mail] SMTP_URL unset; development copy for ${to}\nSubject: ${subject}\n\n${text}`)
  return { delivered: false, transport: 'console' }
}

const PURPOSE = {
  'sign-in': { subject: 'Your Wicker Study sign-in code', lead: 'Use this code to sign in to Wicker Study.' },
  'email-verification': { subject: 'Verify your Wicker Study email', lead: 'Use this code to verify your email address for Wicker Study.' },
  'forget-password': { subject: 'Reset your Wicker Study password', lead: 'Use this code to choose a new Wicker Study password.' },
  'change-email': { subject: 'Confirm your new Wicker Study email', lead: 'Use this code to confirm your new email address.' }
}

export function codeEmail({ otp, type, minutes = 10 }) {
  const purpose = PURPOSE[type] || PURPOSE['sign-in']
  const text = `${purpose.lead}\n\n${otp}\n\nThe code expires in ${minutes} minutes. If you did not ask for it, you can ignore this email.\n\nWicker Study · https://study.wicker.life`
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#20263a;max-width:480px">
<p style="font-size:15px">${purpose.lead}</p>
<p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:24px 0">${otp}</p>
<p style="font-size:13px;color:#59627b">The code expires in ${minutes} minutes. If you did not ask for it, you can ignore this email.</p>
<p style="font-size:13px;color:#59627b">Wicker Study · <a href="https://study.wicker.life" style="color:#3f51d9">study.wicker.life</a></p>
</div>`
  return { subject: purpose.subject, text, html }
}
