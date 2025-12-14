let Sandbox

try {
  ;({ Sandbox } = require('../../dist'))
} catch (error) {
  console.error(
    'Unable to load the SDK build. Run "pnpm build" in the js/ package first.',
    error
  )
  process.exit(1)
}

module.exports = { Sandbox }
