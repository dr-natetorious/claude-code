export type PermissionMode =
  | 'ask'
  | 'skip_all_permission_checks'
  | 'follow_a_plan'

export interface Logger {
  silly(message: string, ...args: unknown[]): void
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

export interface ClaudeForChromeContext {
  serverName: string
  logger: Logger
  socketPath: string
  getSocketPaths: () => string[]
  clientTypeId: string
  onAuthenticationError?: () => void
  onToolCallDisconnected?: () => string
  onExtensionPaired?: (deviceId: string, name: string) => void
  getPersistedDeviceId?: () => string | undefined
  bridgeConfig?: {
    url: string
    getUserId: () => Promise<string | undefined>
    getOAuthToken: () => Promise<string>
    devUserId?: string
  }
  initialPermissionMode?: PermissionMode
  callAnthropicMessages?: (req: {
    model: string
    max_tokens: number
    system: string
    messages: unknown[]
    stop_sequences?: string[]
    signal?: AbortSignal
  }) => Promise<{
    content: Array<{ type: 'text'; text: string }>
    stop_reason: string | null
    usage?: { input_tokens: number; output_tokens: number }
  }>
  trackEvent?: (eventName: string, metadata?: Record<string, unknown>) => void
}

export type BrowserTool = {
  name: string
  description?: string
}

export declare const BROWSER_TOOLS: BrowserTool[]

export declare function createClaudeForChromeMcpServer(
  context: ClaudeForChromeContext,
): {
  connect(transport: unknown): Promise<void>
  close(): Promise<void>
}
