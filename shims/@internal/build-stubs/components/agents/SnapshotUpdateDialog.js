import React from 'react'

export function SnapshotUpdateDialog() {
  return React.createElement('div', null, 'Snapshot Dialog')
}

export function buildMergePrompt(agentType, scope) {
  return `Merge the ${scope} snapshot for ${agentType}.`
}