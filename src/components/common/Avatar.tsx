// Avatar.tsx
// Avatar: obraz CDN, inicjały, kropka presence.
// Zakres:
//  - MediaImage + avatar.ts
//  - CDN / inicjały / kropka presence; rozmiar przez prop
// Nowy rozmiar: prop + CSS, nie hardcode w każdym miejscu.
// Przy zmianach: avatar.ts, MediaImage.tsx, PresenceContext.tsx.

import { useMemo } from "react";
import { profileImageUrl } from "../../utils/media/avatar";
import {
  useProfileAvatarStyle,
  useMediaCache,
} from "../../hooks/useMediaCache";
import { userLabel } from "../../utils/user/format";

interface AvatarProps {
  displayName?: string | null;
  username?: string;
  image?: string | null;
  color?: number | null;
  size?: number;
  placeholder?: string;
}

export function Avatar({
  displayName,
  username,
  image,
  color,
  size = 40,
  placeholder,
}: AvatarProps) {
  const cacheRevision = useMediaCache();
  const seed = username ?? displayName ?? "";
  const avatarStyle = useProfileAvatarStyle(image, color, seed);
  const hasPhoto = useMemo(
    () => Boolean(profileImageUrl(image)),
    [image, cacheRevision],
  );
  const name = userLabel({ displayName, username });

  if (placeholder != null && !hasPhoto) {
    return (
      <div
        className="avatar avatar-text"
        title={name}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(12, Math.round(size * 0.55)),
        }}
      >
        {placeholder}
      </div>
    );
  }

  return (
    <div
      className="avatar avatar-img"
      role="img"
      aria-label={name}
      title={name}
      style={{
        ...avatarStyle,
        width: size,
        height: size,
      }}
    />
  );
}
