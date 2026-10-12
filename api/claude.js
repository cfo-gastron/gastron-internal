// api/claude.js — Proxy ke Anthropic API. API key disimpan aman di server (env var).
// Wajib login (dulu terbuka: siapa pun yang tahu URL bisa memakai API key).
import { getUser } from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const user = await getUser(req)
  if (!user) return res.status(401).json({ error: 'Harus login' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY belum di-set di Vercel Environment Variables' })
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    })

    const data = await anthropicRes.json()

    if (!anthropicRes.ok) {
      return res.status(anthropicRes.status).json(data)
    }

    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
