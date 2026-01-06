import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SecurityLakeStatus } from '@/components/SecurityLakeStatus';
import { useRunQuery } from '@/hooks/useSecurityLake';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  Shield,
  ArrowRight,
  Loader2,
  RefreshCw,
  TrendingUp,
  Clock,
} from 'lucide-react';
import type { QueryResult } from '@/types';

export function Dashboard() {
  const runQueryMutation = useRunQuery();
  const [eventData, setEventData] = useState<QueryResult | null>(null);
  const [freshnessData, setFreshnessData] = useState<QueryResult | null>(null);

  const loadDashboardData = async () => {
    try {
      const [events, freshness] = await Promise.all([
        runQueryMutation.mutateAsync('cloudtrail-event-count'),
        runQueryMutation.mutateAsync('data-freshness'),
      ]);
      setEventData(events);
      setFreshnessData(freshness);
    } catch {
      // Error handled by mutation
    }
  };

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartData =
    eventData?.rows?.map((row) => ({
      date: row.event_date ? new Date(row.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
      events: parseInt(row.event_count ?? '0', 10),
    })).reverse() ?? [];

  const totalEvents = chartData.reduce((sum, d) => sum + d.events, 0);

  const latestCloudTrail = freshnessData?.rows?.find((r) => r.source === 'CloudTrail');
  const latestSecurityHub = freshnessData?.rows?.find((r) => r.source === 'Security Hub');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your Security Lake status and activity
          </p>
        </div>
        <button
          onClick={loadDashboardData}
          disabled={runQueryMutation.isPending}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
            'text-sm font-medium text-gray-700 bg-white border border-gray-300',
            'hover:bg-gray-50',
            'disabled:bg-gray-100 disabled:cursor-not-allowed',
            'transition-colors'
          )}
        >
          {runQueryMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Events (7 days)"
          value={totalEvents.toLocaleString()}
          icon={Activity}
          color="indigo"
          loading={runQueryMutation.isPending && !eventData}
        />
        <StatCard
          title="Latest CloudTrail Event"
          value={latestCloudTrail?.latest_event ? formatTimeAgo(latestCloudTrail.latest_event) : 'Loading...'}
          icon={Clock}
          color="green"
          loading={runQueryMutation.isPending && !freshnessData}
        />
        <StatCard
          title="Latest Security Hub Finding"
          value={latestSecurityHub?.latest_event ? formatTimeAgo(latestSecurityHub.latest_event) : 'Loading...'}
          icon={Shield}
          color="purple"
          loading={runQueryMutation.isPending && !freshnessData}
        />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Event Activity</h2>
            <p className="text-sm text-gray-500">CloudTrail events over the last 7 days</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="font-medium text-green-600">{totalEvents.toLocaleString()}</span>
            <span>total events</span>
          </div>
        </div>

        {runQueryMutation.isPending && !eventData ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        ) : chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
                <Bar dataKey="events" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            <p>No event data available</p>
          </div>
        )}
      </div>

      {/* Security Lake Status */}
      <SecurityLakeStatus />

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <QuickLinkCard
          title="Security Findings"
          description="View Security Hub findings with severity >= Medium"
          href="/findings"
          icon={AlertTriangle}
          color="orange"
        />
        <QuickLinkCard
          title="Explore Events"
          description="Query and analyze CloudTrail events"
          href="/events"
          icon={Activity}
          color="blue"
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  loading,
}: {
  title: string;
  value: string;
  icon: typeof Activity;
  color: 'indigo' | 'green' | 'purple';
  loading?: boolean;
}) {
  const colorClasses = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-4">
        <div className={cn('p-3 rounded-lg', colorClasses[color])}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          {loading ? (
            <Loader2 className="h-6 w-6 text-gray-400 animate-spin" />
          ) : (
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          )}
          <p className="text-sm text-gray-500">{title}</p>
        </div>
      </div>
    </div>
  );
}

function QuickLinkCard({
  title,
  description,
  href,
  icon: Icon,
  color,
}: {
  title: string;
  description: string;
  href: string;
  icon: typeof Activity;
  color: 'orange' | 'blue';
}) {
  const colorClasses = {
    orange: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100',
    blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100',
  };

  return (
    <Link
      to={href}
      className="group bg-white rounded-lg border border-gray-200 p-6 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={cn('p-3 rounded-lg transition-colors', colorClasses[color])}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
      </div>
    </Link>
  );
}

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}
