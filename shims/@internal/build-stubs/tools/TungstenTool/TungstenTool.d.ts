export class TungstenTool {
  static name: string
  static description: string
  execute(...args: unknown[]): unknown
}

export function clearSessionsWithTungstenUsage(): void
export function resetInitializationState(): void