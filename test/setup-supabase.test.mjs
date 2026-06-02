import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildConfig,
  buildHeaders,
  generateDbPassword,
  getProjectRefFromUrl,
  mergeEnvText,
  redact,
  setupSupabase
} from '../scripts/setup-supabase.mjs'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(testDir, '../..')
const migrationPath = resolve(repoRoot, 'supabase/migrations/001_create_user_data.sql')

const jsonResponse = (body, init = {}) => ({
  ok: init.ok ?? true,
  status: init.status ?? 200,
  statusText: init.statusText ?? 'OK',
  json: async () => body,
  text: async () => JSON.stringify(body)
})

test('migration creates the user_data table used by the server', () => {
  const sql = readFileSync(migrationPath, 'utf8')
  assert.match(sql, /create table if not exists public\.user_data/i)
  assert.match(sql, /user_id uuid not null unique/i)
  assert.match(sql, /holdings jsonb not null default '\[\]'::jsonb/i)
  assert.match(sql, /notes jsonb not null default '\[\]'::jsonb/i)
  assert.match(sql, /watchlist jsonb not null default '\[\]'::jsonb/i)
  assert.match(sql, /alter table public\.user_data enable row level security/i)
})

test('buildConfig requires an access token', () => {
  assert.throws(
    () => buildConfig({ env: {}, argv: [] }),
    /SUPABASE_ACCESS_TOKEN/
  )
})

test('buildConfig accepts an existing project ref', () => {
  const config = buildConfig({
    env: {
      SUPABASE_ACCESS_TOKEN: 'token-1',
      SUPABASE_PROJECT_REF: 'ref123'
    },
    argv: []
  })

  assert.equal(config.accessToken, 'token-1')
  assert.equal(config.projectRef, 'ref123')
  assert.equal(config.projectName, 'qian-duo-duo')
  assert.equal(config.region, 'ap-southeast-1')
})

test('buildConfig generates a database password when creating a project', () => {
  const config = buildConfig({
    env: {
      SUPABASE_ACCESS_TOKEN: 'token-1',
      SUPABASE_PROJECT_NAME: 'qian-duo-duo'
    },
    argv: []
  })

  assert.equal(config.projectRef, '')
  assert.match(config.dbPassword, /^[A-Za-z0-9_-]{32,}$/)
})

test('generateDbPassword returns URL-safe password text', () => {
  assert.match(generateDbPassword(), /^[A-Za-z0-9_-]{32,}$/)
})

test('redact hides Supabase secrets in output objects', () => {
  assert.deepEqual(redact({
    SUPABASE_URL: 'https://abc.supabase.co',
    SUPABASE_ANON_KEY: 'anon-secret',
    SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
    SUPABASE_ACCESS_TOKEN: 'token-secret'
  }), {
    SUPABASE_URL: 'https://abc.supabase.co',
    SUPABASE_ANON_KEY: '<redacted>',
    SUPABASE_SERVICE_ROLE_KEY: '<redacted>',
    SUPABASE_ACCESS_TOKEN: '<redacted>'
  })
})

test('mergeEnvText preserves existing values and upserts Supabase runtime env', () => {
  assert.equal(
    mergeEnvText('VERCEL_OIDC_TOKEN=keep-me\nSUPABASE_URL=old\n', {
      SUPABASE_URL: 'https://ref123.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key'
    }),
    [
      'VERCEL_OIDC_TOKEN=keep-me',
      'SUPABASE_URL=https://ref123.supabase.co',
      'SUPABASE_ANON_KEY=anon-key',
      'SUPABASE_SERVICE_ROLE_KEY=service-key',
      ''
    ].join('\n')
  )
})

test('buildHeaders uses bearer auth without exposing token elsewhere', () => {
  assert.deepEqual(buildHeaders('token-1'), {
    Authorization: 'Bearer token-1',
    'Content-Type': 'application/json'
  })
})

test('getProjectRefFromUrl extracts Supabase project refs', () => {
  assert.equal(getProjectRefFromUrl('https://ref123.supabase.co'), 'ref123')
  assert.equal(getProjectRefFromUrl('https://ref123.supabase.co/rest/v1'), 'ref123')
  assert.equal(getProjectRefFromUrl('not-a-supabase-url'), '')
})

test('setup existing project applies migration and returns runtime env', async () => {
  const calls = []
  const fakeFetch = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method || 'GET',
      body: options.body || ''
    })

    if (String(url).endsWith('/v1/projects/ref123/api-keys')) {
      return jsonResponse([
        { name: 'anon', api_key: 'anon-key' },
        { name: 'service_role', api_key: 'service-key' }
      ])
    }

    return jsonResponse({})
  }

  const result = await setupSupabase({
    config: {
      accessToken: 'token-1',
      projectRef: 'ref123',
      projectName: 'qian-duo-duo',
      migrationPath
    },
    fetchImpl: fakeFetch,
    sleep: async () => {}
  })

  assert.deepEqual(result, {
    SUPABASE_URL: 'https://ref123.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key'
  })
  assert.ok(calls.some(call => call.url.includes('/v1/projects/ref123/database/query')))
  assert.ok(calls.some(call => call.url.includes('/v1/projects/ref123/config/auth')))
})

test('setup existing project configures auth emails to show only the email OTP', async () => {
  const calls = []
  const fakeFetch = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method || 'GET',
      body: options.body || ''
    })

    if (String(url).endsWith('/v1/projects/ref123/api-keys')) {
      return jsonResponse([
        { name: 'anon', api_key: 'anon-key' },
        { name: 'service_role', api_key: 'service-key' }
      ])
    }

    return jsonResponse({})
  }

  await setupSupabase({
    config: {
      accessToken: 'token-1',
      projectRef: 'ref123',
      projectName: 'qian-duo-duo',
      migrationPath
    },
    fetchImpl: fakeFetch,
    sleep: async () => {}
  })

  const authConfigCall = calls.find(call => call.url.endsWith('/v1/projects/ref123/config/auth'))
  assert.ok(authConfigCall)
  const authConfig = JSON.parse(authConfigCall.body)
  assert.equal(authConfig.mailer_subjects_magic_link, '钱多多登录验证码')
  assert.match(authConfig.mailer_templates_magic_link_content, /{{ \.Token }}/)
  assert.doesNotMatch(authConfig.mailer_templates_magic_link_content, /Sign in|ConfirmationURL/)
})

test('setup creates a project when no project ref is provided', async () => {
  const calls = []
  const fakeFetch = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method || 'GET',
      body: options.body || ''
    })

    if (String(url).endsWith('/v1/organizations')) {
      return jsonResponse([{ id: 'org-1', slug: 'org-slug', name: 'Personal' }])
    }

    if (String(url).endsWith('/v1/projects') && options.method === 'POST') {
      return jsonResponse({ ref: 'newref123' })
    }

    if (String(url).endsWith('/v1/projects/newref123')) {
      return jsonResponse({ status: 'ACTIVE_HEALTHY' })
    }

    if (String(url).endsWith('/v1/projects/newref123/api-keys')) {
      return jsonResponse([
        { name: 'anon', api_key: 'anon-key' },
        { name: 'service_role', api_key: 'service-key' }
      ])
    }

    return jsonResponse({})
  }

  const result = await setupSupabase({
    config: {
      accessToken: 'token-1',
      dbPassword: 'db-password',
      region: 'ap-southeast-1',
      projectName: 'qian-duo-duo',
      migrationPath
    },
    fetchImpl: fakeFetch,
    sleep: async () => {}
  })

  assert.equal(result.SUPABASE_URL, 'https://newref123.supabase.co')
  const createCall = calls.find(call => call.url.endsWith('/v1/projects') && call.method === 'POST')
  assert.ok(createCall)
  assert.match(createCall.body, /"organization_slug":"org-slug"/)
})

test('server package exposes setup:supabase', () => {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'server/package.json'), 'utf8'))
  assert.equal(pkg.scripts['setup:supabase'], 'node scripts/setup-supabase.mjs')
})
