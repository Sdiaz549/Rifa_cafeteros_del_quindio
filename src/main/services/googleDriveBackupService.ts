/**
 * Integración Google Drive (OAuth 2.0).
 *
 * Fase 1: estructura lista, sin credenciales reales ni llamadas de red.
 * Las copias de seguridad se crean primero en disco local; Drive es destino
 * secundario de archivo, nunca la base de datos en vivo.
 */

export interface GoogleDriveOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
}

export interface GoogleDriveFile {
  id: string
  name: string
  createdTime: string
  sizeBytes: number
}

export interface GoogleDriveConnectionStatus {
  configured: boolean
  connected: boolean
  accountEmail: string | null
  folderId: string | null
  lastError: string | null
}

const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/drive.file'
]

export class GoogleDriveBackupService {
  private config: GoogleDriveOAuthConfig | null = null

  configure(config: GoogleDriveOAuthConfig): void {
    this.config = {
      ...config,
      scopes: config.scopes.length ? config.scopes : DEFAULT_SCOPES
    }
  }

  isConfigured(): boolean {
    return Boolean(this.config?.clientId && this.config.clientSecret)
  }

  getStatus(): GoogleDriveConnectionStatus {
    return {
      configured: this.isConfigured(),
      connected: false,
      accountEmail: null,
      folderId: null,
      lastError: this.isConfigured()
        ? null
        : 'Google Drive no está conectado. Configure OAuth 2.0 en Configuración.'
    }
  }

  /** URL de consentimiento OAuth. No implementado hasta cargar credenciales. */
  buildAuthorizationUrl(): string {
    throw new Error(
      'OAuth 2.0 de Google Drive aún no está configurado. No se han cargado credenciales.'
    )
  }

  async exchangeCode(_code: string): Promise<never> {
    throw new Error('El intercambio de código OAuth 2.0 se implementará en la fase de backups.')
  }

  async uploadBackupToDrive(_localFilePath: string): Promise<GoogleDriveFile> {
    throw new Error(
      'La subida a Google Drive está preparada pero no activa. El respaldo permanece en la carpeta local.'
    )
  }

  async listDriveBackups(): Promise<GoogleDriveFile[]> {
    if (!this.isConfigured()) {
      return []
    }
    throw new Error('Listado de Drive se implementará tras conectar una cuenta de Google.')
  }

  async downloadBackup(_driveFileId: string, _destinationPath: string): Promise<void> {
    throw new Error('Descarga desde Drive se implementará tras conectar una cuenta de Google.')
  }
}

export const googleDriveBackupService = new GoogleDriveBackupService()
