import { useTranslation } from "react-i18next";
import type { ConnectedAccount } from "../../types";
import { openSpotifyAppLink } from "../../utils/integrations/spotifyLinks";
import { IntegrationProviderIcon } from "./IntegrationProviderIcon";

interface ConnectedAccountsSectionProps {
  accounts: ConnectedAccount[] | null | undefined;
}

export function ConnectedAccountsSection({ accounts }: ConnectedAccountsSectionProps) {
  const { t } = useTranslation();
  if (!accounts?.length) return null;

  return (
    <section className="up-connected-section">
      <span className="up-section-label">{t("profile.connectedAccounts.title")}</span>
      <div className="up-connected-list">
        {accounts.map((account) => (
          <button
            key={`${account.provider}:${account.profileUrl}`}
            type="button"
            className="up-connected-row"
            onClick={() => {
              if (account.provider === "spotify") {
                openSpotifyAppLink(account.profileUrl);
              }
            }}
          >
            <IntegrationProviderIcon provider={account.provider} />
            <span className="up-connected-name">{account.accountName}</span>
            <svg
              className="up-connected-external"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        ))}
      </div>
    </section>
  );
}
