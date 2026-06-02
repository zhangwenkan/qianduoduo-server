const { existsSync, readFileSync } = require('fs')
const { resolve } = require('path')

const parseLine = (line) => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const index = trimmed.indexOf('=')
  if (index <= 0) return null

  const key = trimmed.slice(0, index).trim()
  let value = trimmed.slice(index + 1).trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1)
  }
  return [key, value]
}

const loadEnvFile = (filePath = resolve(__dirname, '.env.local')) => {
  if (!existsSync(filePath)) return {}

  const loaded = {}
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const entry = parseLine(line)
    if (!entry) continue

    const [key, value] = entry
    if (process.env[key] !== undefined) continue
    process.env[key] = value
    loaded[key] = value
  }
  return loaded
}

module.exports = {
  loadEnvFile
}
