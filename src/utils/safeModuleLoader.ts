/**
 * Safe module loading utility for optional/gated features
 * 
 * Handles missing modules gracefully - returns null if module doesn't exist
 * This allows feature flags and optional imports to not break the build
 * when modules are still under development or gated behind permissions
 */

type ModuleLoadResult<T = any> = T | null;

/**
 * Safely require a module, returning null if it doesn't exist
 * Use for optional/gated imports that may not be available
 * 
 * @param modulePath - Path to module to load
 * @param exportName - Specific named export to get (optional)
 * @returns The module/export, or null if it doesn't exist
 * 
 * @example
 * const REPLTool = safeRequire('./tools/REPLTool/REPLTool.js', 'REPLTool')
 * const someModule = safeRequire('./optional-module.js')
 */
export function safeRequire<T = any>(
  modulePath: string,
  exportName?: string
): ModuleLoadResult<T> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require(modulePath);
    return exportName ? module[exportName] : module;
  } catch (error) {
    // Module doesn't exist or failed to load - return null
    // This is expected for optional/gated features
    return null;
  }
}

/**
 * Safely import a module dynamically, returning null if it doesn't exist
 * Async version for use with dynamic imports
 * 
 * @param modulePath - Path to module to load
 * @param exportName - Specific named export to get (optional)
 * @returns Promise resolving to the module/export, or null if it doesn't exist
 * 
 * @example
 * const Module = await safeImport('./optional-module.js', 'Component')
 */
export async function safeImport<T = any>(
  modulePath: string,
  exportName?: string
): Promise<ModuleLoadResult<T>> {
  try {
    const module = await import(modulePath);
    return exportName ? module[exportName] : module.default;
  } catch (error) {
    // Module doesn't exist or failed to load - return null
    return null;
  }
}

/**
 * Create a safe conditional export
 * Use when you want to conditionally export a module based on flags/permissions
 * 
 * @param condition - Boolean condition (e.g., feature flag, USER_TYPE check)
 * @param modulePath - Path to load if condition is true
 * @param exportName - Named export to get
 * @returns The module if condition is true and module exists, otherwise null
 * 
 * @example
 * const REPLTool = safeConditional(
 *   process.env.USER_TYPE === 'ant',
 *   './tools/REPLTool/REPLTool.js',
 *   'REPLTool'
 * )
 */
export function safeConditional<T = any>(
  condition: boolean,
  modulePath: string,
  exportName?: string
): ModuleLoadResult<T> {
  if (!condition) return null;
  return safeRequire(modulePath, exportName);
}
