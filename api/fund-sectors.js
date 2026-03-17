const axios = require('axios')

const SECTOR_CACHE = {}
const CACHE_EXPIRE = 3600000

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
  '高端制造': '高端制造', '存储芯片': '存储芯片', '汽车零部件': '汽车零部件',
  '文体': '文体健康', '健康': '文体健康'
}

const INDUSTRY_MAP = {
  '制造业': '制造',
  '信息传输、软件和信息技术服务业': '科技',
  '金融业': '金融',
  '采矿业': '资源',
  '交通运输、仓储和邮政业': '物流',
  '批发和零售业': '消费',
  '房地产业': '地产',
  '建筑业': '建筑',
  '电力、热力、燃气及水生产和供应业': '公用事业',
  '科学研究和技术服务业': '科技服务',
  '水利、环境和公共设施管理业': '环保',
  '教育': '教育',
  '卫生和社会工作': '医疗',
  '文化、体育和娱乐业': '传媒'
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

async function getFundIndustry(fundCode) {
  try {
    const url = `https://fundf10.eastmoney.com/hytz_${fundCode}.html`
    const response = await axios.get(url, { 
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://fundf10.eastmoney.com/'
      }
    })
    const html = response.data
    
    const industryRegex = /<td[^>]*>([^<]+)<\/td>\s*<td[^>]*class="[^"]*(?:tor|tol)[^"]*"[^>]*>([\d.]+)%/g
    const industries = []
    let match
    
    while ((match = industryRegex.exec(html)) !== null) {
      const name = match[1].trim()
      const percent = parseFloat(match[2])
      if (name && !isNaN(percent) && percent > 0) {
        industries.push({ name, percent })
      }
    }
    
    if (industries.length > 0) {
      industries.sort((a, b) => b.percent - a.percent)
      const top = industries[0]
      return INDUSTRY_MAP[top.name] || top.name.replace(/业$/, '')
    }
    
    return null
  } catch (e) {
    console.error(`获取基金${fundCode}行业失败:`, e.message)
    return null
  }
}

async function getFundHoldings(fundCode) {
  try {
    const url = `https://fund.eastmoney.com/pingzhongdata/${fundCode}.js`
    const response = await axios.get(url, { timeout: 5000 })
    const text = response.data
    
    const nameMatch = text.match(/var\s+fS_name\s*=\s*"([^"]+)"/)
    const fundName = nameMatch ? nameMatch[1] : ''
    
    const stockMatch = text.match(/var\s+stockCodes\s*=\s*(\[[\s\S]*?\]);/)
    if (stockMatch) {
      const codes = eval(stockMatch[1])
      return {
        codes: codes.map(code => code.replace(/[01]$/, '')).slice(0, 10),
        fundName
      }
    }
    return { codes: [], fundName }
  } catch (e) {
    console.error(`获取基金${fundCode}持仓失败:`, e.message)
    return { codes: [], fundName: '' }
  }
}

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
  '300750': '新能源', '300014': '新能源',
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
  '002475': '消费电子', '002241': '消费电子',
  '002600': '消费电子', '688111': '消费电子',
  '688981': '半导体', '688012': '半导体', '688008': '半导体',
  '688256': '半导体', '688047': '半导体', '688396': '半导体',
  '600309': '化工', '000830': '化工', '002648': '化工',
  '600426': '化工', '000703': '化工', '002408': '化工',
  '603486': '消费电子', '689009': '智能设备', '002311': '农业',
  '000333': '家电', '002749': '化工', '002595': '高端制造',
  '688301': '医疗设备', '002558': '游戏', '601231': '电子',
  '002318': '制造', '600690': '家电', '600273': '化工',
  '300627': '科技', '603129': '消费', '688608': '科技'
}

async function getStockSector(stockCode) {
  const cacheKey = `stock_${stockCode}`
  const cached = SECTOR_CACHE[cacheKey]
  if (cached && Date.now() - cached.time < CACHE_EXPIRE) {
    return cached.sector
  }
  
  if (STOCK_SECTOR_MAP[stockCode]) {
    return STOCK_SECTOR_MAP[stockCode]
  }
  
  try {
    const market = stockCode.startsWith('6') ? '1' : '0'
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${market}.${stockCode}&fields=f127`
    const response = await axios.get(url, { 
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/'
      }
    })
    
    const data = response.data
    if (data && data.data && data.data.f127) {
      let sector = data.data.f127
      sector = sector.replace(/行业$/, '').trim()
      SECTOR_CACHE[cacheKey] = { sector, time: Date.now() }
      return sector
    }
    return null
  } catch (e) {
    console.error(`获取股票${stockCode}板块失败:`, e.message)
    return null
  }
}

async function getStockSectorsBatch(stockCodes) {
  const results = {}
  const uncachedCodes = []
  
  for (const code of stockCodes) {
    if (STOCK_SECTOR_MAP[code]) {
      results[code] = STOCK_SECTOR_MAP[code]
      continue
    }
    
    const cacheKey = `stock_${code}`
    const cached = SECTOR_CACHE[cacheKey]
    if (cached && Date.now() - cached.time < CACHE_EXPIRE) {
      results[code] = cached.sector
    } else {
      uncachedCodes.push(code)
    }
  }
  
  if (uncachedCodes.length > 0) {
    const promises = uncachedCodes.map(async (code) => {
      const sector = await getStockSector(code)
      results[code] = sector
    })
    await Promise.all(promises)
  }
  
  return results
}

async function analyzeSector(fundCode) {
  const industry = await getFundIndustry(fundCode)
  if (industry) {
    return industry
  }
  
  const { codes, fundName } = await getFundHoldings(fundCode)
  
  if (codes.length > 0) {
    const stockSectors = await getStockSectorsBatch(codes)
    const sectorCount = {}
    
    for (const stockCode of codes) {
      const sector = stockSectors[stockCode]
      if (sector) {
        sectorCount[sector] = (sectorCount[sector] || 0) + 1
      }
    }
    
    const sorted = Object.entries(sectorCount).sort((a, b) => b[1] - a[1])
    if (sorted.length > 0) {
      return sorted[0][0]
    }
  }
  
  const name = fundName || await getFundName(fundCode)
  if (name) {
    for (const [keyword, sector] of Object.entries(NAME_KEYWORDS)) {
      if (name.includes(keyword)) {
        return sector
      }
    }
  }
  
  return '混合'
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
  
  const { codes } = req.body
  
  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    res.status(200).json({
      code: -1,
      message: '请提供基金代码数组',
      data: null
    })
    return
  }
  
  try {
    const sectors = {}
    const promises = codes.map(async (code) => {
      sectors[code] = await analyzeSector(code)
    })
    
    await Promise.all(promises)
    
    res.status(200).json({
      code: 0,
      message: '获取成功',
      data: { sectors }
    })
  } catch (e) {
    console.error('获取基金板块失败:', e)
    res.status(200).json({
      code: -1,
      message: '获取失败: ' + e.message,
      data: null
    })
  }
}
