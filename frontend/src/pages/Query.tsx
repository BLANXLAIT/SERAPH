import { QueryRunner } from '@/components/QueryRunner';

export function Query() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Query Explorer</h1>
        <p className="mt-1 text-sm text-gray-500">
          Run pre-built queries against Security Lake data
        </p>
      </div>

      {/* Query Runner Component */}
      <QueryRunner />
    </div>
  );
}
