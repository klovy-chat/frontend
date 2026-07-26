import { apiRequest } from "./client";
import type { ConnectedAccount, ListeningActivity } from "../types";

export const LISTENING_SYNC_PROVIDER = "spotify";

export interface IntegrationCatalogItem {
  id: string;
  name: string;
  oauthSupported: boolean;
  enabled: boolean;
  listeningSync?: boolean;
}

export interface IntegrationStatus {
  provider: string;
  connected: boolean;
  enabled: boolean;
  oauthSupported: boolean;
  accountName?: string | null;
  profileUrl?: string | null;
  shareListening?: boolean;
}

export interface ListeningSyncResult {
  listeningActivity: ListeningActivity | null;
  shareListening: boolean;
  applied?: boolean;
}

export function getIntegrationsCatalog(): Promise<{ providers: IntegrationCatalogItem[] }> {
  return apiRequest<{ providers: IntegrationCatalogItem[] }>("/api/integrations/catalog");
}

export function getIntegrationStatus(provider: string): Promise<IntegrationStatus> {
  return apiRequest<IntegrationStatus>(`/api/integrations/${provider}/status`);
}

function getIntegrationConnectUrl(provider: string, returnTo?: string): Promise<{ url: string }> {
  const origin = returnTo ?? window.location.origin;
  return apiRequest<{ url: string }>(
    `/api/integrations/${provider}/connect-url?returnTo=${encodeURIComponent(origin)}`,
  );
}

export async function connectIntegration(provider: string, returnTo?: string): Promise<void> {
  const { url } = await getIntegrationConnectUrl(provider, returnTo);
  window.location.assign(url);
}

export function disconnectIntegration(
  provider: string,
): Promise<{ success: boolean; connected: boolean; provider?: string }> {
  return apiRequest(`/api/integrations/${provider}/disconnect`, { method: "DELETE" });
}

export function syncListeningActivity(
  provider: string,
  payload: {
    clientType: "web" | "desktop" | "mobile";
    clientInstanceId: string;
  },
): Promise<ListeningSyncResult> {
  return apiRequest<ListeningSyncResult>(`/api/integrations/${provider}/sync`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateShareListening(
  shareListening: boolean,
): Promise<{ success: boolean; shareListening: boolean }> {
  return apiRequest("/api/integrations/listening/settings", {
    method: "PATCH",
    body: JSON.stringify({ shareListening }),
  });
}

export function mergeConnectedAccount(
  accounts: ConnectedAccount[] | undefined,
  provider: string,
  next: Pick<ConnectedAccount, "accountName" | "profileUrl"> | null,
): ConnectedAccount[] {
  const base = (accounts ?? []).filter((a) => a.provider !== provider);
  if (!next) return base;
  return [...base, { provider, accountName: next.accountName, profileUrl: next.profileUrl }];
}
