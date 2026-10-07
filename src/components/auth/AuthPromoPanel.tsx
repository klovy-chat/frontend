import { useTranslation } from "react-i18next";

export type AuthPromoVariant = "login" | "register";

interface AuthPromoPanelProps {
  variant: AuthPromoVariant;
}

export function AuthPromoPanel({ variant }: AuthPromoPanelProps) {
  const { t } = useTranslation();

  const featureKeys = [
    "noAds",
    "rust",
    "openSource",
  ] as const;

  return (
    <aside
      className="al-auth-promo"
      aria-label={t("auth.promo.ariaLabel")}
    >
      <div className="al-auth-promo__rings" aria-hidden="true" />
      <div className="al-auth-promo__blobs" aria-hidden="true" />

      <div className="al-auth-promo__brand">
        <img
          src="/assets/logo_colour.png"
          alt=""
          width={28}
          height={28}
          className="al-auth-promo__logo"
        />
        <span className="al-auth-promo__name">KlovyChat</span>
      </div>

      <div className="al-auth-promo__body">

        <h2 className="al-auth-promo__title">
          {t(`auth.promo.${variant}.titleLine1`)}
          <br />
          {t(`auth.promo.${variant}.titleLine2`)}
        </h2>

        {variant === "login" ? (
          <p className="al-auth-promo__text">
            {t("auth.promo.login.body")}
          </p>
        ) : (
          <ul className="al-auth-promo__features">
            {featureKeys.map((key) => (
              <li key={key} className="al-auth-promo__feature">
                <span className="al-auth-promo__check" aria-hidden="true">
                  ✓
                </span>
                <span>
                  {t(`auth.promo.register.features.${key}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="al-auth-promo__footer">
        {t(`auth.promo.${variant}.footer`)}
      </p>
    </aside>
  );
}
