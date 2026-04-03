// Connector text utilities
export interface ConnectorTextBlock {
  type: 'connector-text'
  content: string
}

export function isConnectorTextBlock(obj: unknown): obj is ConnectorTextBlock {
  return obj !== null && typeof obj === 'object' && 'type' in obj && obj.type === 'connector-text'
}
