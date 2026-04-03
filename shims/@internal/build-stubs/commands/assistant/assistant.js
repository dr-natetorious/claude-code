import React from 'react'

export async function computeDefaultInstallDir() {
  return ''
}

export function NewInstallWizard() {
  return React.createElement('div', null, 'Assistant Install Wizard')
}

export default {
  name: 'assistant',
  async run() {
    return
  },
}