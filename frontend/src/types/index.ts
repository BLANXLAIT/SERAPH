// Security Lake Dashboard types

export interface SecurityLakeStatus {
  enabled: boolean;
  createStatus?: string;
  region?: string;
  retentionDays?: number;
  s3BucketArn?: string;
  encryptionType?: string;
  message?: string;
}

export interface LogSource {
  accountId: string;
  region: string;
  sourceName: string;
  sourceVersion: string;
}

export interface LogSourcesResponse {
  sources: LogSource[];
}

export interface GlueTable {
  name: string;
  createTime?: string;
  updateTime?: string;
  tableType?: string;
}

export interface TablesResponse {
  database: string | null;
  tables: GlueTable[];
  message?: string;
}

export interface QueryInfo {
  id: string;
  name: string;
  description: string;
}

export interface QueriesResponse {
  queries: QueryInfo[];
}

export type QueryStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface QueryResult {
  queryId: string;
  executionId: string;
  status: QueryStatus;
  columns?: string[];
  rows?: Record<string, string | null>[];
  rowCount?: number;
  executionTimeMs?: number;
  dataScannedBytes?: number;
  error?: string;
  message?: string;
}
