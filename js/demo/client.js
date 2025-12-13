const deployBtn = document.getElementById('deploy-btn')
const codeInput = document.getElementById('code-input')
const templateInput = document.getElementById('template-input')
const output = document.getElementById('output')
const statusPill = document.getElementById('status-pill')

function setStatus(text, state = 'idle') {
  statusPill.textContent = text
  statusPill.classList.remove('busy', 'error')

  if (state === 'busy') statusPill.classList.add('busy')
  if (state === 'error') statusPill.classList.add('error')
}

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

    const payload = await res.json()

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
