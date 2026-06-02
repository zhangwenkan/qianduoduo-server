const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

process.env.SUPABASE_URL = 'https://example.supabase.co'
process.env.SUPABASE_ANON_KEY = 'anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'

const { createApp } = require('../index.js')
const apiHandler = require('../api/index.js')

function request(app, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      const payload = body === undefined ? null : JSON.stringify(body)
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers
        }
      }, (res) => {
        let raw = ''
        res.on('data', chunk => { raw += chunk })
        res.on('end', () => {
          server.close()
          resolve({
            status: res.statusCode,
            body: raw ? JSON.parse(raw) : null
          })
        })
      })
      req.on('error', err => {
        server.close()
        reject(err)
      })
      if (payload) req.write(payload)
      req.end()
    })
  })
}

function requestHandler(handler, method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      const payload = body === undefined ? null : JSON.stringify(body)
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers
        }
      }, (res) => {
        let raw = ''
        res.on('data', chunk => { raw += chunk })
        res.on('end', () => {
          server.close()
          resolve({
            status: res.statusCode,
            body: raw ? JSON.parse(raw) : null
          })
        })
      })
      req.on('error', err => {
        server.close()
        reject(err)
      })
      if (payload) req.write(payload)
      req.end()
    })
  })
}

test('sends an email login code', async () => {
  const sent = []
  const app = createApp({
    authService: {
      sendOtp: async (email) => sent.push(email)
    }
  })

  const res = await request(app, 'POST', '/api/auth/send-code', { email: 'me@example.com' })

  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { code: 0, message: '验证码已发送' })
  assert.deepEqual(sent, ['me@example.com'])
})

test('rejects invalid email before sending a code', async () => {
  let called = false
  const app = createApp({
    authService: {
      sendOtp: async () => { called = true }
    }
  })

  const res = await request(app, 'POST', '/api/auth/send-code', { email: 'bad-email' })

  assert.equal(res.status, 400)
  assert.equal(res.body.code, -1)
  assert.equal(called, false)
})

test('returns a clear error when Supabase rejects an email address', async () => {
  const app = createApp({
    authService: {
      sendOtp: async () => {
        throw new Error('Email address "codex-local-test@example.com" is invalid')
      }
    }
  })

  const res = await request(app, 'POST', '/api/auth/send-code', { email: 'codex-local-test@example.com' })

  assert.equal(res.status, 400)
  assert.equal(res.body.code, -1)
  assert.equal(res.body.message, '邮箱地址无效，请换一个真实邮箱')
})

test('returns a clear error when Supabase rate limits email sending', async () => {
  const app = createApp({
    authService: {
      sendOtp: async () => {
        throw new Error('email rate limit exceeded')
      }
    }
  })

  const res = await request(app, 'POST', '/api/auth/send-code', { email: 'me@example.com' })

  assert.equal(res.status, 429)
  assert.equal(res.body.code, -1)
  assert.equal(res.body.message, '验证码发送太频繁，请稍后再试')
})

test('verifies an email code and returns a local session payload', async () => {
  const app = createApp({
    authService: {
      verifyOtp: async (email, token) => ({
        user: { id: 'user-1', email },
        session: { access_token: `access-${token}`, refresh_token: 'refresh-1', expires_at: 1893456000 }
      })
    }
  })

  const res = await request(app, 'POST', '/api/auth/verify-code', {
    email: 'me@example.com',
    code: '12345678'
  })

  assert.equal(res.status, 200)
  assert.equal(res.body.code, 0)
  assert.deepEqual(res.body.data, {
    user: { id: 'user-1', email: 'me@example.com' },
    accessToken: 'access-12345678',
    refreshToken: 'refresh-1',
    expiresAt: 1893456000
  })
})

test('requires bearer auth for account data', async () => {
  const app = createApp({
    authService: {
      getUserFromToken: async () => ({ id: 'user-1', email: 'me@example.com' })
    },
    dataService: {
      getAccountData: async () => ({ holdings: [], notes: [], watchlist: [] })
    }
  })

  const res = await request(app, 'GET', '/api/me/data')

  assert.equal(res.status, 401)
  assert.equal(res.body.code, -1)
})

test('serverless account data route requires bearer auth', async () => {
  const res = await requestHandler(apiHandler, 'GET', '/api/me/data')

  assert.equal(res.status, 401)
  assert.equal(res.body.code, -1)
})

test('serverless root route returns API metadata', async () => {
  const res = await requestHandler(apiHandler, 'GET', '/')

  assert.equal(res.status, 200)
  assert.equal(res.body.name, '钱多多 API')
})

test('returns account data for the authenticated user', async () => {
  const requestedUsers = []
  const app = createApp({
    authService: {
      getUserFromToken: async (token) => {
        assert.equal(token, 'token-1')
        return { id: 'user-1', email: 'me@example.com' }
      }
    },
    dataService: {
      getAccountData: async (userId) => {
        requestedUsers.push(userId)
        return { holdings: [{ fundCode: '000001' }], notes: [], watchlist: [] }
      }
    }
  })

  const res = await request(app, 'GET', '/api/me/data', undefined, {
    Authorization: 'Bearer token-1'
  })

  assert.equal(res.status, 200)
  assert.equal(res.body.code, 0)
  assert.deepEqual(res.body.data.holdings, [{ fundCode: '000001' }])
  assert.deepEqual(requestedUsers, ['user-1'])
})

test('saves account data for the authenticated user', async () => {
  const saved = []
  const app = createApp({
    authService: {
      getUserFromToken: async () => ({ id: 'user-1', email: 'me@example.com' })
    },
    dataService: {
      saveAccountData: async (userId, data) => {
        saved.push({ userId, data })
        return data
      }
    }
  })

  const payload = { holdings: [], notes: [{ id: 'n1', content: 'hello' }], watchlist: [] }
  const res = await request(app, 'PUT', '/api/me/data', payload, {
    Authorization: 'Bearer token-1'
  })

  assert.equal(res.status, 200)
  assert.equal(res.body.code, 0)
  assert.deepEqual(saved, [{ userId: 'user-1', data: payload }])
})
