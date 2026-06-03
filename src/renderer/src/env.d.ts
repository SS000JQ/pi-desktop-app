/// <reference types="vite/client" />

import type { PiDesktopApi } from '../../preload/api'

declare global {
  interface Window {
    piDesktop: PiDesktopApi
  }
}
