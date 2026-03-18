module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  const axios = require('axios')
  
  try {
    const { m, key, _t } = req.query
    const response = await axios.get('https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx', {
      params: { m, key, _t },
      timeout: 8000
    })
    res.json(response.data)
  } catch (e) {
    console.error('基金搜索代理失败:', e.message)
    res.json({ Datas: [] })
  }
}
