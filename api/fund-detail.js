const axios = require('axios')

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  
  const code = req.query.code || (req.url && req.url.match(/\/api\/fund-detail\/(\d+)/)?.[1])
  
  if (!code) {
    res.status(200).json({ code: -1, message: '请提供基金代码' })
    return
  }
  
  try {
    const url = `https://fundgz.1234567.com.cn/js/${code}.js`
    const response = await axios.get(url, { timeout: 5000 })
    const text = response.data
    const match = text.match(/jsonpgz\((.+)\)/)
    if (match) {
      const data = JSON.parse(match[1])
      res.status(200).json(data)
    } else {
      res.status(200).json({ code: -1, message: '获取失败' })
    }
  } catch (e) {
    console.error('获取基金详情失败:', e.message)
    res.status(200).json({ code: -1, message: '获取失败: ' + e.message })
  }
}
