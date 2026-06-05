import type { AgentSessionEvent, SessionManager } from '@earendil-works/pi-coding-agent'

export type PiCodingAgentModule = typeof import('@earendil-works/pi-coding-agent')
export type PiSessionManager = SessionManager
export type PiAgentSessionEvent = AgentSessionEvent

let piCodingAgentModulePromise: Promise<PiCodingAgentModule> | null = null

export async function loadPiCodingAgentModule(): Promise<PiCodingAgentModule> {
  if (!piCodingAgentModulePromise) {
    piCodingAgentModulePromise = import('@earendil-works/pi-coding-agent')
  }

  return piCodingAgentModulePromise
}
