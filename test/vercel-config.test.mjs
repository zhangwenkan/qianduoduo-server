import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const serverRoot = resolve(testDir, '..')

test('root path rewrites to the serverless root handler', () => {
  const config = JSON.parse(readFileSync(resolve(serverRoot, 'vercel.json'), 'utf8'))

  assert.ok(config.rewrites.some(rewrite => (
    rewrite.source === '/' && rewrite.destination === '/api/root'
  )))
})
