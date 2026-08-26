// UnreadBadge.tsx
// Czerwone kółko z liczbą (0 = ukryj).
// Zakres:
//  - czysty presentational
//  - liczba z props (unread.ts / Nav), 0 = ukryj
// Skąd liczba: unread.ts / props z Nav, nie fetch tutaj.
// Przy zmianach: Nav.tsx, unread.ts.

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
