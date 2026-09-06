const SPEECH_LANGS = ['es-CO', 'es-ES', 'es-MX', 'es'] as const

export type SpeechRecognitionHandle = {
  stop: () => void
}

type SpeechCtor = new () => {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult:
    | ((ev: {
        resultIndex: number
        results: ArrayLike<{
          isFinal?: boolean
          0: { transcript: string }
        }>
      }) => void)
    | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function getSpeechCtor(): SpeechCtor | null {
  const w = window as unknown as {
    webkitSpeechRecognition?: SpeechCtor
    SpeechRecognition?: SpeechCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionAvailable(): boolean {
  return getSpeechCtor() != null && Boolean(navigator.mediaDevices?.getUserMedia)
}

function speechErrorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Windows bloqueó el micrófono. En Configuración → Privacidad → Micrófono, permita el acceso a las aplicaciones de escritorio.'
    case 'audio-capture':
      return 'No se detectó micrófono. Conéctelo y revíselo en Windows.'
    case 'no-speech':
      return 'No se escuchó nada. Hable cerca del micrófono e intente de nuevo.'
    case 'network':
      return 'El reconocimiento de voz necesita conexión a Internet en este equipo.'
    case 'language-not-supported':
      return 'El idioma de voz no está disponible. Se intentará español de España.'
    case 'aborted':
      return ''
    default:
      return `No se pudo escuchar (${code}). Revise el micrófono.`
  }
}

export async function startSpeechRecognition(options: {
  onListening: () => void
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (message: string) => void
  onEnd: () => void
}): Promise<SpeechRecognitionHandle> {
  const Ctor = getSpeechCtor()
  if (!Ctor) {
    throw new Error('Este equipo no trae reconocimiento de voz.')
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  })

  let langIndex = 0
  let stopped = false
  let retryingLang = false
  let rec: InstanceType<SpeechCtor> | null = null

  const releaseMic = () => {
    for (const track of stream.getTracks()) track.stop()
  }

  const finish = () => {
    if (stopped) return
    stopped = true
    rec?.abort()
    releaseMic()
    options.onEnd()
  }

  const startWithLang = (lang: string) => {
    rec = new Ctor()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 3
    rec.onstart = () => options.onListening()
    rec.onresult = (event) => {
      let interim = ''
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i]
        const text = piece[0]?.transcript ?? ''
        if (piece.isFinal) finalText += text
        else interim += text
      }
      if (finalText.trim()) {
        options.onTranscript(finalText.trim(), true)
        finish()
      } else if (interim.trim()) {
        options.onTranscript(interim.trim(), false)
      }
    }
    rec.onerror = (event) => {
      if (stopped) return
      if (event.error === 'language-not-supported' && langIndex < SPEECH_LANGS.length - 1) {
        retryingLang = true
        langIndex += 1
        return
      }
      const message = speechErrorMessage(event.error)
      if (message) options.onError(message)
    }
    rec.onend = () => {
      if (stopped) return
      if (retryingLang) {
        retryingLang = false
        startWithLang(SPEECH_LANGS[langIndex])
        return
      }
      finish()
    }
    rec.start()
  }

  startWithLang(SPEECH_LANGS[0])

  return {
    stop: () => finish()
  }
}
