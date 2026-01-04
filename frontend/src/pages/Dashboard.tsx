import { SecurityLakeStatus } from '@/components/SecurityLakeStatus';
import { QueryRunner } from '@/components/QueryRunner';

export function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Security Lake Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor Security Lake status and run verification queries
        </p>
      </div>

      {/* Security Lake Status */}
      <SecurityLakeStatus />

      {/* Query Runner */}
      <QueryRunner />
    </div>
  );
}
