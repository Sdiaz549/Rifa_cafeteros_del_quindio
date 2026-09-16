import { app } from 'electron'
import type { AppRuntimeInfo } from '../../shared/types'

export function getAppRuntimeInfo(): AppRuntimeInfo {
  return {
    version: app.getVersion(),
    name: app.getName(),
    packaged: app.isPackaged
  }
}
