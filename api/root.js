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
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(200).json({
    name: '钱多多 API',
    version: '1.0.0',
    endpoints
  })
}
