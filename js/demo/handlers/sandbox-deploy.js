const { readBody, replyJson } = require('../lib/http')
const { getTeamId, getVercelToken } = require('../lib/vercel')
const { Sandbox } = require('@e2b/code-interpreter')

// Import the deployToVercel helper directly from the built source
let deployToVercelHelper
async function getDeployHelper() {
  if (!deployToVercelHelper) {
    const codeInterpreter = await import('../../dist/index.mjs')
    deployToVercelHelper = codeInterpreter.deployToVercel
  }
  return deployToVercelHelper
}

async function handleSandboxDeploy(req, res) {
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

  const code =
    typeof body.code === 'string' && body.code.trim() ? body.code.trim() : ''
  const name =
    typeof body.name === 'string' && body.name.trim() ? body.name.trim() : ''
  const projectId =
    typeof body.projectId === 'string' && body.projectId.trim()
      ? body.projectId.trim()
      : undefined
  const teamId = getTeamId(
    typeof body.teamId === 'string' ? body.teamId.trim() : undefined
  )

  if (!code) {
    replyJson(res, 400, { error: 'code is required.' })
    return
  }

  if (!name) {
    replyJson(res, 400, { error: 'name is required.' })
    return
  }

  if (!teamId) {
    replyJson(res, 400, {
      error: 'Set VERCEL_TEAM_ID in env or include teamId in the request body.',
    })
    return
  }

  const rootDomain =
    typeof process.env.VERCEL_ROOT_DOMAIN === 'string'
      ? process.env.VERCEL_ROOT_DOMAIN.trim()
      : ''

  if (!rootDomain) {
    replyJson(res, 400, {
      error: 'Set VERCEL_ROOT_DOMAIN in your environment.',
    })
    return
  }

  let sandbox
  try {
    console.log('[sandbox-deploy] Creating sandbox...')
    sandbox = await Sandbox.create()
    console.log('[sandbox-deploy] Sandbox created:', sandbox.sandboxId)

    console.log('[sandbox-deploy] Running code...')
    const execution = await sandbox.runCode(code)
    console.log('[sandbox-deploy] Code execution complete')

    const output = {
      stdout: execution.logs.stdout.join('\n'),
      stderr: execution.logs.stderr.join('\n'),
      result: execution.text || '',
      error: execution.error,
    }

    // Format code output for display
    const codeOutput = [
      '=== Code ===',
      code,
      '',
      '=== Output ===',
      output.result || '(no result)',
      '',
      output.stdout ? `stdout:\n${output.stdout}` : '',
      output.stderr ? `stderr:\n${output.stderr}` : '',
      output.error ? `error:\n${JSON.stringify(output.error, null, 2)}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    console.log('[sandbox-deploy] Deploying to Vercel...')
    const deployToVercel = await getDeployHelper()
    const deployment = await deployToVercel({
      name,
      customText: codeOutput,
      vercelToken,
      teamId,
      rootDomain,
      projectId,
    })

    console.log('[sandbox-deploy] Deployment complete:', deployment.domain)

    replyJson(res, 200, {
      sandboxId: sandbox.sandboxId,
      execution: output,
      deployment: deployment.deployment,
      projectId: deployment.projectId,
      projectName: deployment.projectName,
      teamId: deployment.teamId,
      domain: deployment.domain,
    })
  } catch (error) {
    console.error('[sandbox-deploy] Error:', error)
    replyJson(res, 500, {
      error: error.message || 'Sandbox deploy failed.',
    })
  } finally {
    if (sandbox) {
      try {
        await sandbox.kill()
        console.log('[sandbox-deploy] Sandbox closed')
      } catch (err) {
        console.error('[sandbox-deploy] Error closing sandbox:', err)
      }
    }
  }
}

module.exports = { handleSandboxDeploy }
