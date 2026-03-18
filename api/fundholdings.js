module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  const axios = require('axios')
  
  try {
    const { type, code, topline, year, month } = req.query
    const rt = Math.random().toFixed(16)
    const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=${type}&code=${code}&topline=${topline}&year=${year}&month=${month}&rt=${rt}`
    
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://fundf10.eastmoney.com/'
      }
    })
    
    res.send(response.data)
  } catch (e) {
    console.error('基金持仓代理失败:', e.message)
    res.send('')
  }
}
