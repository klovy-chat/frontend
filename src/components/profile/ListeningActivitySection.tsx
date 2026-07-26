import type { ListeningActivity } from "../../types";
import { useTranslation } from "react-i18next";
import { isListeningNow } from "../../hooks/useListeningSync";
import { isAllowedListeningUrl } from "../../utils/media/mediaAllowlist";
import { openSpotifyAppLink } from "../../utils/integrations/spotifyLinks";
import { IntegrationProviderIcon } from "./IntegrationProviderIcon";

interface ListeningActivitySectionProps {
  activity: ListeningActivity | null | undefined;
}

function parseListeningDisplay(activity: ListeningActivity) {
  let title = activity.trackTitle.trim();
  let artist = activity.artist?.trim();

  if (!artist && title.includes(" — ")) {
    const splitAt = title.indexOf(" — ");
    artist = title.slice(splitAt + 3).trim();
    title = title.slice(0, splitAt).trim();
  }

  return { title, artist };
}

export function ListeningActivitySection({ activity }: ListeningActivitySectionProps) {
  const { t } = useTranslation();
  if (!isListeningNow(activity)) return null;

  const { title, artist } = parseListeningDisplay(activity);
  const albumArt =
    activity.albumArt && isAllowedListeningUrl(activity.albumArt)
      ? activity.albumArt
      : undefined;
  const externalUrl =
    activity.externalUrl && isAllowedListeningUrl(activity.externalUrl)
      ? activity.externalUrl
      : undefined;

  const content = (
    <div className="up-listening-card">
      {albumArt ? (
        <img
          src={albumArt}
          alt=""
          className="up-listening-art"
          width={48}
          height={48}
          loading="lazy"
        />
      ) : (
        <div className="up-listening-art up-listening-art-fallback" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
          </svg>
        </div>
      )}
      <div className="up-listening-meta">
        <p className="up-listening-track" title={title}>
          {title}
        </p>
        {artist ? (
          <p className="up-listening-artist" title={artist}>
            {artist}
          </p>
        ) : null}
        <div className="up-listening-platform">
          <IntegrationProviderIcon provider={activity.platform} className="up-listening-platform-icon" />
          <span>{t("profile.connectedAccounts.providers.spotify")}</span>
        </div>
      </div>
    </div>
  );

  return (
    <section className="up-listening-section">
      <span className="up-section-label">{t("profile.listening.title")}</span>
      {externalUrl ? (
        <button
          type="button"
          className="up-listening-link"
          onClick={() => openSpotifyAppLink(externalUrl)}
        >
          {content}
        </button>
      ) : (
        content
      )}
    </section>
  );
}
