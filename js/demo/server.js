const { createServer } = require('node:http')
const path = require('node:path')
const { config } = require('dotenv')

const { handleDeploy } = require('./handlers/deploy')
const { handleAddDomain, handleListDomains } = require('./handlers/domains')
const { handleCreateProject } = require('./handlers/create-project')
const { handleDeployFiles } = require('./handlers/deploy-files')
const { serveStatic } = require('./lib/static')

// Load env from both the current folder and the repo root (one level above ../..).
config()
config({ path: path.resolve(__dirname, '../../.env') })

const port = process.env.PORT || 4173
const staticRoot = __dirname

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

  if (req.method === 'POST' && url.pathname === '/vercel/deploy') {
    await handleDeployFiles(req, res)
    return
  }

  const served = await serveStatic(req, res, url.pathname, staticRoot)
  if (!served) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  }
})

server.listen(port, () => {
  console.log(`Demo running at http://localhost:${port}`)
})
