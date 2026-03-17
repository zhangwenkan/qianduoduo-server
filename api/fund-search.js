const axios = require('axios')

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  
  const { key } = req.query
  
  if (!key || key.length < 2) {
    res.status(200).json({
      code: 0,
      message: '获取成功',
      Datas: []
    })
    return
  }
  
  try {
    const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(key)}`
    const response = await axios.get(url, { timeout: 5000 })
    res.status(200).json(response.data)
  } catch (e) {
    console.error('搜索基金失败:', e.message)
    res.status(200).json({
      code: -1,
      message: '搜索失败: ' + e.message,
      Datas: []
    })
  }
}
