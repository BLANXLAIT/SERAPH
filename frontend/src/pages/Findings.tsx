import { useState } from 'react';
import { useRunQuery } from '@/hooks/useSecurityLake';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Shield,
  Loader2,
  RefreshCw,
  AlertCircle,
  Info,
  XCircle,
} from 'lucide-react';
import type { QueryResult } from '@/types';

const severityConfig: Record<string, { color: string; bg: string; icon: typeof AlertTriangle }> = {
  Critical: { color: 'text-red-700', bg: 'bg-red-100', icon: XCircle },
  High: { color: 'text-orange-700', bg: 'bg-orange-100', icon: AlertTriangle },
  Medium: { color: 'text-yellow-700', bg: 'bg-yellow-100', icon: AlertCircle },
  Low: { color: 'text-blue-700', bg: 'bg-blue-100', icon: Info },
  Informational: { color: 'text-gray-700', bg: 'bg-gray-100', icon: Info },
};

export function Findings() {
  const runQueryMutation = useRunQuery();
  const [result, setResult] = useState<QueryResult | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadFindings = async () => {
    try {
      const queryResult = await runQueryMutation.mutateAsync('sh-medium-severity');
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
          <h1 className="text-2xl font-bold text-gray-900">Security Findings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Security Hub findings from the last 7 days
          </p>
        </div>
        <button
          onClick={loadFindings}
          disabled={isLoading}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
            'text-sm font-medium text-white',
            'bg-indigo-600 hover:bg-indigo-700',
            'disabled:bg-gray-300 disabled:cursor-not-allowed',
            'transition-colors'
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              {hasLoaded ? 'Refresh' : 'Load Findings'}
            </>
          )}
        </button>
      </div>

      {/* Error State */}
      {runQueryMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle className="h-5 w-5" />
            <span>
              Failed to load findings:{' '}
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
          <Shield className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No findings loaded</h3>
          <p className="text-gray-500 mb-4">
            Click "Load Findings" to query Security Hub findings from Security Lake
          </p>
        </div>
      )}

      {/* Results */}
      {result?.status === 'succeeded' && result.rows && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Findings"
              value={result.rowCount ?? 0}
              icon={AlertTriangle}
              color="indigo"
            />
            <StatCard
              label="Critical"
              value={result.rows.filter((r) => r.severity === 'Critical').length}
              icon={XCircle}
              color="red"
            />
            <StatCard
              label="High"
              value={result.rows.filter((r) => r.severity === 'High').length}
              icon={AlertTriangle}
              color="orange"
            />
            <StatCard
              label="Medium"
              value={result.rows.filter((r) => r.severity === 'Medium').length}
              icon={AlertCircle}
              color="yellow"
            />
          </div>

          {/* Findings List */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Findings</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {result.rows.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-green-400" />
                  <p>No findings with Medium or higher severity</p>
                </div>
              ) : (
                result.rows.map((row, index) => (
                  <FindingRow key={index} finding={row} />
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Running State */}
      {result?.status === 'running' && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Loader2 className="h-8 w-8 mx-auto text-indigo-600 animate-spin mb-4" />
          <p className="text-gray-500">Query is still running...</p>
          <p className="text-sm text-gray-400">Execution ID: {result.executionId}</p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof AlertTriangle;
  color: 'indigo' | 'red' | 'orange' | 'yellow';
}) {
  const colorClasses = {
    indigo: 'bg-indigo-50 text-indigo-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function FindingRow({ finding }: { finding: Record<string, string | null> }) {
  const severity = finding.severity ?? 'Unknown';
  const config = severityConfig[severity] ?? severityConfig.Informational;
  const Icon = config.icon;

  return (
    <div className="px-6 py-4 hover:bg-gray-50">
      <div className="flex items-start gap-4">
        <div className={cn('p-2 rounded-lg', config.bg)}>
          <Icon className={cn('h-5 w-5', config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', config.bg, config.color)}>
              {severity}
            </span>
            <span className="text-xs text-gray-400">
              {finding.time_dt ? new Date(finding.time_dt).toLocaleString() : 'Unknown time'}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-900 truncate">
            {finding.title ?? 'Untitled finding'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Status: {finding.status ?? 'Unknown'}
          </p>
        </div>
      </div>
    </div>
  );
}
