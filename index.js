const express = require('express')
const cors = require('cors')
const axios = require('axios')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

const STOCK_SECTOR_MAP = {
  '600519': '白酒', '000858': '白酒', '600809': '白酒', '000568': '白酒',
  '002304': '白酒', '000596': '白酒', '603369': '白酒', '603198': '白酒',
  '600702': '白酒', '603589': '白酒',
  
  '601633': '汽车零部件', '000625': '汽车零部件', '600104': '汽车零部件',
  '002594': '汽车零部件', '601238': '汽车零部件', '600741': '汽车零部件',
  '000951': '汽车零部件', '600066': '汽车零部件', '601799': '汽车零部件',
  '002920': '汽车零部件', '603305': '汽车零部件',
  
  '600031': '高端制造', '000157': '高端制造', '601100': '高端制造',
  '603789': '高端制造', '002097': '高端制造', '600815': '高端制造',
  '601877': '高端制造', '002523': '高端制造', '603160': '高端制造',
  
  '600745': '存储芯片', '600584': '存储芯片', '300782': '存储芯片',
  '600460': '存储芯片', '300661': '存储芯片', '002049': '存储芯片',
  '603986': '存储芯片', '603501': '存储芯片', '688981': '存储芯片',
  
  '601012': '新能源', '300274': '新能源', '002506': '新能源',
  '600438': '新能源', '601865': '新能源', '002129': '新能源',
  '300750': '新能源', '002594': '新能源', '300014': '新能源',
  
  '600276': '医药', '601607': '医药', '000538': '医药',
  '600085': '医药', '300760': '医药', '688180': '医药',
  '002821': '医药', '300122': '医药', '603259': '医药',
  
  '601318': '保险', '601601': '保险', '601628': '保险',
  '601336': '保险', '002142': '保险',
  
  '000001': '银行', '600036': '银行', '601398': '银行',
  '601288': '银行', '601939': '银行', '601988': '银行',
  '600016': '银行', '601166': '银行', '600000': '银行',
  
  '600030': '券商', '601211': '券商', '600837': '券商',
  '601688': '券商', '600109': '券商', '601788': '券商',
  
  '600489': '黄金', '600547': '黄金', '601899': '黄金',
  '002155': '黄金', '600311': '黄金', '002716': '黄金',
  
  '300308': 'CPO', '300394': 'CPO', '688256': 'CPO',
  '002281': 'CPO', '300620': 'CPO', '688047': 'CPO',
  
  '600941': '运营商', '601728': '运营商', '601941': '运营商',
  
  '002475': '消费电子', '002241': '消费电子', '600745': '消费电子',
  '002600': '消费电子', '603501': '消费电子', '688111': '消费电子',
  
  '688981': '半导体', '688012': '半导体', '688008': '半导体',
  '688256': '半导体', '688047': '半导体', '688396': '半导体',
  '603986': '半导体', '603501': '半导体', '002049': '半导体',
  
  '600309': '化工', '000830': '化工', '002648': '化工',
  '600426': '化工', '000703': '化工', '002408': '化工'
}

const NAME_KEYWORDS = {
  '白酒': '白酒', '消费': '消费', '医药': '医药', '医疗': '医疗',
  '科技': '科技', '半导体': '半导体', '芯片': '芯片', '新能源': '新能源',
  '光伏': '光伏', '锂电': '锂电', '汽车': '汽车', '军工': '军工',
  '银行': '银行', '证券': '券商', '保险': '保险', '地产': '地产',
  '煤炭': '煤炭', '钢铁': '钢铁', '有色': '有色金属', '黄金': '黄金',
  '石油': '石油', '化工': '化工', '农业': '农业', '传媒': '传媒',
  '游戏': '游戏', '互联网': '互联网', '人工智能': 'AI', 'AI': 'AI',
  '5G': '5G', '通信': '通信', '电子': '电子', '计算机': '计算机',
  '机械': '机械', '制造': '制造', '环保': '环保', '电力': '电力',
  '基建': '基建', '建筑': '建筑', '建材': '建材', '家电': '家电',
  '食品': '食品', '旅游': '旅游', '物流': '物流', '航空': '航空',
  '港股': '港股', '美股': '美股', '纳斯达克': '纳斯达克', '标普': '标普',
  '创业板': '创业板', '科创板': '科创板', '沪深300': '沪深300',
  '中证500': '中证500', '红利': '红利', '价值': '价值', '成长': '成长',
  '蓝筹': '蓝筹', '央企': '央企', '国企': '国企', 'CPO': 'CPO',
  '高端制造': '高端制造', '存储芯片': '存储芯片', '汽车零部件': '汽车零部件'
}

async function getFundHoldings(fundCode) {
  try {
    const url = `https://fund.eastmoney.com/pingzhongdata/${fundCode}.js`
    const response = await axios.get(url, { timeout: 5000 })
    const text = response.data
    const match = text.match(/var\s+stockCodes\s*=\s*(\[[\s\S]*?\]);/)
    if (match) {
      const codes = eval(match[1])
      return codes.map(code => code.replace(/[01]$/, '')).slice(0, 10)
    }
    return []
  } catch (e) {
    console.error(`获取基金${fundCode}持仓失败:`, e.message)
    return []
  }
}

async function getFundName(fundCode) {
  try {
    const url = `https://fundgz.1234567.com.cn/js/${fundCode}.js`
    const response = await axios.get(url, { timeout: 5000 })
    const text = response.data
    const match = text.match(/jsonpgz\((\{.*?\})\)/)
    if (match) {
      const data = JSON.parse(match[1])
      return data.name || ''
    }
    return ''
  } catch (e) {
    return ''
  }
}

async function analyzeSector(fundCode) {
  const holdings = await getFundHoldings(fundCode)
  
  if (holdings.length > 0) {
    const sectorCount = {}
    for (const stockCode of holdings) {
      const sector = STOCK_SECTOR_MAP[stockCode]
      if (sector) {
        sectorCount[sector] = (sectorCount[sector] || 0) + 1
      }
    }
    
    const sorted = Object.entries(sectorCount).sort((a, b) => b[1] - a[1])
    if (sorted.length > 0) {
      return sorted[0][0]
    }
  }
  
  const fundName = await getFundName(fundCode)
  if (fundName) {
    for (const [keyword, sector] of Object.entries(NAME_KEYWORDS)) {
      if (fundName.includes(keyword)) {
        return sector
      }
    }
  }
  
  return '混合'
}

app.get('/', (req, res) => {
  res.json({ 
    name: '钱多多 API',
    version: '1.0.0',
    endpoints: ['/api/fund-sectors']
  })
})

app.post('/api/fund-sectors', async (req, res) => {
  const { codes } = req.body
  
  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    return res.json({
      code: -1,
      message: '请提供基金代码数组',
      data: null
    })
  }
  
  try {
    const sectors = {}
    const promises = codes.map(async (code) => {
      sectors[code] = await analyzeSector(code)
    })
    
    await Promise.all(promises)
    
    res.json({
      code: 0,
      message: '获取成功',
      data: { sectors }
    })
  } catch (e) {
    console.error('获取基金板块失败:', e)
    res.json({
      code: -1,
      message: '获取失败: ' + e.message,
      data: null
    })
  }
})

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

app.post('/api/fund-holdings', async (req, res) => {
  const { code } = req.body
  
  if (!code) {
    return res.json({
      code: -1,
      message: '请提供基金代码',
      data: null
    })
  }
  
  try {
    const holdings = await getFundTopHoldings(code)
    
    res.json({
      code: 0,
      message: '获取成功',
      data: { holdings }
    })
  } catch (e) {
    console.error('获取基金持仓失败:', e)
    res.json({
      code: -1,
      message: '获取失败: ' + e.message,
      data: null
    })
  }
})

app.listen(PORT, () => {
  console.log(`钱多多后端服务运行在端口 ${PORT}`)
})
