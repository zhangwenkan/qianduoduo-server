const { app } = require('../index.js')

const endpoints = [
  '/api/auth/send-code',
  '/api/auth/verify-code',
  '/api/me/data',
  '/api/fund-sectors',
  '/api/fund-holdings',
  '/api/fund-period-returns',
  '/api/fundsearch',
  '/api/fundgz',
  '/api/stockquotes',
  '/api/fundholdings'
]

module.exports = (req, res) => {
  if (req.url === '/' || req.url === '/api' || req.url === '/api/index') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({
      name: '钱多多 API',
      version: '1.0.0',
      endpoints
    }))
    return
  }

  app(req, res)
}
