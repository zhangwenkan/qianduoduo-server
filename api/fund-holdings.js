const axios = require('axios')

async function getFundTopHoldings(fundCode) {
  try {
    const url = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${fundCode}&topline=10&year=&month=&rt=${Math.random().toFixed(16)}`
    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://fundf10.eastmoney.com/'
      }
    })
    
    const text = response.data
    const holdings = []
    
    const tbodyMatch = text.match(/<tbody>([\s\S]*?)<\/tbody>/)
    if (tbodyMatch) {
      const tbody = tbodyMatch[1]
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g
      let rowMatch
      
      while ((rowMatch = rowRegex.exec(tbody)) !== null) {
        const row = rowMatch[1]
        const cells = []
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g
        let cellMatch
        
        while ((cellMatch = cellRegex.exec(row)) !== null) {
          const cellContent = cellMatch[1].replace(/<[^>]*>/g, '').trim()
          cells.push(cellContent)
        }
        
        if (cells.length >= 8) {
          const rank = parseInt(cells[0])
          const stockCode = cells[1]
          const name = cells[2]
          const percent = cells[6] || '--'
          const shares = cells[7] || '--'
          
          if (name && stockCode && !isNaN(rank)) {
            holdings.push({
              rank: rank,
              name: name,
              code: stockCode,
              percent: percent,
              shares: shares
            })
          }
        }
      }
    }
    
    return holdings
  } catch (e) {
    console.error(`获取基金${fundCode}持仓失败:`, e.message)
    return []
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ code: -1, message: 'Method not allowed', data: null })
    return
  }
  
  const { code } = req.body
  
  if (!code) {
    res.status(200).json({
      code: -1,
      message: '请提供基金代码',
      data: null
    })
    return
  }
  
  try {
    const holdings = await getFundTopHoldings(code)
    
    res.status(200).json({
      code: 0,
      message: '获取成功',
      data: { holdings }
    })
  } catch (e) {
    console.error('获取基金持仓失败:', e)
    res.status(200).json({
      code: -1,
      message: '获取失败: ' + e.message,
      data: null
    })
  }
}
