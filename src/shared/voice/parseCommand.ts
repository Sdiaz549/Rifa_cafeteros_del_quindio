export type VoiceAction =
  | 'BUSCAR_BOLETA'
  | 'BUSCAR_VENDEDOR'
  | 'MOSTRAR_SIN_VENDER'
  | 'MOSTRAR_EN_ABONOS'
  | 'MOSTRAR_PERDIDAS'
  | 'MOSTRAR_LIQUIDADAS'
  | 'REGISTRAR_ABONO'
  | 'CONFIRMAR'
  | 'DESCONOCIDO'

export interface VoiceCommand {
  action: VoiceAction
  ticketNumber?: number
  sellerName?: string
  amount?: number
  paymentMethodName?: string
  raw: string
}

const NUMBER_WORDS: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  dieciséis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  mil: 1000
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Parse Spanish money phrases like "cincuenta mil" → 50000 */
export function parseSpanishAmount(text: string): number | undefined {
  const n = normalize(text)
  const digits = n.match(/\d[\d.]*/)
  if (digits) {
    return Number(digits[0].replace(/\./g, ''))
  }

  const tokens = n.split(' ')
  let total = 0
  let current = 0
  for (const token of tokens) {
    if (!(token in NUMBER_WORDS)) continue
    const value = NUMBER_WORDS[token]
    if (value === 1000) {
      current = (current || 1) * 1000
      total += current
      current = 0
    } else if (value === 100) {
      current = (current || 1) * 100
    } else {
      current += value
    }
  }
  total += current
  return total > 0 ? total : undefined
}

export function parseVoiceCommand(raw: string): VoiceCommand {
  const text = normalize(raw)

  if (/^(si|sí|confirmar|confirmo)/.test(text) || text.includes('si confirmar')) {
    return { action: 'CONFIRMAR', raw }
  }

  const abonoMatch = text.match(
    /(?:registrar\s+)?abono(?:\s+de)?\s+(.+?)\s+(?:a\s+)?(?:la\s+)?boleta\s+(\d+)(?:\s+por\s+(.+))?/
  )
  if (abonoMatch || text.includes('registrar abono')) {
    const amountText = abonoMatch?.[1] ?? ''
    const ticket = abonoMatch ? Number(abonoMatch[2]) : undefined
    const method = abonoMatch?.[3]?.trim()
    return {
      action: 'REGISTRAR_ABONO',
      ticketNumber: ticket != null && !Number.isNaN(ticket) ? ticket : undefined,
      amount: parseSpanishAmount(amountText.replace(/\bpesos\b/g, '')),
      paymentMethodName: method ? method.replace(/\bpor\b/g, '').trim() : undefined,
      raw
    }
  }

  const boletaMatch = text.match(/boleta\s+(\d+)/)
  if (text.includes('buscar boleta') || (text.includes('boleta') && boletaMatch)) {
    return {
      action: 'BUSCAR_BOLETA',
      ticketNumber: boletaMatch ? Number(boletaMatch[1]) : undefined,
      raw
    }
  }

  if (/^\d{1,4}$/.test(text)) {
    return { action: 'BUSCAR_BOLETA', ticketNumber: Number(text), raw }
  }

  const sellerMatch = text.match(/vendedor(?:a)?\s+(.+)$/)
  if (text.includes('buscar vendedor') || text.includes('mostrar boletas') && sellerMatch) {
    // continue below for show commands with seller
  }

  if (text.includes('sin vender')) {
    const name = text.match(/de\s+(.+)$/)?.[1]
    return {
      action: 'MOSTRAR_SIN_VENDER',
      sellerName: name && !name.includes('boleta') ? name.trim() : undefined,
      raw
    }
  }

  if (text.includes('en abonos')) {
    return { action: 'MOSTRAR_EN_ABONOS', raw }
  }

  if (text.includes('perdidas') || text.includes('perdida')) {
    return { action: 'MOSTRAR_PERDIDAS', raw }
  }

  if (text.includes('liquidadas') || text.includes('liquidada')) {
    const name = text.match(/de\s+(.+)$/)?.[1]
    return {
      action: 'MOSTRAR_LIQUIDADAS',
      sellerName: name?.trim(),
      raw
    }
  }

  if (text.includes('buscar vendedor') || text.includes('vendedor')) {
    const name = text.replace(/.*vendedor(?:a)?\s+/, '').trim()
    return { action: 'BUSCAR_VENDEDOR', sellerName: name || undefined, raw }
  }

  return { action: 'DESCONOCIDO', raw }
}
