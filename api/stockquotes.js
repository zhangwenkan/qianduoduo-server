module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  const axios = require('axios')
  
  try {
    const codes = req.query
    const queryString = Object.entries(codes).map(([k, v]) => `${k}=${v}`).join('&')
    const response = await axios.get(`https://web.sqt.gtimg.cn/q=${queryString.replace('q=', '')}`, {
      timeout: 8000
    })
    res.send(response.data)
  } catch (e) {
    console.error('股票行情代理失败:', e.message)
    res.send('')
  }
}
