import { useMemo, useSyncExternalStore } from "react";
import {
  getPublicMediaCacheRevision,
  subscribePublicMediaCache,
} from "../utils/media/cdnCacheVersion";
import { profileAvatarStyle, profileBannerStyle } from "../utils/media/avatar";

export function usePublicMediaCacheRevision(): number {
  return useSyncExternalStore(subscribePublicMediaCache, getPublicMediaCacheRevision);
}

export function useProfileBannerStyle(
  banner: string | null | undefined,
  colorIndex?: number | null,
  seed = "",
) {
  const cacheRevision = usePublicMediaCacheRevision();
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
  const cacheRevision = usePublicMediaCacheRevision();
  return useMemo(
    () => profileAvatarStyle(image, colorIndex, seed),
    [image, colorIndex, seed, cacheRevision],
  );
}
