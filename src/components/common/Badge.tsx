import React, { useState } from "react";
import * as LucideIcons from "lucide-react";
import { isValidBadgeIcon, sanitizeBadgeColor } from "../../utils/user/badgeValidation";
import "./badge.css";

interface BadgeProps {
  name: string;
  icon: string;
  color?: string | null;
  description?: string | null;
  size?: "sm" | "md" | "lg";
  tooltipPlacement?: "top" | "bottom";
}

const BadgeComponent: React.FC<BadgeProps> = ({
  name,
  icon,
  color,
  description,
  size = "md",
  tooltipPlacement = "top",
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const IconComponent =
    (isValidBadgeIcon(icon) && (LucideIcons as any)[icon]) || LucideIcons.Star;
  const badgeColor = sanitizeBadgeColor(color);

  const sizeClass = `badge-${size}`;
  const placementClass =
    tooltipPlacement === "bottom" ? "badge--tooltip-bottom" : "badge--tooltip-top";

  return (
    <div
      className={`badge ${sizeClass} ${placementClass}`}
      style={{ "--badge-color": badgeColor } as React.CSSProperties}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      aria-label={name}
    >
      <IconComponent
        size={size === "sm" ? 16 : size === "md" ? 20 : 24}
        color={badgeColor}
        className="badge-icon"
      />
      {showTooltip && (
        <div className="badge-tooltip" role="tooltip">
          <div className="badge-tooltip-name">{name}</div>
          {description ? (
            <div className="badge-tooltip-description">{description}</div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default BadgeComponent;
