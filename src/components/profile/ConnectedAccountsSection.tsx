import { useTranslation } from "react-i18next";
import type { ConnectedAccount } from "../../types";
import { openSpotifyAppLink } from "../../utils/integrations/spotifyLinks";
import { IntegrationProviderIcon } from "./IntegrationProviderIcon";

interface ConnectedAccountsSectionProps {
  accounts: ConnectedAccount[] | null | undefined;
}

function providerLabel(provider: string, t: (key: string) => string): string {
  if (provider === "spotify") {
    return t("profile.connectedAccounts.providers.spotify");
  }
  return provider;
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
            <span className="up-connected-copy">
              <span className="up-connected-provider">
                {providerLabel(account.provider, t)}
              </span>
              <span className="up-connected-name">{account.accountName}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
