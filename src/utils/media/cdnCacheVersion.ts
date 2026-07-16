type Listener = () => void;

const versions = new Map<string, number>();
const listeners = new Set<Listener>();
let revision = 0;

function normalizeKey(key: string): string {
  return key.trim().replace(/^\/+/, "");
}

export function bumpPublicMediaCache(key: string | null | undefined): void {
  if (!key?.trim()) return;
  versions.set(normalizeKey(key), Date.now());
  revision += 1;
  listeners.forEach((listener) => listener());
}

export function bumpPublicMediaCacheForUser(userId: string, kind: "avatar" | "banner"): void {
  const prefix = kind === "avatar" ? "avatars/users" : "banners/users";
  // Legacy stable key + versioned prefix (new uploads use …/{userId}/{uuid}.webp).
  bumpPublicMediaCache(`${prefix}/${userId}.webp`);
  bumpMatchingPublicMediaCache(`${prefix}/${userId}/`);
}

export function bumpPublicMediaCacheForChannel(channelId: string): void {
  bumpPublicMediaCache(`avatars/channels/${channelId}.webp`);
  bumpMatchingPublicMediaCache(`avatars/channels/${channelId}/`);
}

function bumpMatchingPublicMediaCache(prefix: string): void {
  const normalizedPrefix = normalizeKey(prefix);
  let changed = false;
  for (const key of versions.keys()) {
    if (key.startsWith(normalizedPrefix)) {
      versions.set(key, Date.now());
      changed = true;
    }
  }
  if (changed) {
    revision += 1;
    listeners.forEach((listener) => listener());
  }
}

export function getPublicMediaCacheVersion(key: string): number | undefined {
  return versions.get(normalizeKey(key));
}

export function getPublicMediaCacheRevision(): number {
  return revision;
}

export function subscribePublicMediaCache(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
