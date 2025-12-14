function getVercelToken() {
  return process.env.VERCEL_TOKEN || process.env.VERCEL_API_KEY || ''
}

function getTeamId(override) {
  const fromEnv =
    typeof process.env.VERCEL_TEAM_ID === 'string'
      ? process.env.VERCEL_TEAM_ID.trim()
      : ''
  return (override || fromEnv || '').trim() || undefined
}

function buildVercelUrl(pathname, teamId) {
  const url = new URL(`https://api.vercel.com${pathname}`)
  if (teamId) url.searchParams.set('teamId', teamId)
  return url
}

function logVercelRequest(label, url, options = {}) {
  const safeHeaders = { ...(options.headers || {}) }
  if (safeHeaders.Authorization) {
    safeHeaders.Authorization = '[redacted]'
  }

  console.log(`[vercel] ${label}`, {
    url: url?.toString ? url.toString() : url,
    method: options.method || 'GET',
    headers: safeHeaders,
    body: options.body,
  })
}

async function callVercel(pathname, options) {
  logVercelRequest('request', pathname, options)

  const res = await fetch(pathname, options)

  let data
  try {
    data = await res.json()
  } catch {
    try {
      const text = await res.text()
      data = { message: text || 'Response had no body' }
    } catch {
      data = {}
    }
  }

  if (!res.ok) {
    console.error('[vercel] response error', {
      status: res.status,
      statusText: res.statusText,
      body: data,
    })

    const message =
      data?.error?.message || data?.message || `Vercel API error ${res.status}`
    const error = new Error(message)
    error.raw = data
    throw error
  }

  return data
}

module.exports = {
  buildVercelUrl,
  callVercel,
  getTeamId,
  getVercelToken,
  logVercelRequest,
}
