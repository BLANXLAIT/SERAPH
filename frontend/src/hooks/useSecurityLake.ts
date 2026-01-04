// React Query hooks for Security Lake data fetching

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';

export function useSecurityLakeStatus() {
  return useQuery({
    queryKey: ['securityLakeStatus'],
    queryFn: api.getSecurityLakeStatus,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useLogSources() {
  return useQuery({
    queryKey: ['logSources'],
    queryFn: api.getLogSources,
    refetchInterval: 60000,
  });
}

export function useTables() {
  return useQuery({
    queryKey: ['tables'],
    queryFn: api.getTables,
  });
}

export function useAvailableQueries() {
  return useQuery({
    queryKey: ['availableQueries'],
    queryFn: api.getAvailableQueries,
  });
}

export function useRunQuery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (queryId: string) => api.runQuery(queryId),
    onSuccess: () => {
      // Optionally invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['queryResults'] });
    },
  });
}
