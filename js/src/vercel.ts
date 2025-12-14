/**
 * Vercel deployment utilities for E2B Sandbox integration.
 */

import { Vercel } from '@vercel/sdk'

export interface VercelDeploymentOptions {
  /**
   * Deployment name (used as subdomain and project name).
   */
  name: string
  /**
   * Optional code snippet to render on the deployed page.
   */
  code?: string
  /**
   * Custom text to display on the deployed page.
   */
  customText?: string
  /**
   * Vercel API token.
   */
  vercelToken: string
  /**
   * Vercel team ID.
   */
  teamId: string
  /**
   * Root domain for subdomain (e.g., 'example.com').
   */
  rootDomain: string
  /**
   * Optional project ID to reuse existing project.
   */
  projectId?: string
  /**
   * Files to deploy. If not provided, uses default Next.js template.
   */
  files?: Array<{
    file: string
    data: string
  }>
}

export interface VercelDeploymentResult {
  projectId: string
  projectName: string
  teamId: string
  domain: string | null
  deployment: any
}

async function findProjectId(opts: {
  name: string
  teamId: string
  vercelToken: string
}): Promise<string | null> {
  const url = new URL(`https://api.vercel.com/v9/projects/${opts.name}`)
  url.searchParams.set('teamId', opts.teamId)

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${opts.vercelToken}`,
    },
  })

  if (res.status === 404) {
    return null
  }

  if (!res.ok) {
    throw new Error(
      `Failed to fetch Vercel project ${opts.name}: ${res.status} ${res.statusText}`
    )
  }

  const data = await res.json()
  return data?.id || data?.projectId || null
}

/**
 * Deploy files to Vercel with custom subdomain.
 */
export async function deployToVercel(
  opts: VercelDeploymentOptions
): Promise<VercelDeploymentResult> {
  const vercel = new Vercel({ bearerToken: opts.vercelToken })

  const deploymentName = opts.name
  const subdomain = opts.name
  const domain = `${subdomain}.${opts.rootDomain}`

  const existingProjectId =
    opts.projectId ||
    (await findProjectId({
      name: deploymentName,
      teamId: opts.teamId,
      vercelToken: opts.vercelToken,
    }))

  // Use provided files or default Next.js template
  const files =
    opts.files ||
    createDefaultFiles({
      deploymentName,
      customText: opts.customText,
    })

  // Create deployment
  const deployment = await vercel.deployments.createDeployment({
    teamId: opts.teamId,
    skipAutoDetectionConfirmation: '1',
    requestBody: {
      name: deploymentName,
      target: 'production',
      project: existingProjectId || undefined,
      files,
      projectSettings: {
        framework: 'nextjs',
        buildCommand: 'npm run build',
        installCommand: 'npm install',
        outputDirectory: '.next',
      },
    },
  })

  const finalProjectId = existingProjectId || deployment.projectId

  // Add domain to project if we have a project ID
  if (domain && deployment?.id && finalProjectId) {
    await ensureDomainOwnership({
      domain,
      teamId: opts.teamId,
      vercelToken: opts.vercelToken,
    })
    await ensureDomainOnProject({
      domain,
      projectId: finalProjectId,
      teamId: opts.teamId,
      vercelToken: opts.vercelToken,
    })
  }

  return {
    deployment,
    projectId: deployment.projectId || opts.projectId || '',
    projectName: deployment.name || deploymentName,
    teamId: opts.teamId,
    domain: domain || null,
  }
}

/**
 * Create default Next.js files for deployment.
 */
function createDefaultFiles(opts: {
  deploymentName: string
  code?: string
  customText?: string
}): Array<{ file: string; data: string }> {
  const escapedCode =
    opts.code?.replace(/`/g, '\\`').replace(/\$\{/g, '\\${') ?? ''

  return [
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
      <h1>${opts.deploymentName}</h1>
      ${
        opts.customText
          ? `<p style={{ whiteSpace: 'pre-wrap' }}>${opts.customText}</p>`
          : ''
      }
      ${
        opts.code
          ? `<pre style={{ whiteSpace: 'pre-wrap', background: '#111827', color: '#e5e7eb', padding: '1rem', borderRadius: '0.5rem' }}>{\`${escapedCode}\`}</pre>`
          : ''
      }
      <p>This page was deployed via E2B Sandbox.</p>
    </main>
  )
}
`,
    },
  ]
}

/**
 * Ensure domain ownership (only needed for root domains, not subdomains).
 */
async function ensureDomainOwnership(opts: {
  domain: string
  teamId: string
  vercelToken: string
}): Promise<void> {
  // Skip for subdomains - they can be added directly to projects
  const parts = opts.domain.split('.')
  const isSubdomain = parts.length > 2
  if (isSubdomain) {
    return
  }

  // Only root domains need to be added via /v7/domains
  const url = new URL('https://api.vercel.com/v7/domains')
  url.searchParams.set('teamId', opts.teamId)

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.vercelToken}`,
      },
      body: JSON.stringify({ name: opts.domain }),
    })

    if (!res.ok) {
      const data = await res.json()
      const code = data?.error?.code

      // Already exists/owned - ignore these errors
      if (
        code === 'domain_already_exists' ||
        code === 'forbidden' ||
        code === 'domain_conflict'
      ) {
        return
      }

      throw new Error(
        data?.error?.message || `Failed to add domain: ${res.statusText}`
      )
    }
  } catch (error: any) {
    // Ignore ownership errors
    const code = error?.raw?.error?.code
    if (
      code === 'domain_already_exists' ||
      code === 'forbidden' ||
      code === 'domain_conflict'
    ) {
      return
    }
    throw error
  }
}

/**
 * Add domain to a Vercel project.
 */
async function ensureDomainOnProject(opts: {
  domain: string
  projectId: string
  teamId: string
  vercelToken: string
}): Promise<void> {
  if (!opts.projectId || !opts.domain) return

  const url = new URL(
    `https://api.vercel.com/v10/projects/${opts.projectId}/domains`
  )
  url.searchParams.set('teamId', opts.teamId)

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.vercelToken}`,
      },
      body: JSON.stringify({ name: opts.domain }),
    })

    if (!res.ok) {
      const data = await res.json()
      if (data?.error?.code === 'domain_already_added') return

      throw new Error(
        data?.error?.message || `Failed to add domain to project: ${res.statusText}`
      )
    }
  } catch (error: any) {
    if (error?.message?.includes('domain_already_added')) return
    throw error
  }
}
