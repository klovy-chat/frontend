import { useEffect, useMemo, useState } from "react";
import { getDefaultAvatarImage, profileImageUrl, resolveAvatarColorIndex } from "../../utils/media/avatar";
import { usePublicMediaCacheRevision } from "../../hooks/usePublicMediaCacheRevision";
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
  const src = useMemo(
    () => profileImageUrl(image),
    [image, cacheRevision],
  );
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [src]);
  const name = userLabel({ displayName, username });
  const defaultAvatarSrc = getDefaultAvatarImage(resolveAvatarColorIndex(color));

  if (src && !imageFailed) {
    return (
      <img
        className="avatar avatar-img"
        src={src}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        onError={() => setImageFailed(true)}
      />
    );
  }

  if (placeholder != null) {
    return (
      <div
        className="avatar avatar-text"
        title={name}
        style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.55)) }}
      >
        {placeholder}
      </div>
    );
  }

  return (
    <img
      className="avatar avatar-img"
      src={defaultAvatarSrc}
      alt={name}
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}
