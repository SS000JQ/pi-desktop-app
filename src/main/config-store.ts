import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

type ConfigValue = string | number | boolean | null | string[] | Record<string, unknown>
type ConfigMap = Record<string, ConfigValue>

const USER_DATA_DIR = app?.getPath ? app.getPath('userData') : join(homedir(), '.pi-desktop-test')
const CONFIG_DIR = join(USER_DATA_DIR, 'pi-desktop')
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
