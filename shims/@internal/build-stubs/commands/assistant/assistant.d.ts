import type { ComponentType } from 'react'

export function computeDefaultInstallDir(): Promise<string>
export const NewInstallWizard: ComponentType<any>

declare const assistantCommand: {
  name: string
  run(): Promise<void>
}

export default assistantCommand