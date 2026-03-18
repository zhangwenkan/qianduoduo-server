module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  const axios = require('axios')
  
  try {
    const { code } = req.query
    if (!code) {
      return res.send('jsonpgz({})')
    }
    const response = await axios.get(`https://fundgz.1234567.com.cn/js/${code}.js`, {
      timeout: 8000
    })
    res.send(response.data)
  } catch (e) {
    console.error('基金估值代理失败:', e.message)
    res.send('jsonpgz({})')
  }
}
