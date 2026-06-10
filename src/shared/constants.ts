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
  DESKTOP_PI_RESOURCES: 'desktop:getPiResources',
  DESKTOP_SLASH_COMMANDS: 'desktop:getSlashCommands',
  PI_RUNTIME_GET_STATE: 'piRuntime:getState',
  PI_RUNTIME_GET_TOOLS: 'piRuntime:getTools',
  PI_RUNTIME_SET_TOOLS: 'piRuntime:setTools',
  PI_RUNTIME_COMPACT: 'piRuntime:compact',
  PI_RUNTIME_RELOAD_RESOURCES: 'piRuntime:reloadResources',
  PI_RUNTIME_CLONE_SESSION: 'piRuntime:cloneSession',
  PI_RUNTIME_TRUST_PROJECT: 'piRuntime:trustProject',
  PI_RUNTIME_GET_PROJECT_TRUST_STATUS: 'piRuntime:getProjectTrustStatus',
  PI_RUNTIME_STEER: 'piRuntime:steer',
  PI_RUNTIME_FOLLOW_UP: 'piRuntime:followUp',
  SKILLS_SEARCH: 'skills:search',
  SKILLS_INSTALL: 'skills:install',
  SKILLS_SET_MODEL_INVOCATION: 'skills:setModelInvocation',
  SKILLS_GET_SETTINGS: 'skills:getSettings',
  SKILLS_SET_ADDITIONAL_PATHS: 'skills:setAdditionalPaths',
  SKILLS_SET_DISABLED: 'skills:setDisabled',
} as const

export const APP_NAME = 'Pi Desktop'
export const DEFAULT_WINDOW_WIDTH = 1200
export const DEFAULT_WINDOW_HEIGHT = 800
export const MIN_WINDOW_WIDTH = 900
export const MIN_WINDOW_HEIGHT = 600
