import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

type ConfigValue = string | number | boolean | null
type ConfigMap = Record<string, ConfigValue>

const CONFIG_DIR = join(app.getPath('userData'), 'pi-desktop')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

function readConfig(): ConfigMap {
  try {
    if (!existsSync(CONFIG_PATH)) return {}
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as ConfigMap
  } catch {
    return {}
  }
}

function writeConfig(config: ConfigMap): void {
  ensureConfigDir()
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export function getConfigValue(key: string): ConfigValue {
  const config = readConfig()
  return key in config ? config[key] : null
}

export function setConfigValue(key: string, value: ConfigValue): void {
  const config = readConfig()
  config[key] = value
  writeConfig(config)
}
