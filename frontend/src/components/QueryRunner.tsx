import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAvailableQueries, useRunQuery } from '@/hooks/useSecurityLake';
import type { QueryResult } from '@/types';
import {
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  Database,
  Clock,
  FileText,
} from 'lucide-react';

export function QueryRunner() {
  const { data: queriesData, isLoading: queriesLoading } = useAvailableQueries();
  const runQueryMutation = useRunQuery();

  const [selectedQueryId, setSelectedQueryId] = useState<string>('');
  const [result, setResult] = useState<QueryResult | null>(null);

  const queries = queriesData?.queries ?? [];
  const selectedQuery = queries.find((q) => q.id === selectedQueryId);

  const handleRunQuery = async () => {
    if (!selectedQueryId) return;

    setResult(null);
    try {
      const queryResult = await runQueryMutation.mutateAsync(selectedQueryId);
      setResult(queryResult);
    } catch {
      // Error is handled by mutation state
    }
  };

  const isRunning = runQueryMutation.isPending;

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Database className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Verification Queries</h2>
            <p className="text-sm text-gray-500">Run pre-built queries to verify data flow</p>
          </div>
        </div>
      </div>

      {/* Query Selector */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label htmlFor="query-select" className="sr-only">
              Select Query
            </label>
            <div className="relative">
              <select
                id="query-select"
                value={selectedQueryId}
                onChange={(e) => {
                  setSelectedQueryId(e.target.value);
                  setResult(null);
                }}
                disabled={queriesLoading || isRunning}
                className={cn(
                  'block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10',
                  'text-sm text-gray-900 appearance-none cursor-pointer',
                  'focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500',
                  'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed'
                )}
              >
                <option value="">Select a query...</option>
                {queries.map((query) => (
                  <option key={query.id} value={query.id}>
                    {query.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            {selectedQuery && (
              <p className="mt-2 text-sm text-gray-500">{selectedQuery.description}</p>
            )}
          </div>

          <button
            onClick={handleRunQuery}
            disabled={!selectedQueryId || isRunning}
            className={cn(
              'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg',
              'text-sm font-medium text-white',
              'bg-indigo-600 hover:bg-indigo-700',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
              'disabled:bg-gray-300 disabled:cursor-not-allowed',
              'transition-colors'
            )}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Query
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {(result || runQueryMutation.isError) && (
        <div className="px-6 py-4">
          {runQueryMutation.isError ? (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span>
                Failed to run query:{' '}
                {runQueryMutation.error instanceof Error
                  ? runQueryMutation.error.message
                  : 'Unknown error'}
              </span>
            </div>
          ) : result?.status === 'failed' ? (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span>Query failed: {result.error}</span>
            </div>
          ) : result?.status === 'running' ? (
            <div className="flex items-center gap-2 text-yellow-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Query still running... (ID: {result.executionId})</span>
            </div>
          ) : result?.status === 'succeeded' ? (
            <div className="space-y-4">
              {/* Stats */}
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-700 font-medium">Success</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  <span>{result.rowCount} rows</span>
                </div>
                {result.executionTimeMs && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    <span>{(result.executionTimeMs / 1000).toFixed(2)}s</span>
                  </div>
                )}
                {result.dataScannedBytes && (
                  <div className="flex items-center gap-1.5">
                    <Database className="h-4 w-4" />
                    <span>{formatBytes(result.dataScannedBytes)} scanned</span>
                  </div>
                )}
              </div>

              {/* Results Table */}
              {result.rows && result.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {result.columns?.map((col) => (
                          <th
                            key={col}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {result.columns?.map((col) => (
                            <td
                              key={col}
                              className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap max-w-xs truncate"
                              title={row[col] ?? ''}
                            >
                              {row[col] ?? <span className="text-gray-400">null</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Database className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No results found</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
