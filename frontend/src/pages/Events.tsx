import { useState } from 'react';
import { useRunQuery, useAvailableQueries } from '@/hooks/useSecurityLake';
import { cn } from '@/lib/utils';
import {
  Activity,
  Loader2,
  RefreshCw,
  XCircle,
  CheckCircle,
  Clock,
  Database,
  User,
  Globe,
  Server,
} from 'lucide-react';
import type { QueryResult } from '@/types';

export function Events() {
  const { data: queriesData } = useAvailableQueries();
  const runQueryMutation = useRunQuery();
  const [result, setResult] = useState<QueryResult | null>(null);
  const [activeQuery, setActiveQuery] = useState<string>('cloudtrail-event-count');
  const [hasLoaded, setHasLoaded] = useState(false);

  const queries = queriesData?.queries ?? [];
  const cloudtrailQueries = queries.filter(
    (q) =>
      q.id.includes('cloudtrail') ||
      q.id.includes('unauthorized') ||
      q.id.includes('iam') ||
      q.id.includes('failed')
  );

  const loadEvents = async () => {
    try {
      const queryResult = await runQueryMutation.mutateAsync(activeQuery);
      setResult(queryResult);
      setHasLoaded(true);
    } catch {
      // Error handled by mutation
    }
  };

  const isLoading = runQueryMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CloudTrail Events</h1>
          <p className="mt-1 text-sm text-gray-500">
            Explore CloudTrail management events from Security Lake
          </p>
        </div>
      </div>

      {/* Query Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="event-query" className="block text-sm font-medium text-gray-700 mb-1">
              Select Query
            </label>
            <select
              id="event-query"
              value={activeQuery}
              onChange={(e) => {
                setActiveQuery(e.target.value);
                setResult(null);
                setHasLoaded(false);
              }}
              disabled={isLoading}
              className={cn(
                'block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5',
                'text-sm text-gray-900',
                'focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500',
                'disabled:bg-gray-50 disabled:text-gray-500'
              )}
            >
              {cloudtrailQueries.map((query) => (
                <option key={query.id} value={query.id}>
                  {query.name}
                </option>
              ))}
            </select>
            {cloudtrailQueries.find((q) => q.id === activeQuery)?.description && (
              <p className="mt-1 text-sm text-gray-500">
                {cloudtrailQueries.find((q) => q.id === activeQuery)?.description}
              </p>
            )}
          </div>
          <div className="flex items-end">
            <button
              onClick={loadEvents}
              disabled={isLoading}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg',
                'text-sm font-medium text-white',
                'bg-indigo-600 hover:bg-indigo-700',
                'disabled:bg-gray-300 disabled:cursor-not-allowed',
                'transition-colors'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Run Query
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {runQueryMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle className="h-5 w-5" />
            <span>
              Failed to run query:{' '}
              {runQueryMutation.error instanceof Error
                ? runQueryMutation.error.message
                : 'Unknown error'}
            </span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasLoaded && !isLoading && !runQueryMutation.isError && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Activity className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a query to explore events</h3>
          <p className="text-gray-500">
            Choose a query type above and click "Run Query" to view CloudTrail events
          </p>
        </div>
      )}

      {/* Results */}
      {result?.status === 'succeeded' && (
        <div className="space-y-4">
          {/* Stats Bar */}
          <div className="flex items-center gap-6 text-sm text-gray-500 bg-white rounded-lg border border-gray-200 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-green-700 font-medium">Query Succeeded</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Database className="h-4 w-4" />
              <span>{result.rowCount ?? 0} rows</span>
            </div>
            {result.executionTimeMs && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>{(result.executionTimeMs / 1000).toFixed(2)}s</span>
              </div>
            )}
          </div>

          {/* Results Table */}
          {result.rows && result.rows.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {result.columns?.map((col) => (
                        <th
                          key={col}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {formatColumnName(col)}
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
                            {renderCellValue(col, row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <Activity className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-gray-500">No events found for this query</p>
            </div>
          )}
        </div>
      )}

      {/* Running State */}
      {result?.status === 'running' && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Loader2 className="h-8 w-8 mx-auto text-indigo-600 animate-spin mb-4" />
          <p className="text-gray-500">Query is still running...</p>
        </div>
      )}
    </div>
  );
}

function formatColumnName(col: string): string {
  return col
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function renderCellValue(col: string, value: string | null) {
  if (value === null) {
    return <span className="text-gray-400">null</span>;
  }

  // Format timestamps
  if (col.includes('time') || col.includes('date')) {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }

  // Show icons for certain columns
  if (col.includes('user') || col.includes('actor')) {
    return (
      <span className="inline-flex items-center gap-1">
        <User className="h-3 w-3 text-gray-400" />
        {value}
      </span>
    );
  }

  if (col.includes('ip') || col.includes('source')) {
    return (
      <span className="inline-flex items-center gap-1">
        <Globe className="h-3 w-3 text-gray-400" />
        {value}
      </span>
    );
  }

  if (col.includes('service') || col.includes('region')) {
    return (
      <span className="inline-flex items-center gap-1">
        <Server className="h-3 w-3 text-gray-400" />
        {value}
      </span>
    );
  }

  // Status formatting
  if (col === 'status') {
    const isSuccess = value.toLowerCase() === 'success';
    return (
      <span
        className={cn(
          'px-2 py-0.5 rounded text-xs font-medium',
          isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        )}
      >
        {value}
      </span>
    );
  }

  return value;
}
