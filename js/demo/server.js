const { createServer } = require('node:http')
const { readFile } = require('node:fs/promises')
const path = require('node:path')
let Sandbox
try {
  ;({ Sandbox } = require('../dist'))
} catch (error) {
  console.error(
    'Unable to load the SDK build. Run "pnpm build" in the js/ package first.',
    error
  )
  process.exit(1)
}

const { config } = require('dotenv')

// Load env from both the current folder and the repo root (one level above ../..).
config()
config({ path: path.resolve(__dirname, '../../.env') })

const port = process.env.PORT || 4173
const staticRoot = __dirname

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

function replyJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

async function readBody(req) {
  let data = ''
  for await (const chunk of req) {
    data += chunk
  }
  return data
}

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

async function handleDeploy(req, res) {
  if (!process.env.E2B_API_KEY) {
    replyJson(res, 500, { error: 'Set E2B_API_KEY in your environment first.' })
    return
  }

  const rawBody = await readBody(req)
  let body
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    replyJson(res, 400, { error: 'Request body must be valid JSON.' })
    return
  }

  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const templateId = typeof body.templateId === 'string' ? body.templateId : ''

  if (!code) {
    replyJson(res, 400, { error: 'Provide some code to run.' })
    return
  }

  let sandbox
  try {
    sandbox = await Sandbox.create(templateId || undefined)
    const execution = await sandbox.runCode(code)

    replyJson(res, 200, {
      sandboxId: sandbox.sandboxId,
      resultText: execution.text ?? null,
      stdout: execution.logs.stdout,
      stderr: execution.logs.stderr,
      error: execution.error,
    })
  } catch (error) {
    console.error('Deploy request failed', error)
    replyJson(res, 500, { error: error.message || 'Sandbox call failed.' })
  } finally {
    if (sandbox) {
      try {
        await sandbox.kill()
      } catch (killError) {
        console.error('Failed to clean up sandbox', killError)
      }
    }
  }
}

// Removed domains support; keep handler stubbed to avoid routing errors if called accidentally.
async function handleAddDomain(req, res) {
  replyJson(res, 501, { error: 'Domain handling removed in this demo.' })
}

async function handleCreateProject(req, res) {
  const vercelToken = getVercelToken()
  if (!vercelToken) {
    replyJson(res, 500, {
      error: 'Set VERCEL_API_KEY (or VERCEL_TOKEN) in your environment first.',
    })
    return
  }

  const rawBody = await readBody(req)
  let body
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    replyJson(res, 400, { error: 'Request body must be valid JSON.' })
    return
  }

  const projectName =
    typeof body.name === 'string' && body.name.trim()
      ? body.name.trim()
      : ''
  const teamId = getTeamId(
    typeof body.teamId === 'string' ? body.teamId.trim() : undefined
  )

  if (!teamId) {
    replyJson(res, 400, {
      error: 'Set VERCEL_TEAM_ID in env or include teamId in the request body.',
    })
    return
  }

  if (!projectName) {
    replyJson(res, 400, { error: 'Provide a project name.' })
    return
  }

  try {
    console.log('[vercel] create project request body', body)
    console.log('[vercel] create project resolved values', {
      projectName,
      teamId,
    })

    const url = buildVercelUrl('/v10/projects', teamId)
    const requestBody = {
      name: projectName,
    }

    const result = await callVercel(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vercelToken}`,
      },
      body: JSON.stringify(requestBody),
    })

    replyJson(res, 200, {
      projectId: result?.id,
      projectName: result?.name,
      teamId: teamId || null,
      raw: result,
    })
  } catch (error) {
    console.error('Create project failed', error)
    replyJson(res, 500, { error: error.message || 'Create project failed.' })
  }
}

async function serveStatic(req, res, pathname) {
  const filePath =
    pathname === '/'
      ? path.join(staticRoot, 'index.html')
      : path.join(staticRoot, pathname.slice(1))

  try {
    const data = await readFile(filePath)
    const ext = path.extname(filePath)
    const contentType = contentTypes[ext] || 'text/plain; charset=utf-8'
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
    return true
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Static file error', error)
    }
    return false
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (req.method === 'POST' && url.pathname === '/deploy') {
    await handleDeploy(req, res)
    return
  }

  if (req.method === 'POST' && url.pathname === '/vercel/domains/add') {
    await handleAddDomain(req, res)
    return
  }

  if (req.method === 'POST' && url.pathname === '/vercel/domains/list') {
    await handleListDomains(req, res)
    return
  }

  if (req.method === 'POST' && url.pathname === '/vercel/projects/create') {
    await handleCreateProject(req, res)
    return
  }

  const served = await serveStatic(req, res, url.pathname)
  if (!served) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  }
})

server.listen(port, () => {
  console.log(`Demo running at http://localhost:${port}`)
})
