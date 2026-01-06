import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useSecurityLakeStatus, useLogSources, useTables, useRunQuery } from '@/hooks/useSecurityLake';
import type { QueryResult } from '@/types';
import {
  Database,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  CloudCog,
  Table,
  RefreshCw,
  Clock,
  Zap,
  ExternalLink,
} from 'lucide-react';

// Map source names to display-friendly names and table identifiers
const SOURCE_CONFIG: Record<string, { displayName: string; tableKey: string; freshnessKey: string }> = {
  CLOUD_TRAIL_MGMT: { displayName: 'CloudTrail Management', tableKey: 'cloud_trail', freshnessKey: 'CloudTrail' },
  SH_FINDINGS: { displayName: 'Security Hub', tableKey: 'sh_findings', freshnessKey: 'Security Hub' },
  VPC_FLOW: { displayName: 'VPC Flow Logs', tableKey: 'vpc_flow', freshnessKey: 'VPC Flow' },
  ROUTE53: { displayName: 'Route 53 DNS', tableKey: 'route53', freshnessKey: 'Route53' },
  LAMBDA_EXECUTION: { displayName: 'Lambda Execution', tableKey: 'lambda', freshnessKey: 'Lambda' },
  S3_DATA: { displayName: 'S3 Data Events', tableKey: 's3_data', freshnessKey: 'S3' },
  EKS_AUDIT: { displayName: 'EKS Audit Logs', tableKey: 'eks_audit', freshnessKey: 'EKS' },
  WAF: { displayName: 'WAF Logs', tableKey: 'waf', freshnessKey: 'WAF' },
};

interface DataFreshness {
  [source: string]: {
    latestEvent: string | null;
    hasRecentData: boolean;
  };
}

export function SecurityLakeStatus() {
  const { data: status, isLoading: statusLoading, error: statusError } = useSecurityLakeStatus();
  const { data: sourcesData, isLoading: sourcesLoading, error: sourcesError } = useLogSources();
  const { data: tablesData, isLoading: tablesLoading } = useTables();
  const runQueryMutation = useRunQuery();

  const [dataFreshness, setDataFreshness] = useState<DataFreshness>({});
  const [freshnessLoading, setFreshnessLoading] = useState(false);
  const [freshnessChecked, setFreshnessChecked] = useState(false);

  const isLoading = statusLoading || sourcesLoading || tablesLoading;

  // Detect external/cross-account mode: Security Lake APIs fail but tables exist
  const isExternalMode = (statusError || sourcesError) && !isLoading;

  // Load data freshness on mount
  useEffect(() => {
    if (!isLoading && !freshnessChecked) {
      checkDataFreshness();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const checkDataFreshness = async () => {
    setFreshnessLoading(true);
    try {
      const result: QueryResult = await runQueryMutation.mutateAsync('data-freshness');
      if (result.status === 'succeeded' && result.rows) {
        const freshness: DataFreshness = {};
        result.rows.forEach((row) => {
          const source = row.source;
          const latestEvent = row.latest_event;
          if (source) {
            const hasRecent = latestEvent ? isRecent(latestEvent) : false;
            freshness[source] = {
              latestEvent: latestEvent ?? null,
              hasRecentData: hasRecent,
            };
          }
        });
        setDataFreshness(freshness);
      }
    } catch {
      // Silently handle error - freshness is optional
    } finally {
      setFreshnessLoading(false);
      setFreshnessChecked(true);
    }
  };

  // Check if timestamp is within last 24 hours
  const isRecent = (timestamp: string): boolean => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    return diffHours < 24;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          <span className="text-gray-500">Loading Security Lake status...</span>
        </div>
      </div>
    );
  }

  const tables = tablesData?.tables ?? [];

  // For external mode, show simplified view with data freshness only
  if (isExternalMode) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Header - External Mode */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <ExternalLink className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">External Security Lake</h2>
                <p className="text-sm text-gray-500">
                  Querying data via cross-account resource link
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={checkDataFreshness}
                disabled={freshnessLoading}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm',
                  'border border-gray-300 bg-white text-gray-700',
                  'hover:bg-gray-50 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {freshnessLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Check Data
              </button>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
                <CheckCircle className="h-4 w-4" />
                Connected
              </span>
            </div>
          </div>
        </div>

        {/* Data Freshness for External Mode */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CloudCog className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-medium text-gray-700">Data Sources</h3>
            </div>
            {freshnessChecked && (
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Receiving data
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  No recent data
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(dataFreshness).length > 0 ? (
              Object.entries(dataFreshness).map(([source, data]) => (
                <ExternalSourceItem
                  key={source}
                  name={source}
                  latestEvent={data.latestEvent}
                  hasRecentData={data.hasRecentData}
                  isCheckingFreshness={freshnessLoading}
                />
              ))
            ) : freshnessChecked ? (
              <p className="text-sm text-gray-500 col-span-2">No data sources found</p>
            ) : (
              <p className="text-sm text-gray-500 col-span-2">Click "Check Data" to verify data flow</p>
            )}
          </div>
        </div>

        {/* Tables for External Mode */}
        {tables.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Table className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-medium text-gray-700">Available Tables</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {tables.map((table) => (
                <span
                  key={table.name}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                >
                  {table.name.replace('amazon_security_lake_table_us_east_1_', '')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Same-account mode: show full status
  if (statusError && !isExternalMode) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <div className="flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">Failed to load Security Lake status</span>
        </div>
      </div>
    );
  }

  const isEnabled = status?.enabled ?? false;
  const sources = sourcesData?.sources ?? [];

  // Group sources by account
  const sourcesByAccount = sources.reduce(
    (acc, source) => {
      if (!acc[source.accountId]) {
        acc[source.accountId] = [];
      }
      acc[source.accountId].push(source);
      return acc;
    },
    {} as Record<string, typeof sources>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <Database className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Security Lake Status</h2>
              <p className="text-sm text-gray-500">
                {status?.region ?? 'Unknown region'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={checkDataFreshness}
              disabled={freshnessLoading}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm',
                'border border-gray-300 bg-white text-gray-700',
                'hover:bg-gray-50 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {freshnessLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Check Status
            </button>
            <StatusBadge enabled={isEnabled} status={status?.createStatus} />
          </div>
        </div>
      </div>

      {/* Configuration Details */}
      {isEnabled && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Retention</span>
              <p className="font-medium text-gray-900">
                {status?.retentionDays ? `${status.retentionDays} days` : 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Encryption</span>
              <p className="font-medium text-gray-900">
                {status?.encryptionType === 'S3_MANAGED_KEY' ? 'S3 Managed' : status?.encryptionType ?? 'N/A'}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Accounts</span>
              <p className="font-medium text-gray-900">
                {Object.keys(sourcesByAccount).length}
              </p>
            </div>
            <div>
              <span className="text-gray-500">Tables</span>
              <p className="font-medium text-gray-900">{tables.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Data Sources */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CloudCog className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-700">Data Sources</h3>
          </div>
          {freshnessChecked && (
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Receiving data
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-yellow-500" />
                No recent data
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-gray-300" />
                Not enabled
              </span>
            </div>
          )}
        </div>

        {sources.length === 0 ? (
          <p className="text-sm text-gray-500">No data sources configured</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(sourcesByAccount).map(([accountId, accountSources]) => (
              <div key={accountId}>
                <p className="text-xs text-gray-400 mb-2">Account: {accountId}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {accountSources.map((source) => {
                    const config = SOURCE_CONFIG[source.sourceName];
                    const freshnessKey = config?.freshnessKey ?? source.sourceName;
                    const freshness = dataFreshness[freshnessKey];
                    const hasTable = tables.some((t) =>
                      t.name.toLowerCase().includes((config?.tableKey ?? source.sourceName).toLowerCase())
                    );

                    return (
                      <SourceItem
                        key={`${source.accountId}-${source.sourceName}`}
                        name={config?.displayName ?? source.sourceName}
                        version={source.sourceVersion}
                        hasTable={hasTable}
                        latestEvent={freshness?.latestEvent ?? null}
                        hasRecentData={freshness?.hasRecentData ?? false}
                        isCheckingFreshness={freshnessLoading}
                        freshnessChecked={freshnessChecked}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tables */}
      {tables.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Table className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-gray-700">Glue Tables</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {tables.map((table) => (
              <span
                key={table.name}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
              >
                {table.name.replace('amazon_security_lake_table_us_east_1_', '')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ enabled, status }: { enabled: boolean; status?: string }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-50 text-red-700">
        <XCircle className="h-4 w-4" />
        Not Configured
      </span>
    );
  }

  if (status === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-50 text-green-700">
        <CheckCircle className="h-4 w-4" />
        Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-yellow-50 text-yellow-700">
      <AlertCircle className="h-4 w-4" />
      {status ?? 'Unknown'}
    </span>
  );
}

function SourceItem({
  name,
  version,
  hasTable,
  latestEvent,
  hasRecentData,
  isCheckingFreshness,
  freshnessChecked,
}: {
  name: string;
  version: string;
  hasTable: boolean;
  latestEvent: string | null;
  hasRecentData: boolean;
  isCheckingFreshness: boolean;
  freshnessChecked: boolean;
}) {
  // Determine status: active (recent data), warning (no recent data), or inactive (no table/data)
  const getStatus = () => {
    if (!freshnessChecked) {
      return { type: 'checking' as const, label: 'Checking...' };
    }
    if (hasRecentData && latestEvent) {
      return { type: 'active' as const, label: formatTimeAgo(latestEvent) };
    }
    if (hasTable && !hasRecentData) {
      return { type: 'warning' as const, label: 'No recent data' };
    }
    return { type: 'inactive' as const, label: 'Not enabled' };
  };

  const status = getStatus();

  const statusStyles = {
    active: {
      border: 'border-green-200',
      bg: 'bg-green-50',
      iconBg: 'bg-green-100',
      icon: <Zap className="h-4 w-4 text-green-600" />,
      nameColor: 'text-green-800',
      statusColor: 'text-green-600',
    },
    warning: {
      border: 'border-yellow-200',
      bg: 'bg-yellow-50',
      iconBg: 'bg-yellow-100',
      icon: <AlertCircle className="h-4 w-4 text-yellow-600" />,
      nameColor: 'text-yellow-800',
      statusColor: 'text-yellow-600',
    },
    inactive: {
      border: 'border-gray-200',
      bg: 'bg-gray-50',
      iconBg: 'bg-gray-100',
      icon: <XCircle className="h-4 w-4 text-gray-400" />,
      nameColor: 'text-gray-600',
      statusColor: 'text-gray-400',
    },
    checking: {
      border: 'border-gray-200',
      bg: 'bg-gray-50',
      iconBg: 'bg-gray-100',
      icon: <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />,
      nameColor: 'text-gray-600',
      statusColor: 'text-gray-400',
    },
  };

  const style = statusStyles[status.type];

  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-3 rounded-lg border',
        style.border,
        style.bg
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('p-1.5 rounded-md', style.iconBg)}>
          {isCheckingFreshness ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          ) : (
            style.icon
          )}
        </div>
        <div>
          <span className={cn('text-sm font-medium block', style.nameColor)}>
            {name}
          </span>
          <span className={cn('text-xs flex items-center gap-1', style.statusColor)}>
            {status.type === 'active' && <Clock className="h-3 w-3" />}
            {status.label}
          </span>
        </div>
      </div>
      <span className="text-xs text-gray-400 bg-white/50 px-2 py-0.5 rounded">v{version}</span>
    </div>
  );
}

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

// Simplified source item for external/cross-account mode
function ExternalSourceItem({
  name,
  latestEvent,
  hasRecentData,
  isCheckingFreshness,
}: {
  name: string;
  latestEvent: string | null;
  hasRecentData: boolean;
  isCheckingFreshness: boolean;
}) {
  const isActive = hasRecentData && latestEvent;

  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-3 rounded-lg border',
        isActive ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('p-1.5 rounded-md', isActive ? 'bg-green-100' : 'bg-yellow-100')}>
          {isCheckingFreshness ? (
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
          ) : isActive ? (
            <Zap className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          )}
        </div>
        <div>
          <span className={cn('text-sm font-medium block', isActive ? 'text-green-800' : 'text-yellow-800')}>
            {name}
          </span>
          <span className={cn('text-xs flex items-center gap-1', isActive ? 'text-green-600' : 'text-yellow-600')}>
            {isActive && <Clock className="h-3 w-3" />}
            {latestEvent ? formatTimeAgo(latestEvent) : 'No recent data'}
          </span>
        </div>
      </div>
    </div>
  );
}
