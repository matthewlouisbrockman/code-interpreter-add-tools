const { replyJson } = require('../lib/http')

// Removed domains support; keep handlers stubbed to avoid routing errors if called accidentally.
async function handleAddDomain(req, res) {
  replyJson(res, 501, { error: 'Domain handling removed in this demo.' })
}

async function handleListDomains(req, res) {
  replyJson(res, 501, { error: 'List domains removed in this demo.' })
}

module.exports = { handleAddDomain, handleListDomains }
