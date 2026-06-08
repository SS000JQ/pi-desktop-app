export const IPC_CHANNELS = {
  CHAT_SEND: 'chat:send',
  CHAT_ABORT: 'chat:abort',
  AGENT_EVENT: 'agent:event',
  SESSION_LIST: 'session:list',
  SESSION_CREATE: 'session:create',
  SESSION_DELETE: 'session:delete',
  SESSION_SEARCH: 'session:search',
  SESSION_SWITCH: 'session:switch',
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  ARTIFACTS_LIST: 'artifacts:list',
  ARTIFACTS_GET: 'artifacts:get',
  ARTIFACTS_HISTORY: 'artifacts:history',
  ARTIFACTS_REFRESH: 'artifacts:refresh',
  ARTIFACTS_PIN: 'artifacts:pin',
  ARTIFACTS_PRIMARY: 'artifacts:primary',
  DESKTOP_ENVIRONMENT: 'desktop:getEnvironmentStatus',
} as const

export const APP_NAME = 'Pi Desktop'
export const DEFAULT_WINDOW_WIDTH = 1200
export const DEFAULT_WINDOW_HEIGHT = 800
export const MIN_WINDOW_WIDTH = 900
export const MIN_WINDOW_HEIGHT = 600
