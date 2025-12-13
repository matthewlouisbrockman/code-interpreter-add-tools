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

  const served = await serveStatic(req, res, url.pathname)
  if (!served) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  }
})

server.listen(port, () => {
  console.log(`Demo running at http://localhost:${port}`)
})
