#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

function log(msg) { console.log(`${CYAN}[deploy]${RESET} ${msg}`) }
function ok(msg) { console.log(`${GREEN}✓ ${msg}${RESET}`) }
function die(msg) { console.error(`${RED}✗ ${msg}${RESET}`); process.exit(1) }

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8', ...opts }).trim()
  } catch (e) {
    if (opts.allowFail) return null
    const stderr = e.stderr?.trim() || e.message
    die(`Command failed: ${cmd}\n${stderr}`)
  }
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase())
    })
  })
}

try {
  log('Checking git status...')
  const status = run('git status --porcelain')
  const branch = run('git rev-parse --abbrev-ref HEAD')

  if (branch !== 'main') {
    die(`Current branch is "${branch}", please switch to main before deploying.`)
  }

  if (!status) {
    die('No changes to deploy. Working tree is clean.')
  }

  log('Running typecheck...')
  run('npm run typecheck')
  ok('Typecheck passed')

  log('Running build...')
  run('npm run build', { env: { ...process.env, BASE_PATH: '/diary-app' } })
  ok('Build passed')

  console.log()
  log('Changed files:')
  console.log(`  ${YELLOW}${status.replace(/\n/g, '\n  ')}${RESET}`)
  console.log()

  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
  const ts = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const commitMsg = `deploy: ${pkg.version} ${ts}`

  log(`Commit message: "${commitMsg}"`)
  console.log()

  const answer = await ask(`${YELLOW}Commit and push to origin/main? [y/N]${RESET} `)
  if (answer !== 'y' && answer !== 'yes') {
    console.log('Aborted. Nothing was committed or pushed.')
    process.exit(0)
  }
  console.log()

  log('Staging changes...')
  run('git add -A')

  log(`Committing: "${commitMsg}"`)
  run(`git commit -m "${commitMsg}"`)
  ok('Committed')

  log('Pushing to origin/main...')
  run('git push origin main')
  ok('Pushed')

  const repoUrl = run('git config --get remote.origin.url')
  const repo = repoUrl.match(/github\.com[:/](.+?)(\.git)?$/)?.[1]
  if (repo) {
    const actionsUrl = `https://github.com/${repo}/actions`
    console.log()
    ok('Deploy triggered! GitHub Actions is building...')
    console.log(`  ${CYAN}${actionsUrl}${RESET}`)
    console.log()
    console.log(`  ${GREEN}Site:${RESET} https://xuhong1998.github.io/diary-app/`)
  }
} catch (e) {
  die(e.message)
}
