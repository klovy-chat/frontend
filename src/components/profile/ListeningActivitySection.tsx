import type { ListeningActivity } from "../../types";
import { useTranslation } from "react-i18next";
import { isListeningNow } from "../../hooks/useSpotifyListeningSync";
import { isAllowedListeningUrl } from "../../utils/media/mediaAllowlist";

const PLATFORM_LABELS: Record<string, string> = {
  spotify: "Spotify",
};

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

  const platformLabel = PLATFORM_LABELS[activity.platform] ?? activity.platform;
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
          <span className="up-listening-platform-icon" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </span>
          <span>{platformLabel}</span>
        </div>
      </div>
    </div>
  );

  return (
    <section className="up-listening-section">
      <span className="up-section-label">{t("profile.listening.title")}</span>
      {externalUrl ? (
        <a
          href={externalUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="up-listening-link"
        >
          {content}
        </a>
      ) : (
        content
      )}
    </section>
  );
}
