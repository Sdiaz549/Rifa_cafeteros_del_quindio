export type SpeechRecognitionHandle = {
  stop: () => void
}

export function isSpeechRecognitionAvailable(): boolean {
  return typeof window.api?.voice?.listen === 'function'
}

export async function startSpeechRecognition(options: {
  onListening: () => void
  onTranscript: (text: string, isFinal: boolean) => void
  onError: (message: string) => void
  onEnd: () => void
}): Promise<SpeechRecognitionHandle> {
  let stopped = false

  const finish = () => {
    if (stopped) return
    stopped = true
    options.onEnd()
  }

  options.onListening()
  void window.api.voice.listen().then((res) => {
    if (stopped) return
    if (!res.ok) {
      if (res.error) options.onError(res.error)
      finish()
      return
    }
    options.onTranscript(res.data.transcript, true)
    finish()
  })

  return {
    stop: () => {
      if (stopped) return
      void window.api.voice.cancelListen()
      finish()
    }
  }
}
