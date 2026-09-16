import type { RifaApi } from './index'

declare global {
  interface Window {
    api: RifaApi
  }
}

export {}
