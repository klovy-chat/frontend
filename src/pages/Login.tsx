import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, User, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { getRegistrationStatus } from "../api/auth";
import { normalizeAuthError } from "../utils/auth/errors";
import { Captcha, type CaptchaHandle } from "../components/auth/Captcha";
import { AuthLayout } from "../components/auth/AuthLayout";
import { normalizeUsernameInput, sanitizeUsernameInput } from "../utils/auth/username";
import { isDevelopment } from "../utils/env/appEnv";
import "../styles/auth/auth.css";

interface FieldErrors {
  identity?: string;
  password?: string;
}

function validate(
  identity: string,
  password: string,
  t: (key: string) => string,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!identity.trim()) {
    errors.identity = t("auth.login.validation.identityRequired");
  }
  if (!password) {
    errors.password = t("auth.login.validation.passwordRequired");
  } else if (password.length < 8) {
    errors.password = t("auth.login.validation.passwordMinLength");
  }
  return errors;
}

export function Login() {
  const { t } = useTranslation();
  const { login, completeTwoFactorLogin } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<"credentials" | "2fa">("credentials");
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorTurnstileToken, setTwoFactorTurnstileToken] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const turnstileRef = useRef<CaptchaHandle>(null);
  const twoFactorTurnstileRef = useRef<CaptchaHandle>(null);
  useEffect(() => {
    getRegistrationStatus()
      .then((status) => setRegistrationOpen(status.open))
      .catch(() => setRegistrationOpen(true));
  }, []);
  const blurField = (field: keyof FieldErrors) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors(validate(username, password, t));
  };
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const nextErrors = validate(username, password, t);
    setTouched({ identity: true, password: true });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!isDevelopment && !turnstileToken) {
      setError(t("validation.captcha.login"));
      return;
    }
    setLoading(true);
    try {
      const result = await login(
        normalizeUsernameInput(username),
        password,
        turnstileToken,
      );
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
      setTurnstileToken("");
      turnstileRef.current?.reset();
      setError(
        normalizeAuthError(
          err instanceof ApiError
            ? err.message
            : t("auth.errors.loginFailed"),
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
      await completeTwoFactorLogin(
        twoFactorToken,
        code,
        twoFactorTurnstileToken,
      );
      navigate("/");
    } catch (err) {
      setTwoFactorTurnstileToken("");
      twoFactorTurnstileRef.current?.reset();
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
    <AuthLayout promo="login">
      <div className="al-card">
        <div className="al-left">
          {step === "credentials" ? (
            <form className="al-login-form" onSubmit={handleSubmit} noValidate>
              <header className="al-login-head">
                <h1 className="al-login-title">{t("auth.login.title")}</h1>
                <p className="al-login-subtitle">
                  {t("auth.login.subtitle")}
                </p>
              </header>
              <div className="al-login-fields">
                <div className="al-login-field">
                  <label htmlFor="al-username">
                    {t("auth.login.identity")}
                  </label>
                  <div className={`al-login-input${touched.identity && errors.identity ? " al-login-input--error" : ""}`}>
                    <User size={16} strokeWidth={1.75} />
                    <input
                      id="al-username"
                      type="text"
                      value={username}
                      onChange={(e) =>
                        setUsername(sanitizeUsernameInput(e.target.value))
                      }
                      onBlur={() => blurField("identity")}
                      placeholder={t("auth.login.identityPlaceholder")}
                      required
                      minLength={3}
                      maxLength={32}
                      autoComplete="username"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </div>
                  {touched.identity && errors.identity && (
                    <p className="al-login-field-error" role="alert">{errors.identity}</p>
                  )}
                </div>
                <div className="al-login-field">
                  <label htmlFor="al-password">{t("auth.fields.password")}</label>
                  <div className={`al-login-input${touched.password && errors.password ? " al-login-input--error" : ""}`}>
                    <Lock size={16} strokeWidth={1.75} />
                    <input
                      id="al-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => blurField("password")}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="al-login-password-toggle"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={
                        showPassword
                          ? t("auth.fields.hidePassword")
                          : t("auth.fields.showPassword")
                      }
                    >
                      {showPassword ? (
                        <EyeOff size={16} strokeWidth={1.75} />
                      ) : (
                        <Eye size={16} strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                  {touched.password && errors.password && (
                    <p className="al-login-field-error" role="alert">{errors.password}</p>
                  )}
                </div>
              </div>
              <div className="al-login-options">
                <label className="al-login-remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span className="al-login-checkbox-box">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span>{t("auth.login.rememberMe")}</span>
                </label>
                <button type="button" className="al-login-forgot">
                  {t("auth.login.forgotPassword")}
                </button>
              </div>
              <Captcha
                ref={turnstileRef}
                onToken={setTurnstileToken}
                onExpire={() => setTurnstileToken("")}
                onError={() => setTurnstileToken("")}
              />
              {error && (
                <div className="al-error" role="alert">
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="al-login-submit"
                disabled={loading}
              >
                {loading
                  ? t("auth.login.submitting")
                  : t("auth.login.secureSubmit")}
              </button>
              {registrationOpen && (
                <p className="al-login-footer">
                  {t("auth.login.noAccount")}{" "}
                  <Link to="/signup" className="al-link">
                    {t("auth.login.signupLink")}
                  </Link>
                </p>
              )}
            </form>
          ) : (
            <>
              <h1 className="al-title">{t("auth.twoFactor.title")}</h1>
              <p className="al-2fa-hint">
                {t("auth.twoFactor.hint", {
                  username: normalizeUsernameInput(username),
                })}
              </p>
              <form
                className="al-form"
                onSubmit={handleTwoFactorSubmit}
                noValidate
              >
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
                    setUseBackupCode((value) => !value);
                    setTwoFactorCode("");
                    setError("");
                  }}
                >
                  {useBackupCode
                    ? t("auth.twoFactor.useAppCode")
                    : t("auth.twoFactor.useBackupCode")}
                </button>
                <Captcha
                  ref={twoFactorTurnstileRef}
                  onToken={setTwoFactorTurnstileToken}
                  onExpire={() => setTwoFactorTurnstileToken("")}
                  onError={() => setTwoFactorTurnstileToken("")}
                />
                {error && (
                  <div className="al-error" role="alert">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  className="al-btn-submit"
                  disabled={loading}
                >
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
    </AuthLayout>
  );
}
