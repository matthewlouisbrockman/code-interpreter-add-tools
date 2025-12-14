const { readBody, replyJson } = require('../lib/http')
const {
  buildVercelUrl,
  callVercel,
  getTeamId,
  getVercelToken,
} = require('../lib/vercel')

async function handleDeployFiles(req, res) {
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

  const rootDomain =
    typeof process.env.VERCEL_ROOT_DOMAIN === 'string'
      ? process.env.VERCEL_ROOT_DOMAIN.trim()
      : ''
  const subdomain =
    typeof body.subdomain === 'string' && body.subdomain.trim()
      ? body.subdomain.trim()
      : ''
  const customDomain =
    typeof body.domain === 'string' && body.domain.trim()
      ? body.domain.trim()
      : ''
  const domain =
    subdomain && rootDomain
      ? `${subdomain}.${rootDomain}`
      : customDomain || undefined

  if (subdomain && !rootDomain) {
    replyJson(res, 400, {
      error:
        'Set VERCEL_ROOT_DOMAIN in env to append the subdomain (or send a full domain).',
    })
    return
  }

  const teamId = getTeamId(
    typeof body.teamId === 'string' ? body.teamId.trim() : undefined
  )
  if (!teamId) {
    replyJson(res, 400, {
      error: 'Set VERCEL_TEAM_ID in env or include teamId in the request body.',
    })
    return
  }

  const deploymentName =
    typeof body.deploymentName === 'string' && body.deploymentName.trim()
      ? body.deploymentName.trim()
      : `deploy-${Date.now()}`
  const projectId =
    typeof body.projectId === 'string' && body.projectId.trim()
      ? body.projectId.trim()
      : undefined
  const customText =
    typeof body.customText === 'string' && body.customText.trim()
      ? body.customText.trim()
      : ''

  const files =
    Array.isArray(body.files) && body.files.length > 0
      ? body.files
      : [
          {
            file: 'package.json',
            data: JSON.stringify({
              name: 'demo-deployment',
              version: '1.0.0',
              private: true,
              scripts: {
                dev: 'next dev',
                build: 'next build',
                start: 'next start',
              },
              dependencies: {
                next: '14.2.15',
                react: '18.3.1',
                'react-dom': '18.3.1',
              },
            }),
          },
          {
            file: 'pages/index.js',
            data: `export default function Home() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>${deploymentName}</h1>
      ${customText ? `<p>${customText}</p>` : ''}
      <p>This page was deployed via the demo deploy endpoint.</p>
    </main>
  )
}
`,
          },
        ]

  try {
    const { Vercel } = await import('@vercel/sdk')
    const vercel = new Vercel({ bearerToken: vercelToken })

    console.log('[vercel] deploy files request body', {
      deploymentName,
      projectId,
      domain,
      teamId,
      filesCount: files.length,
    })

    const deployment = await vercel.deployments.createDeployment({
      teamId,
      skipAutoDetectionConfirmation: '1',
      requestBody: {
        name: deploymentName,
        target: 'production',
        project: projectId,
        files,
        projectSettings: {
          framework: 'nextjs',
          buildCommand: 'npm run build',
          installCommand: 'npm install',
          outputDirectory: '.next',
        },
      },
    })

    if (domain && deployment?.id) {
      // Use the project from deployment if projectId wasn't provided
      const finalProjectId = projectId || deployment.projectId

      await ensureDomainOwnership({
        domain,
        teamId,
        vercelToken,
      })
      await ensureDomainOnProject({
        domain,
        projectId: finalProjectId,
        teamId,
        vercelToken,
      })
      // Note: assignAliasToDeployment is not needed - adding domain to project
      // automatically makes it available for the deployment
    }

    replyJson(res, 200, {
      deployment,
      projectId: deployment.projectId || projectId,
      projectName: deployment.name,
      alias: domain ? domain : null,
      domain: domain || null,
    })
  } catch (error) {
    console.error('Deploy files failed', error)
    replyJson(res, 500, { error: error.message || 'Deploy files failed.' })
  }
}

module.exports = { handleDeployFiles }

async function ensureDomainOwnership({ domain, teamId, vercelToken }) {
  // Skip for subdomains - they can be added directly to projects
  // Only root domains need to be added via /v7/domains
  const parts = domain.split('.')
  const isSubdomain = parts.length > 2
  if (isSubdomain) {
    console.log('[vercel] skipping ownership check for subdomain:', domain)
    return
  }

  //WTF ITS v7 WHY IS https://vercel.com/docs/rest-api/reference/endpoints/domains/add-an-existing-domain-to-the-vercel-platform INSANE
  const url = buildVercelUrl('/v7/domains', teamId)
  try {
    await callVercel(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vercelToken}`,
      },
      body: JSON.stringify({ name: domain }),
    })
  } catch (error) {
    // Already exists/owned
    if (
      error?.raw?.error?.code === 'domain_already_exists' ||
      error?.raw?.error?.code === 'forbidden' ||
      error?.raw?.error?.code === 'domain_conflict'
    ) {
      console.warn('[vercel] domain ownership check skipped:', error?.raw?.error?.code, domain)
      return
    }
    throw error
  }
}

async function ensureDomainOnProject({ domain, projectId, teamId, vercelToken }) {
  if (!projectId || !domain) return

  const url = buildVercelUrl(`/v10/projects/${projectId}/domains`, teamId)
  try {
    await callVercel(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vercelToken}`,
      },
      body: JSON.stringify({ name: domain }),
    })
  } catch (error) {
    if (error?.raw?.error?.code === 'domain_already_added') return
    throw error
  }
}
