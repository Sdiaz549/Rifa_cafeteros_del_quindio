import { parseVoiceCommand, type VoiceAction, type VoiceCommand } from '../../shared/voice/parseCommand'
import type { SessionUser } from '../../shared/types'

export interface VoiceContext {
  session: SessionUser
}

export interface VoiceResult {
  ok: boolean
  action: VoiceAction
  message: string
  navigateTo?: string
  confirmRequired?: boolean
  payload?: Record<string, unknown>
}

export type VoiceHandler = (command: VoiceCommand, context: VoiceContext) => Promise<VoiceResult>

/**
 * Servicio transversal de comandos de voz.
 * No es un módulo de menú: se registra en el proceso main y se invoca desde cualquier pantalla.
 * Fase 1: parser + registro de handlers. Sin API de reconocimiento (Web Speech vive en el renderer).
 */
export class VoiceCommandService {
  private readonly handlers = new Map<VoiceAction, VoiceHandler>()

  register(action: VoiceAction, handler: VoiceHandler): void {
    this.handlers.set(action, handler)
  }

  parse(raw: string): VoiceCommand {
    return parseVoiceCommand(raw)
  }

  async execute(raw: string, context: VoiceContext): Promise<VoiceResult> {
    const command = this.parse(raw)
    const handler = this.handlers.get(command.action)
    if (!handler) {
      return {
        ok: false,
        action: command.action,
        message:
          command.action === 'DESCONOCIDO'
            ? `No entendí: “${raw}”`
            : `El comando “${command.action}” aún no está conectado.`
      }
    }
    return handler(command, context)
  }
}

export const voiceCommandService = new VoiceCommandService()

export function registerDefaultVoiceHandlers(): void {
  voiceCommandService.register('BUSCAR_BOLETA', async (command) => {
    if (command.ticketNumber == null) {
      return { ok: false, action: command.action, message: 'Indique el número de boleta.' }
    }
    return {
      ok: true,
      action: command.action,
      message: `Abrir boleta ${command.ticketNumber}`,
      navigateTo: `/boletas/${command.ticketNumber}`,
      payload: { ticketNumber: command.ticketNumber }
    }
  })

  voiceCommandService.register('MOSTRAR_SIN_VENDER', async (command) => ({
    ok: true,
    action: command.action,
    message: 'Mostrar boletas sin vender',
    navigateTo: command.sellerName
      ? `/boletas-sin-vender?q=${encodeURIComponent(command.sellerName)}`
      : '/boletas-sin-vender',
    payload: { sellerName: command.sellerName }
  }))

  voiceCommandService.register('MOSTRAR_EN_ABONOS', async (command) => ({
    ok: true,
    action: command.action,
    message: 'Mostrar boletas en abonos',
    navigateTo: '/boletas?status=EN_ABONOS'
  }))

  voiceCommandService.register('MOSTRAR_PERDIDAS', async (command) => ({
    ok: true,
    action: command.action,
    message: 'Mostrar boletas perdidas',
    navigateTo: '/boletas?status=PERDIDA'
  }))

  voiceCommandService.register('MOSTRAR_LIQUIDADAS', async (command) => ({
    ok: true,
    action: command.action,
    message: 'Mostrar boletas liquidadas',
    navigateTo: '/liquidaciones'
  }))

  voiceCommandService.register('BUSCAR_VENDEDOR', async (command) => ({
    ok: true,
    action: command.action,
    message: command.sellerName ? `Buscar vendedor ${command.sellerName}` : 'Abrir vendedores',
    navigateTo: command.sellerName
      ? `/vendedores?q=${encodeURIComponent(command.sellerName)}`
      : '/vendedores'
  }))

  voiceCommandService.register('REGISTRAR_ABONO', async (command) => {
    if (command.ticketNumber == null || !command.amount) {
      return {
        ok: false,
        action: command.action,
        message: 'Diga: abonar cincuenta mil pesos a la boleta 4587 por Nequi'
      }
    }
    return {
      ok: true,
      action: command.action,
      message: 'Confirme el abono antes de registrarlo',
      confirmRequired: true,
      payload: {
        ticketNumber: command.ticketNumber,
        amount: command.amount,
        paymentMethodName: command.paymentMethodName
      }
    }
  })
}
