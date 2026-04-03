// File persistence types
export interface FileEntry {
  path: string
  content: string
}

export interface FailedPersistence {
  path: string
  error: string
}

export interface FilesPersistedEventData {
  count: number
}

export interface PersistedFile {
  path: string
}

export type TurnStartTime = number

export const DEFAULT_UPLOAD_CONCURRENCY = 3
export const FILE_COUNT_LIMIT = 1000
export const OUTPUTS_SUBDIR = 'outputs'
