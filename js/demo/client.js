const deployBtn = document.getElementById('deploy-btn')
const codeInput = document.getElementById('code-input')
const templateInput = document.getElementById('template-input')
const output = document.getElementById('output')
const statusPill = document.getElementById('status-pill')

const vercelStatus = document.getElementById('vercel-status')

const vercelCreateBtn = document.getElementById('vercel-create-btn')
const vercelCreateName = document.getElementById('vercel-create-name')
const vercelCreateTeam = document.getElementById('vercel-create-team')
const vercelCreateOutput = document.getElementById('vercel-create-output')

const tabs = document.querySelectorAll('.tab')
const tabContents = document.querySelectorAll('.tab-content')

async function parseResponse(res) {
  try {
    return await res.json()
  } catch {
    const text = await res.text().catch(() => '')
    return { error: text || 'Unknown error' }
  }
}

function setStatus(text, state = 'idle') {
  statusPill.textContent = text
  statusPill.classList.remove('busy', 'error')

  if (state === 'busy') statusPill.classList.add('busy')
  if (state === 'error') statusPill.classList.add('error')
}

function switchTab(nextId) {
  tabs.forEach((tab) => {
    const target = tab.dataset.tab
    const isActive = target === nextId
    tab.classList.toggle('active', isActive)
  })
  tabContents.forEach((content) => {
    content.classList.toggle('hidden', content.id !== nextId)
  })
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab))
})

async function deploy() {
  const code = codeInput.value.trim()
  const templateId = templateInput.value.trim()

  if (!code) {
    output.textContent = 'Please provide some code first.'
    return
  }

  deployBtn.disabled = true
  setStatus('Deploying…', 'busy')
  output.textContent = 'Starting sandbox and running your code...'

  try {
    const res = await fetch('/deploy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        templateId: templateId || undefined,
      }),
    })

    const payload = await parseResponse(res)

    if (!res.ok) {
      throw new Error(payload.error || 'Failed to deploy.')
    }

    const stdout = (payload.stdout || []).join('')
    const stderr = (payload.stderr || []).join('')

    const parts = [
      `Sandbox ID: ${payload.sandboxId}`,
      `Result: ${payload.resultText ?? '(no result returned)'}`,
      stdout ? `\nstdout:\n${stdout}` : 'stdout: (empty)',
      stderr ? `\nstderr:\n${stderr}` : 'stderr: (empty)',
      payload.error ? `\nerror:\n${JSON.stringify(payload.error, null, 2)}` : '',
    ]

    output.textContent = parts.filter(Boolean).join('\n')
    setStatus('Success')
  } catch (error) {
    console.error(error)
    output.textContent = `Error: ${error.message}`
    setStatus('Error', 'error')
  } finally {
    deployBtn.disabled = false
  }
}

deployBtn.addEventListener('click', (event) => {
  event.preventDefault()
  deploy()
})

codeInput.addEventListener('keydown', (event) => {
  if (event.metaKey && event.key.toLowerCase() === 'enter') {
    deploy()
  }
})

function setVercelStatus(text, state = 'idle') {
  vercelStatus.textContent = text
  vercelStatus.classList.remove('busy', 'error')

  if (state === 'busy') vercelStatus.classList.add('busy')
  if (state === 'error') vercelStatus.classList.add('error')
}

async function createProject() {
  const projectName = vercelCreateName.value.trim()
  const teamId = vercelCreateTeam.value.trim()

  if (!projectName) {
    vercelCreateOutput.textContent = 'Project name is required.'
    return
  }

  vercelCreateBtn.disabled = true
  setVercelStatus('Creating…', 'busy')
  vercelCreateOutput.textContent = 'Creating project...'

  try {
    const res = await fetch('/vercel/projects/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: projectName,
        teamId: teamId || undefined,
      }),
    })

    const payload = await parseResponse(res)
    if (!res.ok) {
      throw new Error(payload.error || 'Failed to create project.')
    }

    vercelCreateOutput.textContent = JSON.stringify(payload, null, 2)
    setVercelStatus('Success')
  } catch (error) {
    console.error(error)
    vercelCreateOutput.textContent = `Error: ${error.message}`
    setVercelStatus('Error', 'error')
  } finally {
    vercelCreateBtn.disabled = false
  }
}

vercelCreateBtn?.addEventListener('click', (event) => {
  event.preventDefault()
  createProject()
})

// Removed list/add domain flows per latest request
