#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_BASE = 'https://api.supabase.com'
const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '../..')
const defaultMigrationPath = resolve(repoRoot, 'supabase/migrations/001_create_user_data.sql')
const defaultEnvPath = resolve(repoRoot, 'server/.env.local')
const secretNamePattern = /(TOKEN|KEY|PASSWORD|SECRET)/i

const defaultSleep = (ms) => new Promise(resolveSleep => setTimeout(resolveSleep, ms))

const parseArgv = (argv = []) => {
  const flags = {}
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue
    const [rawKey, ...rawValue] = arg.slice(2).split('=')
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
    flags[key] = rawValue.length > 0 ? rawValue.join('=') : 'true'
  }
  return flags
}

export function buildHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
}

export function getProjectRefFromUrl(url) {
  const match = String(url || '').match(/^https:\/\/([a-z0-9-]+)\.supabase\.co(?:\/|$)/i)
  return match ? match[1] : ''
}

export function redact(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [
    key,
    secretNamePattern.test(key) ? '<redacted>' : value
  ]))
}

export function generateDbPassword() {
  return randomBytes(36).toString('base64url')
}

export function mergeEnvText(existingText, updates) {
  const lines = String(existingText || '').split(/\r?\n/)
  const result = []
  const pending = new Map(Object.entries(updates))

  for (const line of lines) {
    if (!line) continue
    const match = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (!match) {
      result.push(line)
      continue
    }

    const key = match[1]
    if (pending.has(key)) {
      result.push(`${key}=${pending.get(key)}`)
      pending.delete(key)
    } else {
      result.push(line)
    }
  }

  for (const [key, value] of pending) {
    result.push(`${key}=${value}`)
  }

  return `${result.join('\n')}\n`
}

function writeEnvFile(envPath, updates) {
  const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
  writeFileSync(envPath, mergeEnvText(existing, updates), 'utf8')
}

export function buildConfig({ env = process.env, argv = process.argv.slice(2) } = {}) {
  const flags = parseArgv(argv)
  const accessToken = env.SUPABASE_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('Missing SUPABASE_ACCESS_TOKEN. Create a Supabase personal access token and pass it as an environment variable.')
  }

  const projectRef = flags.projectRef || env.SUPABASE_PROJECT_REF || getProjectRefFromUrl(env.SUPABASE_URL)
  const config = {
    accessToken,
    projectRef,
    orgSlug: flags.orgSlug || env.SUPABASE_ORG_SLUG || '',
    orgId: flags.orgId || env.SUPABASE_ORG_ID || '',
    dbPassword: env.SUPABASE_DB_PASSWORD || generateDbPassword(),
    region: flags.region || env.SUPABASE_REGION || 'ap-southeast-1',
    projectName: flags.projectName || env.SUPABASE_PROJECT_NAME || 'qian-duo-duo',
    migrationPath: flags.migrationPath || env.SUPABASE_MIGRATION_PATH || defaultMigrationPath,
    envPath: flags.envPath || env.SUPABASE_ENV_PATH || defaultEnvPath,
    writeEnv: flags.noWriteEnv !== 'true'
  }
  return config
}

async function apiJson(fetchImpl, accessToken, path, options = {}) {
  const response = await fetchImpl(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers: buildHeaders(accessToken),
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  })

  if (!response.ok) {
    const detail = typeof response.text === 'function' ? await response.text() : response.statusText
    throw new Error(`Supabase API ${options.method || 'GET'} ${path} failed (${response.status}): ${detail}`)
  }

  if (response.status === 204) return null
  return response.json()
}

async function resolveOrganizationSlug({ config, fetchImpl }) {
  if (config.orgSlug) return config.orgSlug
  if (config.orgId) return ''

  const organizations = await apiJson(fetchImpl, config.accessToken, '/v1/organizations')
  if (!Array.isArray(organizations) || organizations.length === 0) {
    throw new Error('No Supabase organizations found for this access token.')
  }

  if (organizations.length > 1) {
    const choices = organizations
      .map(org => org.slug || org.name || org.id)
      .filter(Boolean)
      .join(', ')
    throw new Error(`Multiple Supabase organizations found. Set SUPABASE_ORG_SLUG to one of: ${choices}`)
  }

  const org = organizations[0]
  if (!org.slug) {
    throw new Error('The Supabase organization response did not include a slug. Set SUPABASE_ORG_SLUG explicitly.')
  }
  return org.slug
}

async function createProject({ config, fetchImpl }) {
  const organizationSlug = await resolveOrganizationSlug({ config, fetchImpl })
  const body = {
    name: config.projectName,
    region: config.region,
    db_pass: config.dbPassword
  }

  if (organizationSlug) {
    body.organization_slug = organizationSlug
  } else {
    body.organization_id = config.orgId
  }

  const created = await apiJson(fetchImpl, config.accessToken, '/v1/projects', {
    method: 'POST',
    body
  })

  if (!created?.ref) {
    throw new Error('Supabase did not return a project ref after creating the project.')
  }
  return created.ref
}

async function waitForProject({ config, fetchImpl, projectRef, sleep }) {
  const readyStatuses = new Set(['ACTIVE_HEALTHY', 'ACTIVE_UNHEALTHY'])
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const project = await apiJson(fetchImpl, config.accessToken, `/v1/projects/${projectRef}`)
    if (!project?.status || readyStatuses.has(project.status)) {
      return
    }
    await sleep(15000)
  }
  throw new Error(`Supabase project ${projectRef} was not ready after waiting.`)
}

async function applyMigration({ config, fetchImpl, projectRef }) {
  const sql = readFileSync(config.migrationPath, 'utf8')
  await apiJson(fetchImpl, config.accessToken, `/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    body: { query: sql }
  })
}

async function updateAuthConfig({ config, fetchImpl, projectRef }) {
  await apiJson(fetchImpl, config.accessToken, `/v1/projects/${projectRef}/config/auth`, {
    method: 'PATCH',
    body: {
      external_email_enabled: true,
      disable_signup: false,
      mailer_autoconfirm: false,
      mailer_otp_exp: 3600,
      mailer_subjects_magic_link: '钱多多登录验证码',
      mailer_templates_magic_link_content: [
        '<h2>钱多多登录验证码</h2>',
        '<p>你的验证码是：</p>',
        '<p style="font-size: 32px; font-weight: 700; letter-spacing: 8px;">{{ .Token }}</p>',
        '<p>验证码 1 小时内有效，请勿转发给他人。</p>'
      ].join('')
    }
  })
}

function readKey(keys, names) {
  const key = keys.find(item => names.includes(item.name) || names.includes(item.type))
  return key?.api_key || key?.key || ''
}

async function fetchRuntimeEnv({ config, fetchImpl, projectRef }) {
  const keys = await apiJson(fetchImpl, config.accessToken, `/v1/projects/${projectRef}/api-keys`)
  const list = Array.isArray(keys) ? keys : keys?.api_keys || []
  const anonKey = readKey(list, ['anon', 'publishable'])
  const serviceRoleKey = readKey(list, ['service_role', 'secret'])

  if (!anonKey || !serviceRoleKey) {
    throw new Error('Could not find anon and service_role API keys in the Supabase response.')
  }

  return {
    SUPABASE_URL: `https://${projectRef}.supabase.co`,
    SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey
  }
}

export async function setupSupabase({ config, fetchImpl = fetch, sleep = defaultSleep } = {}) {
  if (!config) {
    config = buildConfig()
  }

  const projectRef = config.projectRef || await createProject({ config, fetchImpl })
  if (!config.projectRef) {
    await waitForProject({ config, fetchImpl, projectRef, sleep })
  }

  await applyMigration({ config, fetchImpl, projectRef })
  await updateAuthConfig({ config, fetchImpl, projectRef })
  return fetchRuntimeEnv({ config, fetchImpl, projectRef })
}

async function main() {
  const config = buildConfig()
  const env = await setupSupabase({ config })
  if (config.writeEnv) {
    writeEnvFile(config.envPath, {
      ...env,
      ...(config.projectRef ? {} : { SUPABASE_DB_PASSWORD: config.dbPassword })
    })
  }

  console.log('Supabase setup completed. Add these values to server runtime environment:')
  for (const [key, value] of Object.entries(redact(env))) {
    console.log(`${key}=${value}`)
  }

  console.log('')
  if (config.writeEnv) {
    console.log(`Runtime values were written to ${config.envPath}. Secret values were not printed.`)
  } else {
    console.log('Secret values were not printed because --no-write-env=true was used.')
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
