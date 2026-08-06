/**
 * Bridge app auth store ↔ @mithra/api-client token storage + axios interceptors.
 */
import {
  clearTokens,
  configureApiClient,
  resetHttpClient,
  setTokens,
} from '@mithra/api-client';
import { env } from '@/shared/lib/env';
import { useAuthStore } from '@/features/auth/store/auth-store';

let configured = false;

export function ensureApiClientConfigured() {
  if (configured) return;
  configureApiClient({
    baseURL: env.VITE_API_BASE_URL,
    timeoutMs: 15_000,
    onUnauthorized: () => {
      useAuthStore.getState().clearSession();
      clearTokens();
    },
  });
  configured = true;
}

export function syncApiTokensFromSession() {
  const { accessToken, refreshToken } = useAuthStore.getState();
  if (accessToken) setTokens(accessToken, refreshToken);
  else clearTokens();
}

export function wireAuthStoreToApiClient() {
  ensureApiClientConfigured();
  syncApiTokensFromSession();

  useAuthStore.subscribe((state, prev) => {
    if (state.accessToken !== prev.accessToken || state.refreshToken !== prev.refreshToken) {
      if (state.accessToken) setTokens(state.accessToken, state.refreshToken);
      else clearTokens();
      resetHttpClient();
      ensureApiClientConfigured();
    }
  });
}
