const { readFile } = require('node:fs/promises')
const path = require('node:path')

const defaultContentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

async function serveStatic(req, res, pathname, root, contentTypes = defaultContentTypes) {
  const filePath =
    pathname === '/'
      ? path.join(root, 'index.html')
      : path.join(root, pathname.slice(1))

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

module.exports = { serveStatic }
