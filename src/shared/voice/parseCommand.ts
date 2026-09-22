export type VoiceAction =
  | 'BUSCAR_BOLETA'
  | 'BUSCAR_VENDEDOR'
  | 'MOSTRAR_SIN_VENDER'
  | 'MOSTRAR_EN_ABONOS'
  | 'MOSTRAR_PERDIDAS'
  | 'MOSTRAR_LIQUIDADAS'
  | 'REGISTRAR_ABONO'
  | 'IR_ABONOS'
  | 'IR_BOLETAS'
  | 'IR_COMPRADORES'
  | 'IR_DASHBOARD'
  | 'IR_REPORTES'
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
  veintiuno: 21,
  veintiun: 21,
  veintiuna: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  veinti: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
  mil: 1000
}

const NUMBER_TOKEN = new Set([...Object.keys(NUMBER_WORDS), 'y'])

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\bvoleta\b/g, 'boleta')
    .replace(/\bvoletas\b/g, 'boletas')
    .replace(/\b(bo|por)\s+leta\b/g, 'boleta')
    .replace(/\b(haga|haz|has|hacer)\s+(la\s+|el\s+)?boleta\b/g, 'boleta')
    .replace(/\bveinti\s+(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\b/g, 'veinti$1')
    .replace(/\b(la|el|las|los|numero|nro|no)\s+(?=boleta)/g, '')
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

  const values: number[] = []
  for (const token of n.split(' ')) {
    if (!(token in NUMBER_WORDS)) continue
    values.push(NUMBER_WORDS[token])
  }
  if (
    values.length >= 3 &&
    values[0] <= 9 &&
    values[0] >= 1 &&
    isTensWord(values[1]) &&
    values[2] === 1000
  ) {
    values.shift()
  }

  let total = 0
  let current = 0
  for (const value of values) {
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

function spokenNumberValues(text: string): { values: number[]; hasScale: boolean } {
  const values: number[] = []
  let hasScale = false
  for (const token of normalize(text).split(' ')) {
    if (!token || token === 'y' || token === 'a') continue
    const value = NUMBER_WORDS[token]
    if (value == null) continue
    values.push(value)
    if (value >= 100) hasScale = true
  }
  return { values, hasScale }
}

function isTensWord(value: number): boolean {
  return value >= 20 && value <= 90 && value % 10 === 0
}

/** Une “cuarenta y dos” → 42, pero deja “setenta treinta” como dos grupos 70 y 30. */
function ticketDigitGroups(values: number[]): number[] {
  const groups: number[] = []
  for (let i = 0; i < values.length; i++) {
    const current = values[i]
    const next = values[i + 1]
    if (isTensWord(current) && next != null && next >= 1 && next <= 9) {
      groups.push(current + next)
      i += 1
    } else {
      groups.push(current)
    }
  }
  return groups
}

function concatTicketGroups(groups: number[]): number | undefined {
  const concatenated = Number(groups.map((value) => String(value)).join(''))
  if (Number.isFinite(concatenated) && concatenated >= 0 && concatenated <= 9999) {
    return concatenated
  }
  return undefined
}

/** Convierte "42", "cuarenta y dos" o "setenta treinta" (7030) en un número de boleta. */
export function parseSpokenTicketNumber(text: string): number | undefined {
  const n = normalize(text)
  if (!n) return undefined
  const digits = n.match(/\b\d{1,4}\b/)
  if (digits) {
    const value = Number(digits[0])
    return value >= 0 && value <= 9999 ? value : undefined
  }

  const { values, hasScale } = spokenNumberValues(n)
  if (values.length === 0) return undefined

  if (hasScale) {
    const spoken = parseSpanishAmount(n)
    if (spoken != null && spoken >= 0 && spoken <= 9999) return spoken
  }

  const concatenated = concatTicketGroups(ticketDigitGroups(values))
  if (concatenated != null) return concatenated

  const spoken = parseSpanishAmount(n)
  if (spoken != null && spoken >= 0 && spoken <= 9999) return spoken
  return undefined
}

export function parseVoiceCommand(raw: string): VoiceCommand {
  const text = normalize(raw)

  if (/^(si|sí|confirmar|confirmo)$/.test(text) || text === 'si confirmar') {
    return { action: 'CONFIRMAR', raw }
  }

  if (/^(esta|este|esto|esas|esos|me|la|el|de|a|a ver esta)$/.test(text)) {
    return { action: 'DESCONOCIDO', raw }
  }

  const wantsAbono =
    /\b(abonar|abono|abonos|abone)\b/.test(text) ||
    text.includes('haz el abono') ||
    text.includes('hacer abono') ||
    text.includes('hacer un abono') ||
    text.includes('hacer los abonos') ||
    (/\bboleta/.test(text) && /\bmil\b/.test(text.split(/\bboletas?\b/)[0] ?? ''))

  if (wantsAbono) {
    const onlyList = /\ben abonos\b/.test(text) && !/\b(haz|hacer|abonar|registrar|pagar)\b/.test(text)
    if (onlyList) {
      return { action: 'MOSTRAR_EN_ABONOS', raw }
    }

    const [beforeBoleta, ...afterParts] = text.split(/\bboletas?\b/)
    const afterBoleta = afterParts.join(' ').trim()
    let ticket = parseSpokenTicketNumber(afterBoleta)
    let amount = parseSpanishAmount(
      beforeBoleta.replace(/\b(abono|abonos|abonar|haz|haga|hacer|has|de|a|la|las|el|los|pesos)\b/g, ' ')
    )
    if (ticket == null && /\bmil\b/.test(text)) {
      const parts = text.split(/\bmil\b/)
      const afterMil = parts[parts.length - 1] ?? ''
      ticket = parseSpokenTicketNumber(afterMil)
      amount = amount ?? parseSpanishAmount(`${parts.slice(0, -1).join(' mil ')} mil`)
    }
    const method = afterBoleta.match(/\bpor\s+([a-z]+)$/)?.[1]

    if (ticket != null && amount) {
      return {
        action: 'REGISTRAR_ABONO',
        ticketNumber: ticket,
        amount,
        paymentMethodName: method,
        raw
      }
    }
    return { action: 'IR_ABONOS', ticketNumber: ticket, amount, paymentMethodName: method, raw }
  }

  if (text.includes('sin vender')) {
    const name = text.match(/de\s+(.+)$/)?.[1]
    return {
      action: 'MOSTRAR_SIN_VENDER',
      sellerName: name && !name.includes('boleta') ? name.trim() : undefined,
      raw
    }
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

  if (/\b(dashboard|inicio|menu principal|menú principal)\b/.test(text)) {
    return { action: 'IR_DASHBOARD', raw }
  }
  if (/\bcomprador/.test(text)) {
    return { action: 'IR_COMPRADORES', raw }
  }
  if (/\breporte/.test(text)) {
    return { action: 'IR_REPORTES', raw }
  }
  if (
    /^(boletas|abrir boletas|abre boletas|ir a boletas|mostrar boletas)$/.test(text) ||
    text.includes('todas las boletas')
  ) {
    return { action: 'IR_BOLETAS', raw }
  }

  if (text.includes('buscar vendedor') || /\bvendedor/.test(text)) {
    const name = text.replace(/.*vendedor(?:a)?\s+/, '').trim()
    return { action: 'BUSCAR_VENDEDOR', sellerName: name || undefined, raw }
  }

  const boletaMatch = text.match(/boleta\s+(.+)$/)
  if (text.includes('buscar boleta') || /\bboleta\b/.test(text)) {
    const ticketNumber = boletaMatch
      ? parseSpokenTicketNumber(boletaMatch[1])
      : parseSpokenTicketNumber(text)
    return {
      action: 'BUSCAR_BOLETA',
      ticketNumber,
      raw
    }
  }

  if (/^\d{1,4}$/.test(text)) {
    return { action: 'BUSCAR_BOLETA', ticketNumber: Number(text), raw }
  }

  const onlyNumber = text.split(' ').every((token) => NUMBER_TOKEN.has(token) || token === '')
  const spokenOnly = parseSpokenTicketNumber(text)
  if (onlyNumber && spokenOnly != null) {
    return { action: 'BUSCAR_BOLETA', ticketNumber: spokenOnly, raw }
  }

  const cleaned = text
    .replace(/\b(buscar|mostrar|ver|abrir|quiero|ticket|rifa|numero|favor)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const extracted = parseSpokenTicketNumber(cleaned)
  if (extracted != null) {
    return { action: 'BUSCAR_BOLETA', ticketNumber: extracted, raw }
  }

  return { action: 'DESCONOCIDO', raw }
}
