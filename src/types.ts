export interface CodeFile {
  name: string;
  path: string;
  language: string;
  description: string;
  highlightLines?: number[];
  content: string;
}

export interface WebhookConfig {
  botToken: string;
  appDomain: string;
  customSecret?: string;
  dropPendingUpdates: boolean;
  maxConnections: number;
}
