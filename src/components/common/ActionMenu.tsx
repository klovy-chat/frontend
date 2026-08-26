// ActionMenu.tsx
// Dropdown akcji (trigger + portal pozycji).
// Zakres:
//  - danger variant
//  - trigger + portal; pozycje z tablicy items
// Nowa pozycja: tablica items, nie kopiuj markup.
// Przy zmianach: action-menu.css, ChannelSettings.tsx.

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import "../../styles/common/action-menu.css";

export type ActionMenuItem = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
};

type ActionMenuProps = {
  label: string;
  items: ActionMenuItem[];
};

export function ActionMenu({ label, items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({
    position: "fixed",
    visibility: "hidden",
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;

    const updatePosition = () => {
      const trigger = triggerRef.current!;
      const menu = menuRef.current!;
      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gap = 6;
      const padding = 12;

      let left = triggerRect.left;
      if (left + menuRect.width > viewportWidth - padding) {
        left = Math.max(padding, viewportWidth - menuRect.width - padding);
      }

      const spaceBelow = viewportHeight - triggerRect.bottom - gap;
      const spaceAbove = triggerRect.top - gap;
      const openBelow =
        spaceBelow >= menuRect.height || spaceBelow >= spaceAbove;

      setMenuStyle({
        position: "fixed",
        left,
        top: openBelow ? triggerRect.bottom + gap : undefined,
        bottom: openBelow ? undefined : viewportHeight - triggerRect.top + gap,
        minWidth: Math.max(210, triggerRect.width),
        zIndex: 1450,
        visibility: "visible",
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          className="action-menu-dropdown"
          id={menuId}
          role="menu"
          style={menuStyle}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={`action-menu-item${item.danger ? " action-menu-item--danger" : ""}`}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              <span className="action-menu-item-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="action-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="action-menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <ChevronDown
          size={14}
          className={`action-menu-chevron${open ? " action-menu-chevron--open" : ""}`}
        />
      </button>
      {menu}
    </div>
  );
}
