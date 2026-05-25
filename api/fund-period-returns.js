const axios = require('axios')

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { code } = req.query
    if (!code) {
      return res.send('var apidata={ content:"" };')
    }
    const rt = Math.random().toFixed(16)
    const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jdzf&code=${code}&rt=${rt}`

    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://fundf10.eastmoney.com/'
      }
    })

    res.send(response.data)
  } catch (e) {
    console.error('基金阶段涨幅代理失败:', e.message)
    res.send('var apidata={ content:"" };')
  }
}
