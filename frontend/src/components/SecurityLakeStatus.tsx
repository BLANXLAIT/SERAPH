import { cn } from '@/lib/utils';
import { useSecurityLakeStatus, useLogSources, useTables } from '@/hooks/useSecurityLake';
import {
  Database,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  CloudCog,
  Table,
} from 'lucide-react';

// Map source names to display-friendly names
const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  CLOUD_TRAIL_MGMT: 'CloudTrail Management',
  SH_FINDINGS: 'Security Hub',
  VPC_FLOW: 'VPC Flow Logs',
  ROUTE53: 'Route 53 DNS',
  LAMBDA_EXECUTION: 'Lambda Execution',
  S3_DATA: 'S3 Data Events',
  EKS_AUDIT: 'EKS Audit Logs',
  WAF: 'WAF Logs',
};

export function SecurityLakeStatus() {
  const { data: status, isLoading: statusLoading, error: statusError } = useSecurityLakeStatus();
  const { data: sourcesData, isLoading: sourcesLoading } = useLogSources();
  const { data: tablesData, isLoading: tablesLoading } = useTables();

  const isLoading = statusLoading || sourcesLoading || tablesLoading;

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

  if (statusError) {
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
  const tables = tablesData?.tables ?? [];

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
          <StatusBadge enabled={isEnabled} status={status?.createStatus} />
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
        <div className="flex items-center gap-2 mb-4">
          <CloudCog className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-700">Data Sources</h3>
        </div>

        {sources.length === 0 ? (
          <p className="text-sm text-gray-500">No data sources configured</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(sourcesByAccount).map(([accountId, accountSources]) => (
              <div key={accountId}>
                <p className="text-xs text-gray-400 mb-2">Account: {accountId}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {accountSources.map((source) => (
                    <SourceItem
                      key={`${source.accountId}-${source.sourceName}`}
                      name={SOURCE_DISPLAY_NAMES[source.sourceName] ?? source.sourceName}
                      version={source.sourceVersion}
                      hasData={tables.some((t) =>
                        t.name.toLowerCase().includes(source.sourceName.toLowerCase().replace('_', ''))
                      )}
                    />
                  ))}
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
  hasData,
}: {
  name: string;
  version: string;
  hasData: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-2 rounded-lg border',
        hasData ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
      )}
    >
      <div className="flex items-center gap-2">
        {hasData ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <AlertCircle className="h-4 w-4 text-gray-400" />
        )}
        <span className={cn('text-sm font-medium', hasData ? 'text-green-700' : 'text-gray-600')}>
          {name}
        </span>
      </div>
      <span className="text-xs text-gray-400">v{version}</span>
    </div>
  );
}
