const PALETTE = [
  "#3b82f6", // blue
  "#f59e0b", // gold
  "#10b981", // mint
  "#ec4899", // pink
];

const AVATAR_IMAGES = [
  "/assets/blue.png",
  "/assets/gold.png",
  "/assets/mint.png",
  "/assets/pink.png",
];

export function avatarColor(colorIndex?: number | null, seed = ""): string {
  if (colorIndex != null && colorIndex >= 0) {
    return PALETTE[colorIndex % PALETTE.length];
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function resolveAvatarColorIndex(colorIndex?: number | null): number {
  if (colorIndex != null && colorIndex >= 0) {
    return colorIndex % AVATAR_IMAGES.length;
  }
  return 0;
}

export function getDefaultAvatarImage(colorIndex?: number | null, seed = ""): string {
  if (colorIndex != null && colorIndex >= 0) {
    return AVATAR_IMAGES[colorIndex % AVATAR_IMAGES.length];
  }
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_IMAGES[Math.abs(hash) % AVATAR_IMAGES.length];
  }
  return AVATAR_IMAGES[0];
}

function profileBannerGradient(
  colorIndex?: number | null,
  seed = "",
): string {
  const accent = avatarColor(colorIndex, seed);
  return `linear-gradient(145deg, ${accent} 0%, ${accent}99 38%, #0F0F11 100%)`;
}

import {
  isAvatarKey,
  isBannerKey,
  normalizeMediaKey,
  publicCdnUrl,
} from "./cdn";
import { getPublicMediaCacheVersion } from "./cdnCacheVersion";
import { isAllowedExternalMediaUrl, isSafeProfileUploadPath } from "./mediaAllowlist";

function resolveProfileMediaUrl(
  path: string,
  cacheVersion?: string | number,
): string | null {
  const version = cacheVersion ?? getPublicMediaCacheVersion(path);
  return publicCdnUrl(path, version);
}

function resolveAvatarUrl(
  image: string,
  cacheVersion?: string | number,
): string | null {
  const trimmed = image.trim();
  if (trimmed.startsWith("//")) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return isAllowedExternalMediaUrl(trimmed) ? trimmed : null;
  }

  const path = normalizeMediaKey(trimmed);
  if (!isSafeProfileUploadPath(path) || !isAvatarKey(path)) {
    return null;
  }

  return resolveProfileMediaUrl(path, cacheVersion);
}

function resolveBannerUrl(
  banner: string,
  cacheVersion?: string | number,
): string | null {
  const trimmed = banner.trim();
  if (trimmed.startsWith("//")) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return isAllowedExternalMediaUrl(trimmed) ? trimmed : null;
  }

  const path = normalizeMediaKey(trimmed);
  if (!isSafeProfileUploadPath(path) || !isBannerKey(path)) {
    return null;
  }

  return resolveProfileMediaUrl(path, cacheVersion);
}

export function profileImageUrl(
  image: string | null | undefined,
  cacheVersion?: string | number,
): string | null {
  if (!image) return null;
  return resolveAvatarUrl(image, cacheVersion);
}

function profileBannerUrl(
  banner: string | null | undefined,
  cacheVersion?: string | number,
): string | null {
  if (!banner) return null;
  return resolveBannerUrl(banner, cacheVersion);
}

export function profileBannerStyle(
  banner: string | null | undefined,
  colorIndex?: number | null,
  seed = "",
  cacheVersion?: string | number,
): { background?: string; backgroundImage?: string; backgroundSize?: string; backgroundPosition?: string } {
  const url = profileBannerUrl(banner, cacheVersion);
  if (url) {
    return {
      backgroundImage: `url(${url})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return { background: profileBannerGradient(colorIndex, seed) };
}

export function profileAvatarStyle(
  image: string | null | undefined,
  colorIndex?: number | null,
  seed = "",
  cacheVersion?: string | number,
): {
  background?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
} {
  const url = profileImageUrl(image, cacheVersion);
  if (url) {
    return {
      backgroundImage: `url(${url})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return { background: avatarColor(colorIndex, seed) };
}
