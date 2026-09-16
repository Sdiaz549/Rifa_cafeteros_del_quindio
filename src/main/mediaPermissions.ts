import { app, session, type Session } from 'electron'

/** Must run before app.whenReady(). */
export function appendMediaCommandLineSwitches(): void {
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream')
  app.commandLine.appendSwitch('enable-speech-input')
  app.commandLine.appendSwitch('disable-features', 'AudioServiceSandbox')
}

export function grantMicrophoneAccess(ses: Session = session.defaultSession): void {
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
  })

  ses.setPermissionCheckHandler((_wc, permission) => permission === 'media')
}
