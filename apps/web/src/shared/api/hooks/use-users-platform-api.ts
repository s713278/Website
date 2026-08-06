import { useQuery } from '@tanstack/react-query';
import { usersService, platformService, ordersService } from '@mithra/api-client';
import { queryKeys } from '@/shared/api/query-keys';

export function useUser(userId: number | string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.users.detail(userId || 'unknown'),
    queryFn: () => usersService.get(userId!),
    enabled: userId != null && userId !== '',
  });
}

export function useUserDashboard(userId: number | string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.users.dashboard(userId || 'unknown'),
    queryFn: () => usersService.dashboard(userId!),
    enabled: userId != null && userId !== '',
  });
}

export function useUserOrderHistory(userId: number | string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.users.orders(userId || 'unknown'),
    queryFn: () => ordersService.userHistory(userId!),
    enabled: userId != null && userId !== '',
  });
}

export function useFaqs() {
  return useQuery({
    queryKey: queryKeys.platform.faqs(),
    queryFn: () => platformService.listFaqs(),
  });
}

export function useMeasurements() {
  return useQuery({
    queryKey: queryKeys.platform.measurements(),
    queryFn: () => platformService.listMeasurements(),
  });
}
