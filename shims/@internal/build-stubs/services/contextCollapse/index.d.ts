export interface ContextCollapseStats {
  collapsedSpans: number
  collapsedMessages: number
  stagedSpans: number
  health: {
    totalErrors: number
    totalSpawns: number
    totalEmptySpawns: number
    emptySpawnWarningEmitted: boolean
    lastError: unknown
  }
}

export function initContextCollapse(): void
export function isContextCollapseEnabled(): boolean
export function getStats(): ContextCollapseStats
export function subscribe(onStoreChange: () => void): () => void
export function resetContextCollapse(): void
export function applyCollapsesIfNeeded<T>(messages: T[]): Promise<{ messages: T[] }>
export function recoverFromOverflow<T>(messages: T[]): { messages: T[]; committed: number }
export function isWithheldPromptTooLong(): boolean