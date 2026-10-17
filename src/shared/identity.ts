export function isGeneratedDocumentId(value: string | null | undefined): boolean {
  return !value?.trim() || value.startsWith('SC-')
}

export function publicDocumentId(value: string | null | undefined): string {
  const v = value?.trim() ?? ''
  return isGeneratedDocumentId(v) ? '' : v
}
