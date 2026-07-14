import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { normalizeAuthError } from "../utils/auth/authErrors";
import { TurnstileWidget } from "../components/auth/TurnstileWidget";
import { AuthPageLayout } from "../components/auth/AuthPageLayout";
import { normalizeUsernameInput, sanitizeUsernameInput } from "../utils/auth/username";
import "../styles/auth/auth.css";

export function LoginPage() {
  const { t } = useTranslation();
  const { login, completeTwoFactorLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorTurnstileToken, setTwoFactorTurnstileToken] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!turnstileToken) {
      setError(t("validation.captcha.login"));
      return;
    }
    setLoading(true);
    try {
      const result = await login(normalizeUsernameInput(username), password, turnstileToken);
      if (result.requiresTwoFactor) {
        if (!result.twoFactorToken) {
          setError(t("auth.errors.twoFactorStartFailed"));
          return;
        }
        setTwoFactorToken(result.twoFactorToken);
        setTwoFactorCode("");
        setTwoFactorTurnstileToken("");
        setUseBackupCode(false);
        setStep("2fa");
        return;
      }
      navigate("/");
    } catch (err) {
      setError(
        normalizeAuthError(
          err instanceof ApiError ? err.message : t("auth.errors.loginFailed"),
          "login",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const code = twoFactorCode.trim();
    if (!code) {
      setError(
        useBackupCode
          ? t("validation.twoFactor.backupRequired")
          : t("validation.twoFactor.appCodeRequired"),
      );
      return;
    }
    if (!twoFactorTurnstileToken) {
      setError(t("validation.captcha.twoFactor"));
      return;
    }
    setLoading(true);
    try {
      await completeTwoFactorLogin(twoFactorToken, code, twoFactorTurnstileToken);
      navigate("/");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t("validation.twoFactor.invalidCode"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setStep("credentials");
    setTwoFactorToken("");
    setTwoFactorCode("");
    setTwoFactorTurnstileToken("");
    setUseBackupCode(false);
    setError("");
  };

  return (
    <AuthPageLayout>
      <div className="al-card al-card--solo">
        <div className="al-left">
          {step === "credentials" ? (
            <>
              <h1 className="al-title">{t("auth.login.title")}</h1>

              <form className="al-form" onSubmit={handleSubmit} noValidate>
                <div className="al-field">
                  <label htmlFor="al-username">{t("auth.fields.username")}</label>
                  <input
                    id="al-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(sanitizeUsernameInput(e.target.value))}
                    placeholder={t("auth.fields.usernamePlaceholder")}
                    required
                    minLength={3}
                    maxLength={32}
                    pattern="[a-z0-9_]+"
                    autoComplete="username"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    inputMode="text"
                  />
                  <p className="al-field-hint">{t("auth.fields.usernameHint")}</p>
                </div>

                <div className="al-field">
                  <label htmlFor="al-password">{t("auth.fields.password")}</label>
                  <div className="al-input-wrap">
                    <input
                      id="al-password"
                      className="al-input--pass"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      autoComplete="current-password"
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

                <button type="submit" className="al-btn-submit" disabled={loading}>
                  {loading ? t("auth.login.submitting") : t("auth.login.submit")}
                </button>
              </form>

              <div className="al-divider" />

              <p className="al-signup">
                {t("auth.login.noAccount")}{" "}
                <Link to="/signup" className="al-link">
                  {t("auth.login.signupLink")}
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="al-title">{t("auth.twoFactor.title")}</h1>
              <p className="al-2fa-hint">
                {t("auth.twoFactor.hint", {
                  username: normalizeUsernameInput(username),
                })}
              </p>

              <form className="al-form" onSubmit={handleTwoFactorSubmit} noValidate>
                <div className="al-field">
                  <label htmlFor="al-2fa-code">
                    {useBackupCode
                      ? t("auth.fields.backupCode")
                      : t("auth.fields.authCode")}
                  </label>
                  <input
                    id="al-2fa-code"
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    placeholder={useBackupCode ? "XXXX-XXXX" : "123456"}
                    autoComplete="one-time-code"
                    inputMode={useBackupCode ? "text" : "numeric"}
                    autoFocus
                  />
                </div>

                <button
                  type="button"
                  className="al-link al-2fa-toggle"
                  onClick={() => {
                    setUseBackupCode((v) => !v);
                    setTwoFactorCode("");
                    setError("");
                  }}
                >
                  {useBackupCode
                    ? t("auth.twoFactor.useAppCode")
                    : t("auth.twoFactor.useBackupCode")}
                </button>

                <TurnstileWidget
                  onToken={setTwoFactorTurnstileToken}
                  onExpire={() => setTwoFactorTurnstileToken("")}
                />

                {error && (
                  <div className="al-error" role="alert">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {error}
                  </div>
                )}

                <button type="submit" className="al-btn-submit" disabled={loading}>
                  {loading
                    ? t("auth.twoFactor.submitting")
                    : t("auth.twoFactor.submit")}
                </button>

                <button
                  type="button"
                  className="al-btn-secondary"
                  onClick={handleBackToCredentials}
                  disabled={loading}
                >
                  {t("auth.twoFactor.backToLogin")}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </AuthPageLayout>
  );
}
