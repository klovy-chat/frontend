// Signup.tsx
// Rejestracja i Captcha, potem setup profilu.
//
// Zakres:
//  - walidacja hasła/username po stronie klienta + serwer
//  - konto + Captcha, potem ProfileSetup
//
// Nie wyłączaj HIBP tylko na froncie — serwer i tak sprawdzi.
// Przy zmianach: api/auth.ts, leakedPassword.ts, controllers/auth.rs.

import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { getRegistrationStatus } from "../api/auth";
import {
  Captcha,
  type CaptchaHandle,
} from "../components/auth/Captcha";
import { AuthLayout } from "../components/auth/AuthLayout";
import {
  normalizeUsernameInput,
  sanitizeUsernameInput,
  validateUsernameInput,
} from "../utils/auth/username";
import { validatePasswordStrength } from "../utils/auth/password";
import { loadStoredLocale } from "../utils/locale/storage";
import "../styles/auth/auth.css";

// Zeroday: Ignorowanie capthy w srodowisku deweloperskim zeby ulatwic testowanie
import { isDevelopment } from "../utils/env/appEnv";
const TERMS_OF_USE_URL =
  "https://klovy.chat/docs/Terms-of-Use-Klovy-Chat.pdf";
const PRIVACY_POLICY_URL =
  "https://klovy.chat/docs/Privacy-Policy-Klovy-Chat.pdf";

interface FieldErrors {
  username?: string;
  password?: string;
  terms?: string;
}

function validateSync(
  username: string,
  password: string,
  terms: boolean,
  t: (key: string) => string,
): FieldErrors {
  const errors: FieldErrors = {};
  const name = username.trim().replace(/^@/, "");

  if (!name) {
    errors.username = t("auth.signup.validation.usernameRequired");
  } else if (name.length < 3 || !/^[a-zA-Z0-9_]+$/.test(name)) {
    errors.username = t("auth.signup.validation.usernameInvalid");
  }

  if (!password) {
    errors.password = t("auth.signup.validation.passwordRequired");
  } else if (password.length < 8) {
    errors.password = t("auth.signup.validation.passwordMinLength");
  }

  if (!terms) {
    errors.terms = t("auth.signup.validation.termsRequired");
  }

  return errors;
}

export function Signup() {
  const { t } = useTranslation();
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [registrationOpen, setRegistrationOpen] =
    useState<boolean | null>(null);
  const turnstileRef = useRef<CaptchaHandle>(null);
  useEffect(() => {
    getRegistrationStatus()
      .then((status) => setRegistrationOpen(status.open))
      .catch(() => setRegistrationOpen(true));
  }, []);

  const blurField = (field: keyof FieldErrors) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors(validateSync(username, password, accepted, t));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");

    const nextErrors = validateSync(username, password, accepted, t);
    setTouched({ username: true, password: true, terms: true });
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    if (registrationOpen === false) {
      setError(t("auth.signup.closed"));
      return;
    }
    // Zeroday: Captcha is required in production, but not in development.
    if (!isDevelopment && !turnstileToken) {
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
    if (password !== confirmPassword) {
      setError(t("validation.password.mismatch"));
      return;
    }
    const usernameError = validateUsernameInput(username);
    if (usernameError) {
      setError(usernameError);
      return;
    }
    setLoading(true);
    try {
    // Bez emaila, bo backend nie obsluguje emaila obecnie
      await signup(
        normalizeUsernameInput(username),
        password,
        turnstileToken,
        loadStoredLocale(),
      );
      setInfo(t("auth.signup.success"));
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setTurnstileToken("");
      turnstileRef.current?.reset();
      setError(
        err instanceof ApiError
          ? err.message
          : t("auth.errors.signupFailed"),
      );
    } finally {
      setLoading(false);
    }
  };
  const usernameAvailable =
    username.length >= 3 && !validateUsernameInput(username);
  const passwordStrength = (() => {
    let strength = 0;
    if (password.length > 0) strength++;
    if (password.length >= 8) strength++;
    if (
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password)
    ) {
      strength++;
    }
    if (
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    ) {
      strength++;
    }
    return strength;
  })();
  return (
    <AuthLayout promo="register">
      <div className="al-card">
        <div className="al-left">
          <form
            className="al-register-form"
            onSubmit={handleSubmit}
            noValidate
          >
            <header className="al-register-head">
              <h1 className="al-register-title">
                {t("auth.signup.title")}
              </h1>
              <p className="al-register-subtitle">
                {t("auth.signup.subtitle")}
              </p>
            </header>
            {registrationOpen === false && (
              <div className="al-error" role="alert">
                {t("auth.signup.closed")}
              </div>
            )}
            <div className="al-register-fields">
              <div className="al-register-field">
                <label htmlFor="sp-username">
                  {t("auth.fields.username")}
                </label>
                <div
                  className={`al-register-input${
                    touched.username && errors.username ? " al-register-input--error" : ""
                  }`}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <input
                    id="sp-username"
                    type="text"
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        sanitizeUsernameInput(e.target.value),
                      )
                    }
                    onBlur={() => blurField("username")}
                    placeholder={t("auth.signup.usernamePlaceholder")}
                    required
                    minLength={3}
                    maxLength={32}
                    pattern="[a-z0-9\_]+"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    inputMode="text"
                  />
                </div>
                {touched.username && errors.username ? (
                  <p className="al-register-field-error" role="alert">
                    {errors.username}
                  </p>
                ) : usernameAvailable ? (
                  <p className="al-register-username-ok">
                    ✓ {t("auth.signup.usernameAvailable")}
                  </p>
                ) : null}
              </div>
              <div className="al-register-password">
                <div className="al-register-field">
                  <label htmlFor="sp-password">
                    {t("auth.fields.password")}
                  </label>
                  <div
                    className={`al-register-input${
                      touched.password && errors.password ? " al-register-input--error" : ""
                    }`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect
                        x="3"
                        y="11"
                        width="18"
                        height="10"
                        rx="2"
                      />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      id="sp-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value)
                      }
                      onBlur={() => blurField("password")}
                      placeholder={t(
                        "auth.signup.passwordPlaceholder",
                      )}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="al-register-password-toggle"
                      onClick={() =>
                        setShowPassword((value) => !value)
                      }
                      aria-label={
                        showPassword
                          ? t("auth.fields.hidePassword")
                          : t("auth.fields.showPassword")
                      }
                    >
                      {showPassword ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line
                            x1="1"
                            y1="1"
                            x2="23"
                            y2="23"
                          />
                        </svg>
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {touched.password && errors.password && (
                    <p className="al-register-field-error" role="alert">
                      {errors.password}
                    </p>
                  )}
                </div>
                <div
                  className="al-register-meter"
                  aria-hidden="true"
                >
                  <span
                    className={
                      passwordStrength >= 1 ? "is-active" : ""
                    }
                  />
                  <span
                    className={
                      passwordStrength >= 2 ? "is-active" : ""
                    }
                  />
                  <span
                    className={
                      passwordStrength >= 3 ? "is-active" : ""
                    }
                  />
                  <span
                    className={
                      passwordStrength >= 4 ? "is-active" : ""
                    }
                  />
                </div>
                <p className="al-register-hint">
                  {t("auth.signup.passwordHint")}
                </p>
              </div>
              {/* Potwierdzenie hasła, na mockupie tego nie ma lecz jest to część obecnego systemu autoryzacji */}
              <div className="al-register-field">
                <label htmlFor="sp-confirm-password">
                  {t("auth.signup.confirmPassword")}
                </label>
                <div className="al-register-input">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect
                      x="3"
                      y="11"
                      width="18"
                      height="10"
                      rx="2"
                    />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <input
                    id="sp-confirm-password"
                    type={
                      showConfirmPassword ? "text" : "password"
                    }
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    placeholder={t(
                      "auth.signup.confirmPasswordPlaceholder",
                    )}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="al-register-password-toggle"
                    onClick={() =>
                      setShowConfirmPassword((value) => !value)
                    }
                    aria-label={
                      showConfirmPassword
                        ? t("auth.fields.hidePassword")
                        : t("auth.fields.showPassword")
                    }
                  >
                    {showConfirmPassword ? (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line
                          x1="1"
                          y1="1"
                          x2="23"
                          y2="23"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <Captcha
              ref={turnstileRef}
              onToken={setTurnstileToken}
              onExpire={() => setTurnstileToken("")}
              onError={() => setTurnstileToken("")}
            />
            {error && (
              <div className="al-error" role="alert">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line
                    x1="12"
                    y1="16"
                    x2="12.01"
                    y2="16"
                  />
                </svg>
                {error}
              </div>
            )}
            {info && (
              <div className="al-success" role="status">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {info}
              </div>
            )}
            <label className="al-register-checkbox">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setAccepted(checked);
                  if (touched.terms) {
                    setErrors(validateSync(username, password, checked, t));
                  }
                }}
              />
              <span className="al-register-checkbox-box">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              <span className="al-register-checkbox-text">
                {t("auth.signup.termsPrefix")}{" "}
                <a
                  href={TERMS_OF_USE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t("auth.signup.termsLink")}
                </a>{" "}
                {t("common.and")}{" "}
                <a
                  href={PRIVACY_POLICY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t("auth.signup.privacyLink")}
                </a>{" "}
                {t("auth.signup.termsSuffix")}
              </span>
            </label>
            {touched.terms && errors.terms && (
              <p className="al-register-field-error" role="alert">
                {errors.terms}
              </p>
            )}
            <button
              type="submit"
              className="al-register-submit"
              disabled={
                loading || registrationOpen === false
              }
            >
              {loading
                ? t("auth.signup.submitting")
                : t("auth.signup.submit")}
            </button>
            <p className="al-register-footer">
              {t("auth.signup.hasAccount")}{" "}
              <Link to="/login">
                {t("auth.signup.loginLink")}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </AuthLayout>
  );
}
