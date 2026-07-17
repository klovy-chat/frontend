import { useMemo } from "react";
import { profileImageUrl } from "../../utils/media/avatar";
import { useProfileAvatarStyle, usePublicMediaCacheRevision } from "../../hooks/usePublicMediaCacheRevision";
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
  const cacheRevision = usePublicMediaCacheRevision();
  const seed = username ?? displayName ?? "";
  const avatarStyle = useProfileAvatarStyle(image, color, seed);
  const hasPhoto = useMemo(
    () => Boolean(profileImageUrl(image)),
    [image, cacheRevision],
  );
  const name = userLabel({ displayName, username });
  const fontSize = Math.max(12, Math.round(size * 0.42));
  const initial = (name.trim().charAt(0) || "?").toUpperCase();

  if (placeholder != null && !hasPhoto) {
    return (
      <div
        className="avatar avatar-text"
        title={name}
        style={{
          ...avatarStyle,
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
      className={`avatar avatar-img${hasPhoto ? "" : " avatar-text"}`}
      role="img"
      aria-label={name}
      title={name}
      style={{
        ...avatarStyle,
        width: size,
        height: size,
        fontSize: hasPhoto ? undefined : fontSize,
      }}
    >
      {hasPhoto ? null : initial}
    </div>
  );
}
