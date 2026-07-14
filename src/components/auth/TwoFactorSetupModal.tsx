import { FormEvent, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { enableTwoFactor, setupTwoFactor } from "../../api/auth";
import { ApiError } from "../../api/client";
import { isSafeOtpauthUrl } from "../../utils/media/mediaAllowlist";
import "../../styles/auth/twofactor.css";

type Step = "intro" | "scan" | "backup";

interface TwoFactorSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnabled: () => void;
}

function formatSecretForDisplay(secret: string): string {
  const clean = secret.replace(/\s+/g, "").toUpperCase();
  return clean.match(/.{1,4}/g)?.join(" ") ?? clean;
}

export function TwoFactorSetupModal({
  isOpen,
  onClose,
  onEnabled,
}: TwoFactorSetupModalProps) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);
  const [step, setStep] = useState<Step>("intro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [enablePassword, setEnablePassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setClosing(false);
      setStep("intro");
      setLoading(false);
      setError("");
      setSecret("");
      setOtpauthUrl("");
      setConfirmCode("");
      setSetupPassword("");
      setEnablePassword("");
      setBackupCodes([]);
      setCopied(false);
    }
  }, [isOpen]);

  const handleFinish = () => {
    onEnabled();
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 220);
  };

  const requestClose = () => {
    if (closing) return;
    if (step === "backup") {
      handleFinish();
      return;
    }
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 220);
  };

  useEffect(() => {
    if (!isOpen && !closing) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step !== "backup") requestClose();
      if (e.key === "Escape" && step === "backup") handleFinish();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [isOpen, closing, step]);

  if (!isOpen && !closing) return null;

  const handleStartSetup = async () => {
    setLoading(true);
    setError("");
    if (!setupPassword) {
      setError(t("validation.twoFactor.passwordRequired"));
      setLoading(false);
      return;
    }
    try {
      const data = await setupTwoFactor(setupPassword);
      setSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
      setStep("scan");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t("auth.twoFactorSetup.startFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!confirmCode.trim()) {
      setError(t("validation.twoFactor.setupCodeRequired"));
      return;
    }
    if (!enablePassword) {
      setError(t("validation.twoFactor.enablePasswordRequired"));
      return;
    }
    setLoading(true);
    try {
      const result = await enableTwoFactor(enablePassword, confirmCode.trim());
      setBackupCodes(result.backupCodes);
      setStep("backup");
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

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret.replace(/\s+/g, "").toUpperCase());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("auth.twoFactorSetup.copyFailed"));
    }
  };

  const displaySecret = formatSecretForDisplay(secret);

  return (
    <div
      className={`klovy-backdrop tf-overlay${closing ? " closing" : ""}`}
      onClick={step === "backup" ? undefined : requestClose}
    >
      <div
        className={`klovy-shell tf-modal${step === "scan" ? " tf-modal--scan" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="tf-close"
          onClick={step === "backup" ? handleFinish : requestClose}
          aria-label={t("common.close")}
        >
          ×
        </button>

        {step === "intro" && (
          <>
            <h2 className="tf-title">{t("auth.twoFactorSetup.title")}</h2>
            <p className="tf-text">{t("auth.twoFactorSetup.intro")}</p>
            <div className="tf-field">
              <label htmlFor="tf-setup-password">{t("auth.fields.password")}</label>
              <input
                id="tf-setup-password"
                type="password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && <p className="tf-error">{error}</p>}
            <div className="tf-actions">
              <button type="button" className="tf-btn tf-btn--ghost" onClick={requestClose}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="tf-btn tf-btn--primary"
                onClick={handleStartSetup}
                disabled={loading}
              >
                {loading ? t("auth.twoFactorSetup.preparing") : t("common.continue")}
              </button>
            </div>
          </>
        )}

        {step === "scan" && (
          <div className="tf-modal-scroll tf-modal-scroll--scan">
            <h2 className="tf-title">{t("auth.twoFactorSetup.scanTitle")}</h2>
            <p className="tf-text">{t("auth.twoFactorSetup.scanBody")}</p>

            {otpauthUrl && (
              <div className="tf-qr-wrap">
                <QRCodeSVG
                  value={otpauthUrl}
                  size={240}
                  level="H"
                  marginSize={2}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
            )}

            {otpauthUrl && isSafeOtpauthUrl(otpauthUrl) && (
              <a className="tf-open-app" href={otpauthUrl}>
                {t("auth.twoFactorSetup.openApp")}
              </a>
            )}

            <div className="tf-secret">
              <span className="tf-secret-label">{t("auth.twoFactorSetup.manualSecret")}</span>
              <code>{displaySecret}</code>
              <button type="button" className="tf-copy-btn" onClick={handleCopySecret}>
                {copied ? t("common.copied") : t("auth.twoFactorSetup.copySecret")}
              </button>
            </div>

            <form onSubmit={handleEnable}>
              <div className="tf-field">
                <label htmlFor="tf-enable-password">{t("auth.fields.password")}</label>
                <input
                  id="tf-enable-password"
                  type="password"
                  value={enablePassword}
                  onChange={(e) => setEnablePassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="tf-field">
                <label htmlFor="tf-confirm-code">{t("auth.twoFactorSetup.confirmCode")}</label>
                <input
                  id="tf-confirm-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                />
              </div>

              {error && <p className="tf-error">{error}</p>}

              <div className="tf-actions">
                <button type="button" className="tf-btn tf-btn--ghost" onClick={requestClose}>
                  {t("common.cancel")}
                </button>
                <button type="submit" className="tf-btn tf-btn--primary" disabled={loading}>
                  {loading
                    ? t("auth.twoFactorSetup.verifying")
                    : t("auth.twoFactorSetup.enable")}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "backup" && (
          <>
            <h2 className="tf-title">{t("auth.twoFactorSetup.backupTitle")}</h2>
            <p className="tf-text tf-text--warn">{t("auth.twoFactorSetup.backupBody")}</p>

            <ul className="tf-backup-list">
              {backupCodes.map((code) => (
                <li key={code}><code>{code}</code></li>
              ))}
            </ul>

            <div className="tf-actions">
              <button type="button" className="tf-btn tf-btn--primary" onClick={handleFinish}>
                {t("auth.twoFactorSetup.backupDone")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
