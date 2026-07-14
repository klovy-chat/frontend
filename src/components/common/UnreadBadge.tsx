interface UnreadBadgeProps {
  count: number;
}

export function UnreadBadge({ count }: UnreadBadgeProps) {
  if (count <= 0) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <span className="sidebar-unread-badge" aria-label={`${count} nieprzeczytanych`}>
      {label}
    </span>
  );
}
