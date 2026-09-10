'use strict'

async function main() {
  const proofSink = process.env.INPUT_PROOF_SINK || ''
  const marker = process.env.INPUT_REGISTRATION_MARKER || ''
  const holdSeconds = Number(process.env.INPUT_HOLD_SECONDS || '60')

  if (!proofSink || !marker || !Number.isFinite(holdSeconds) || holdSeconds < 0) {
    throw new Error('required controlled input is unavailable')
  }

  const response = await fetch(proofSink, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      marker,
      phase: 'registered',
      repository: process.env.GITHUB_REPOSITORY,
      run_id: process.env.GITHUB_RUN_ID
    })
  })
  if (!response.ok) {
    throw new Error(`controlled registration callback failed with HTTP ${response.status}`)
  }

  console.log(`OWNER_POST_REGISTERED run=${process.env.GITHUB_RUN_ID}`)
  await new Promise(resolve => setTimeout(resolve, holdSeconds * 1000))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
