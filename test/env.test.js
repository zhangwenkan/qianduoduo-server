const test = require('node:test')
const assert = require('node:assert/strict')
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')

const { loadEnvFile } = require('../env.js')

test('loads values from a local env file without overriding existing env', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qdd-env-'))
  const envPath = join(dir, '.env.local')
  const originalUrl = process.env.SUPABASE_URL
  const originalAnon = process.env.SUPABASE_ANON_KEY

  try {
    delete process.env.SUPABASE_URL
    process.env.SUPABASE_ANON_KEY = 'existing-anon'
    writeFileSync(envPath, [
      '# comment',
      'SUPABASE_URL=https://example.supabase.co',
      'SUPABASE_ANON_KEY=file-anon',
      '',
      'SUPABASE_SERVICE_ROLE_KEY=service=value'
    ].join('\n'))

    const loaded = loadEnvFile(envPath)

    assert.deepEqual(loaded, {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service=value'
    })
    assert.equal(process.env.SUPABASE_URL, 'https://example.supabase.co')
    assert.equal(process.env.SUPABASE_ANON_KEY, 'existing-anon')
    assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, 'service=value')
  } finally {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = originalUrl

    if (originalAnon === undefined) delete process.env.SUPABASE_ANON_KEY
    else process.env.SUPABASE_ANON_KEY = originalAnon

    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    rmSync(dir, { recursive: true, force: true })
  }
})
