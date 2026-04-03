function createStats() {
  return {
    collapsedSpans: 0,
    collapsedMessages: 0,
    stagedSpans: 0,
    health: {
      totalErrors: 0,
      totalSpawns: 0,
      totalEmptySpawns: 0,
      emptySpawnWarningEmitted: false,
      lastError: null,
    },
  }
}

export function initContextCollapse() {
  return
}

export function isContextCollapseEnabled() {
  return false
}

export function getStats() {
  return createStats()
}

export function subscribe() {
  return () => {}
}

export function resetContextCollapse() {
  return
}

export async function applyCollapsesIfNeeded(messages) {
  return { messages }
}

export function recoverFromOverflow(messages) {
  return { messages, committed: 0 }
}

export function isWithheldPromptTooLong() {
  return false
}