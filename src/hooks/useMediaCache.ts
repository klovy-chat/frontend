// useMediaCache.ts
// Rewizja URL mediów po zmianie avatara/bannera.
// Zakres:
//  - cache-bust query
//  - bump query URL po zmianie avatara/bannera
// Po udanym uploadzie zdjęcia zrób bump, inaczej zostanie stary plik z CDN.
// Przy zmianach: cdnVersion.ts, avatar.ts.

import { useMemo, useSyncExternalStore } from "react";
import {
  getPublicMediaCacheRevision,
  subscribePublicMediaCache,
} from "../utils/media/cdnVersion";
import { profileAvatarStyle, profileBannerStyle } from "../utils/media/avatar";

export function useMediaCache(): number {
  return useSyncExternalStore(subscribePublicMediaCache, getPublicMediaCacheRevision);
}

export function useProfileBannerStyle(
  banner: string | null | undefined,
  colorIndex?: number | null,
  seed = "",
) {
  const cacheRevision = useMediaCache();
  return useMemo(
    () => profileBannerStyle(banner, colorIndex, seed),
    [banner, colorIndex, seed, cacheRevision],
  );
}

export function useProfileAvatarStyle(
  image: string | null | undefined,
  colorIndex?: number | null,
  seed = "",
) {
  const cacheRevision = useMediaCache();
  return useMemo(
    () => profileAvatarStyle(image, colorIndex, seed),
    [image, colorIndex, seed, cacheRevision],
  );
}
