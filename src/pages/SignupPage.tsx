import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { TurnstileWidget } from "../components/auth/TurnstileWidget";
import { AuthPageLayout } from "../components/auth/AuthPageLayout";
import {
  normalizeUsernameInput,
  sanitizeUsernameInput,
  validateUsernameInput,
} from "../utils/auth/username";
import { validatePasswordStrength } from "../utils/auth/password";
import { checkPasswordBreach } from "../utils/auth/pwnedPassword";
import { loadStoredLocale } from "../utils/locale/localeStorage";
import "../styles/auth/auth.css";

export function SignupPage() {
  const { t } = useTranslation();
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!turnstileToken) {
      setError(t("validation.captcha.signup"));
      return;
    }

    if (!accepted) {
      setError(t("validation.terms.required"));
      return;
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    const breachCheck = await checkPasswordBreach(password);
    if (breachCheck === "breached") {
      setError(t("auth.password.breach"));
      return;
    }

    const usernameError = validateUsernameInput(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    setLoading(true);
    try {
      const message = await signup(
        normalizeUsernameInput(username),
        password,
        turnstileToken,
        loadStoredLocale(),
      );
      setInfo(message ?? t("auth.signup.success"));
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("auth.errors.signupFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout>
      <div className="al-card al-card--solo">
        <div className="al-left">
          <h1 className="al-title">{t("auth.signup.title")}</h1>

          <form className="al-form" onSubmit={handleSubmit} noValidate>
            <div className="al-field">
              <label htmlFor="sp-username">{t("auth.fields.username")}</label>
              <input
                id="sp-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(sanitizeUsernameInput(e.target.value))}
                placeholder={t("auth.fields.usernamePlaceholder")}
                required
                minLength={3}
                maxLength={32}
                pattern="[a-z0-9_]+"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="text"
              />
              <p className="al-field-hint">{t("auth.fields.usernameHint")}</p>
            </div>

            <div className="al-field">
              <label htmlFor="sp-password">{t("auth.fields.password")}</label>
              <div className="al-input-wrap">
                <input
                  id="sp-password"
                  className="al-input--pass"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.signup.passwordPlaceholder")}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="al-toggle-pass"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword
                      ? t("auth.fields.hidePassword")
                      : t("auth.fields.showPassword")
                  }
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              <p className="al-field-hint">{t("auth.signup.passwordHint")}</p>
            </div>

            <TurnstileWidget
              onToken={setTurnstileToken}
              onExpire={() => setTurnstileToken("")}
            />

            {error && (
              <div className="al-error" role="alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {info && (
              <div className="al-success" role="status">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                {info}
              </div>
            )}

            <label className="al-checkbox-wrap">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span className="al-checkbox-box">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </span>
              <span className="al-checkbox-text">
                {t("auth.signup.termsPrefix")}{" "}
                <Link to="/regulamin" onClick={(e) => e.stopPropagation()}>
                  {t("auth.signup.termsLink")}
                </Link>
                {" "}{t("common.and")}{" "}
                <Link to="/polityka-prywatnosci" onClick={(e) => e.stopPropagation()}>
                  {t("auth.signup.privacyLink")}
                </Link>
                {" "}{t("auth.signup.termsSuffix")}
              </span>
            </label>

            <button type="submit" className="al-btn-submit" disabled={loading}>
              {loading ? t("auth.signup.submitting") : t("auth.signup.submit")}
            </button>
          </form>

          <div className="al-divider" />

          <p className="al-signup">
            {t("auth.signup.hasAccount")}{" "}
            <Link to="/login" className="al-link">
              {t("auth.signup.loginLink")}
            </Link>
          </p>
        </div>
      </div>
    </AuthPageLayout>
  );
}
