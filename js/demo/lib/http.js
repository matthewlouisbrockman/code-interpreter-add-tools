async function readBody(req) {
  let data = ''
  for await (const chunk of req) {
    data += chunk
  }
  return data
}

function replyJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

module.exports = { readBody, replyJson }
