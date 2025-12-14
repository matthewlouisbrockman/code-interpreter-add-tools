const { readBody, replyJson } = require('../lib/http')
const { buildVercelUrl, callVercel, getTeamId, getVercelToken } = require('../lib/vercel')

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
    typeof body.name === 'string' && body.name.trim() ? body.name.trim() : ''
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

module.exports = { handleCreateProject }
