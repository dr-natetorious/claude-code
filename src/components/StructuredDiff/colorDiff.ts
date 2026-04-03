import colorDiffNapi from 'color-diff-napi'
import { isEnvDefinedFalsy } from '../../utils/envUtils.js'

type ColorDiffNapiModule = {
  ColorDiff: new (...args: any[]) => any
  ColorFile: new (...args: any[]) => any
  getSyntaxTheme: (themeName: string) => unknown
}

const {
  ColorDiff,
  ColorFile,
  getSyntaxTheme: nativeGetSyntaxTheme,
} = colorDiffNapi as unknown as Partial<ColorDiffNapiModule>

export type SyntaxTheme = ReturnType<NonNullable<typeof nativeGetSyntaxTheme>>

export type ColorModuleUnavailableReason = 'env' | 'module'

/**
 * Returns a static reason why the color-diff module is unavailable, or null if available.
 * 'env' = disabled via CLAUDE_CODE_SYNTAX_HIGHLIGHT
 *
 * The TS port of color-diff works in all build modes, so the only way to
 * disable it is via the env var.
 */
export function getColorModuleUnavailableReason(): ColorModuleUnavailableReason | null {
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_SYNTAX_HIGHLIGHT)) {
    return 'env'
  }
  if (!ColorDiff || !ColorFile || typeof nativeGetSyntaxTheme !== 'function') {
    return 'module'
  }
  return null
}

export function expectColorDiff(): typeof ColorDiff | null {
  return getColorModuleUnavailableReason() === null
    ? (ColorDiff as NonNullable<typeof ColorDiff>)
    : null
}

export function expectColorFile(): typeof ColorFile | null {
  return getColorModuleUnavailableReason() === null
    ? (ColorFile as NonNullable<typeof ColorFile>)
    : null
}

export function getSyntaxTheme(themeName: string): SyntaxTheme | null {
  return getColorModuleUnavailableReason() === null
    ? (nativeGetSyntaxTheme as NonNullable<typeof nativeGetSyntaxTheme>)(themeName)
    : null
}
