// API client for SERAPH Security Lake Dashboard

import type {
  SecurityLakeStatus,
  LogSourcesResponse,
  TablesResponse,
  QueriesResponse,
  QueryResult,
} from '@/types';

const API_BASE = '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Security Lake
  getSecurityLakeStatus: (): Promise<SecurityLakeStatus> => {
    return fetchApi<SecurityLakeStatus>('/securitylake/status');
  },

  getLogSources: (): Promise<LogSourcesResponse> => {
    return fetchApi<LogSourcesResponse>('/securitylake/sources');
  },

  getTables: (): Promise<TablesResponse> => {
    return fetchApi<TablesResponse>('/securitylake/tables');
  },

  getAvailableQueries: (): Promise<QueriesResponse> => {
    return fetchApi<QueriesResponse>('/securitylake/queries');
  },

  runQuery: (queryId: string): Promise<QueryResult> => {
    return fetchApi<QueryResult>('/securitylake/query', {
      method: 'POST',
      body: JSON.stringify({ queryId }),
    });
  },
};
