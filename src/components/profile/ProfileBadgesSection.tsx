import BadgeComponent from "../common/Badge";
import type { Badge } from "../../types";
import { useTranslation } from "react-i18next";
import { badgeInstanceKey } from "../../utils/user/badges";

interface ProfileBadgesSectionProps {
  badges?: Badge[];
}

function resolveBadgeEntries(badges?: Badge[]) {
  if (!badges?.length) return [];
  return badges.filter((badge) => badge.badgeId);
}

export function ProfileBadgesSection({ badges }: ProfileBadgesSectionProps) {
  const { t } = useTranslation();
  const entries = resolveBadgeEntries(badges);
  if (entries.length === 0) return null;

  return (
    <section className="up-badges-section">
      <span className="up-section-label">{t("profile.badges.title")}</span>
      <div className="up-badges-list">
        {entries.map((badge, index) => (
          <BadgeComponent
            key={badgeInstanceKey(badge, index)}
            name={badge.badgeId!.name}
            icon={badge.badgeId!.icon}
            color={badge.badgeId!.color}
            description={badge.badgeId!.description}
            size="md"
            tooltipPlacement="bottom"
          />
        ))}
      </div>
    </section>
  );
}
