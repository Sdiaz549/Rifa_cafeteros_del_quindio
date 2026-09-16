export class AppError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code = 'APP_ERROR', status = 400) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
  }
}

export function toApiError(error: unknown): { ok: false; error: string; code?: string } {
  if (error instanceof AppError) {
    return { ok: false, error: error.message, code: error.code }
  }
  if (error instanceof Error) {
    return { ok: false, error: error.message }
  }
  return { ok: false, error: 'Error inesperado.' }
}
