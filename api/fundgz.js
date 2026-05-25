module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  const axios = require('axios')
  
  try {
    let code = req.query.code
    
    if (!code) {
      const urlMatch = req.url.match(/\/js\/(\d+)\.js/)
      if (urlMatch) {
        code = urlMatch[1]
      }
    }
    
    if (!code) {
      return res.send('jsonpgz({})')
    }
    
    const response = await axios.get(`https://fundgz.1234567.com.cn/js/${code}.js`, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://fund.eastmoney.com/',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    })
    res.send(response.data)
  } catch (e) {
    console.error('基金估值代理失败:', e.message)
    res.send('jsonpgz({})')
  }
}
