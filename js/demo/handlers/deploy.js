const { Sandbox } = require('../lib/sandbox')
const { readBody, replyJson } = require('../lib/http')

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

module.exports = { handleDeploy }
