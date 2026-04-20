export interface CloudTrack {
  id: string;
  title: string;
  description: string;
  iconName: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export interface CloudPhoto {
  id: string;
  trackId: string;
  objectPath: string;
  takenAt: string;
  updatedAt: string;
  deleted: boolean;
  tiltX?: number | null;
  tiltY?: number | null;
  tiltZ?: number | null;
}

export interface CloudSnapshot {
  tracks: CloudTrack[];
  photos: CloudPhoto[];
}

export interface UploadUrlResponse {
  uploadURL: string;
  objectPath: string;
  metadata: { name: string; size: number; contentType: string };
}

export type TokenGetter = () => Promise<string | null> | string | null;

export function getApiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return "";
  return `https://${domain}`;
}

async function authedFetch(
  path: string,
  init: RequestInit,
  getToken: TokenGetter,
): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("Content-Type", "application/json");
  }
  const url = `${getApiBaseUrl()}${path}`;
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
  }
  return res;
}

export async function fetchSnapshot(getToken: TokenGetter): Promise<CloudSnapshot> {
  const res = await authedFetch("/api/sync/snapshot", { method: "GET" }, getToken);
  return (await res.json()) as CloudSnapshot;
}

export async function pushSync(
  body: CloudSnapshot,
  getToken: TokenGetter,
): Promise<CloudSnapshot> {
  const res = await authedFetch(
    "/api/sync/push",
    { method: "POST", body: JSON.stringify(body) },
    getToken,
  );
  return (await res.json()) as CloudSnapshot;
}

export async function requestUploadUrl(
  metadata: { name: string; size: number; contentType: string },
  getToken: TokenGetter,
): Promise<UploadUrlResponse> {
  const res = await authedFetch(
    "/api/storage/uploads/request-url",
    { method: "POST", body: JSON.stringify(metadata) },
    getToken,
  );
  return (await res.json()) as UploadUrlResponse;
}
