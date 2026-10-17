/** Timeouts so a escritura no deja el buscador esperando para siempre. */
export const SQLITE_TX = { maxWait: 2_000, timeout: 8_000 } as const
