export function parseModuleData(data: unknown): Record<string, unknown> {
  try {
    let parsed = data
    if (typeof parsed === 'string') parsed = JSON.parse(parsed)
    if (typeof parsed === 'string') parsed = JSON.parse(parsed)
    return parsed as Record<string, unknown> ?? {}
  } catch {
    return {}
  }
}

export function serializeModuleData(data: unknown): string {
  return JSON.stringify(data)
}
