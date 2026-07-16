import { CSSProperties, FormEvent, useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  acknowledgeMyWarnings,
  addProfileBanner,
  addProfileImage,
  changePassword,
  changeUsername,
  disableAccount,
  disableTwoFactor,
  getMyWarnings,
  getSessions,
  removeProfileBanner,
  removeProfileImage,
  requestAccountDeletion,
  cancelAccountDeletion,
  revokeOtherSessions,
  revokeSession,
  updateProfile,
  type OwnWarning,
  type UserSessionRow,
} from "../api/auth";
import { ApiError } from "../api/client";
import { ImageCropModal } from "../components/common/ImageCropModal";
import {
  MAX_AVATAR_SIZE_BYTES,
  MAX_AVATAR_SIZE_LABEL,
} from "../constants/upload";
import { TwoFactorSetupModal } from "../components/auth/TwoFactorSetupModal";
import { BotsPanel } from "../components/bots/BotsPanel";
import { IntegrationsPanel } from "../components/integrations/IntegrationsPanel";
import { VoiceSettingsPanel } from "../components/account/VoiceSettingsPanel";
import { LanguageSettingsPanel } from "../components/account/LanguageSettingsPanel";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import { useToast } from "../context/ToastContext";
import {
  ProfileFormFields,
  profileValuesFromUser,
  type ProfileFormValues,
} from "../components/profile/ProfileFormFields";
import {
  avatarColor,
  getDefaultAvatarImage,
  profileImageUrl,
  resolveAvatarColorIndex,
} from "../utils/media/avatar";
import {
  bumpPublicMediaCache,
  bumpPublicMediaCacheForUser,
} from "../utils/media/cdnCacheVersion";
import {
  usePublicMediaCacheRevision,
  useProfileBannerStyle,
} from "../hooks/usePublicMediaCacheRevision";
import { userLabel, WARNING_SEVERITY_LABELS } from "../utils/user/format";
import { validatePasswordStrength } from "../utils/auth/password";
import {
  checkPasswordBreach,
  isPasswordBreachError,
  PASSWORD_BREACH_MESSAGE,
} from "../utils/auth/pwnedPassword";
import { normalizeUsernameInput, validateUsernameInput } from "../utils/auth/username";
import {
  formatSessionRelativeTime,
} from "../utils/user/sessionDisplay";
import { BrowserSessionIcon } from "../components/account/BrowserSessionIcon";
import "../styles/account/account.css";
import "../styles/account/profile.css";

interface AccountSettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  inline?: boolean;
  initialSection?: SectionInput;
  onSectionChange?: () => void;
  spotifyOauthError?: string | null;
  spotifyOauthConnected?: boolean;
}

export type Section = "profil" | "konto" | "sesje" | "glos" | "jezyk" | "boty" | "integracje" | "ostrzezenia";

type SectionInput = Section | "sesja";

function normalizeSection(section?: SectionInput): Section {
  if (section === "sesja") return "konto";
  return section ?? "profil";
}

export function AccountSettingsModal({
  isOpen = false,
  onClose,
  inline = false,
  initialSection,
  onSectionChange,
  spotifyOauthError = null,
  spotifyOauthConnected = false,
}: AccountSettingsModalProps) {
  const { t } = useTranslation();
  const { dateLocale } = useLocale();
  const { user, updateUser, logout, refreshUser } = useAuth();
  const toast = useToast();
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const [section, setSection] = useState<Section>("profil");

  const [profileValues, setProfileValues] = useState<ProfileFormValues>(() =>
    profileValuesFromUser(user),
  );
  const [avatarPreview, setAvatarPreview] = useState(user?.image ?? null);
  const [bannerPreview, setBannerPreview] = useState(user?.banner ?? null);
  const [bannerLoading, setBannerLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [usernameValue, setUsernameValue] = useState(user?.username ?? "");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [usernameCode, setUsernameCode] = useState("");
  const [usernameBusy, setUsernameBusy] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [cropTarget, setCropTarget] = useState<{
    file: File;
    kind: "avatar" | "banner";
  } | null>(null);
  const [closing, setClosing] = useState(false);
  const [twoFactorSetupOpen, setTwoFactorSetupOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordCode, setChangePasswordCode] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [warnings, setWarnings] = useState<OwnWarning[]>([]);
  const [warningsLoading, setWarningsLoading] = useState(false);
  const [accountAction, setAccountAction] = useState<"disable" | "delete" | null>(null);
  const [accountPassword, setAccountPassword] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [sessions, setSessions] = useState<UserSessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [sessionActionId, setSessionActionId] = useState<string | null>(null);
  const [revokeOthersBusy, setRevokeOthersBusy] = useState(false);

  const formatWarningDate = useCallback(
    (value: string | null): string => {
      if (!value) return t("common.emDash");
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? t("common.emDash") : d.toLocaleString(dateLocale);
    },
    [dateLocale, t],
  );

  const twoFactorSuffix = user?.twoFactorEnabled
    ? t("settings.account.confirmPasswordHintTwoFactor")
    : "";

  const requestClose = () => {
    if (closing) return;
    if (inline) {
      onClose?.();
      return;
    }
    setClosing(true);
    document.body.style.overflow = "";
    window.setTimeout(() => onClose?.(), 220);
  };

  const visible = inline || isOpen;

  useEffect(() => {
    if (!visible) return;
    setSection(normalizeSection(initialSection));
  }, [visible, initialSection]);

  useEffect(() => {
    if (!visible) return;
    setClosing(false);
    setProfileValues(profileValuesFromUser(user));
    setAvatarPreview(user?.image ?? null);
    setBannerPreview(user?.banner ?? null);
    setError("");
    setUsernameValue(user?.username ?? "");
    setUsernamePassword("");
    setUsernameCode("");
    setUsernameError("");
    setSecurityError("");
    setDisablePassword("");
    setDisableCode("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setChangePasswordCode("");
    setPasswordError("");
  }, [visible]);

  useEffect(() => {
    if (!visible || inline) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [visible, closing, inline]);

  useEffect(() => {
    if (inline) return;
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen, inline]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setWarningsLoading(true);
    getMyWarnings()
      .then((res) => {
        if (!cancelled) setWarnings(res.warnings);
      })
      .catch(() => {
        if (!cancelled) setWarnings([]);
      })
      .finally(() => {
        if (!cancelled) setWarningsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const loadSessions = async () => {
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const res = await getSessions();
      setSessions(res.sessions);
    } catch (err) {
      setSessions([]);
      setSessionsError(
        err instanceof ApiError ? err.message : t("settings.account.sessionsLoadFailed"),
      );
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (!visible || section !== "sesje") return;
    void loadSessions();
  }, [visible, section]);

  // Wejście w zakładkę „Ostrzeżenia" traktujemy jako odczytanie — potwierdzamy
  // wszystkie nieprzeczytane, aby licznik i status były aktualne.
  useEffect(() => {
    if (!visible || section !== "ostrzezenia" || warningsLoading) return;
    if (!warnings.some((w) => !w.acknowledged)) return;

    let cancelled = false;
    acknowledgeMyWarnings()
      .then(() => {
        if (cancelled) return;
        const now = new Date().toISOString();
        setWarnings((prev) =>
          prev.map((w) =>
            w.acknowledged ? w : { ...w, acknowledged: true, acknowledgedAt: now },
          ),
        );
      })
      .catch(() => {
        /* cicho — spróbujemy ponownie przy następnym otwarciu */
      });
    return () => {
      cancelled = true;
    };
  }, [visible, section, warnings, warningsLoading]);

  const activeColorIndex = profileValues.color ?? user?.color ?? null;
  const cacheRevision = usePublicMediaCacheRevision();
  const avatarSrc = useMemo(
    () => profileImageUrl(avatarPreview),
    [avatarPreview, cacheRevision],
  );
  const bannerStyle = useProfileBannerStyle(
    bannerPreview,
    activeColorIndex,
    user?.username ?? "",
  );

  if (!visible && !closing) return null;

  const msg = (type: "error" | "success", text: string) => {
    if (type === "error") setError(text);
    else {
      setError("");
      toast.success(text);
    }
  };

  const accentColor = avatarColor(activeColorIndex, user?.username ?? "");
  const accentStyle = { "--as-accent": accentColor } as CSSProperties;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); msg("error", "");
    try {
      if (!profileValues.displayName.trim()) {
        msg("error", t("validation.displayName.required"));
        setSaving(false);
        return;
      }
      const updated = await updateProfile({
        displayName: profileValues.displayName.trim(),
        bio: profileValues.bio.trim() || undefined,
        color: profileValues.color,
      });
      updateUser(updated);
      msg("success", t("settings.profile.saved"));
    } catch (err) {
      msg("error", err instanceof ApiError ? err.message : t("settings.profile.saveFailed"));
    } finally { setSaving(false); }
  };

  const handleChangeUsername = async (e: FormEvent) => {
    e.preventDefault();
    setUsernameError("");

    const normalized = normalizeUsernameInput(usernameValue);
    const validation = validateUsernameInput(usernameValue);
    if (validation) {
      setUsernameError(validation);
      return;
    }
    if (normalized === user?.username) {
      setUsernameError(t("auth.username.sameAsCurrent"));
      return;
    }
    if (!usernamePassword) {
      setUsernameError(t("settings.accountExtra.usernamePasswordRequired"));
      return;
    }
    if (user?.twoFactorEnabled && !usernameCode.trim()) {
      setUsernameError(t("validation.twoFactor.codeRequired"));
      return;
    }

    setUsernameBusy(true);
    try {
      const updated = await changeUsername(
        normalized,
        usernamePassword,
        user?.twoFactorEnabled ? usernameCode.trim() : undefined,
      );
      updateUser(updated);
      setUsernameValue(updated.username);
      setUsernamePassword("");
      setUsernameCode("");
      toast.success(t("settings.account.usernameChanged"));
    } catch (err) {
      setUsernameError(
        err instanceof ApiError
          ? err.message
          : t("settings.account.usernameChangeFailed"),
      );
    } finally {
      setUsernameBusy(false);
    }
  };

  const pickImageForCrop = (file: File, kind: "avatar" | "banner") => {
    msg("error", "");
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      msg(
        "error",
        t("upload.avatarTooLarge", { limit: MAX_AVATAR_SIZE_LABEL }),
      );
      return;
    }
    setCropTarget({ file, kind });
  };

  const handleAvatarChange = (file: File) => pickImageForCrop(file, "avatar");
  const handleBannerChange = (file: File) => pickImageForCrop(file, "banner");

  const uploadAvatarFile = async (file: File) => {
    setAvatarLoading(true); msg("error", "");
    try {
      const { image } = await addProfileImage(file);
      bumpPublicMediaCache(image);
      setAvatarPreview(image);
      if (user) updateUser({ ...user, image });
      msg("success", t("settings.profile.avatarUpdated"));
    } catch (err) {
      msg("error", err instanceof ApiError ? err.message : t("settings.profile.avatarUploadFailed"));
      throw err;
    } finally { setAvatarLoading(false); }
  };

  const handleRemoveAvatar = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAvatarLoading(true); msg("error", "");
    try {
      await removeProfileImage();
      if (user) bumpPublicMediaCacheForUser(user.id, "avatar");
      setAvatarPreview(null);
      if (user) updateUser({ ...user, image: null });
      msg("success", t("settings.profile.avatarRemoved"));
    } catch (err) {
      msg("error", err instanceof ApiError ? err.message : t("settings.profile.avatarRemoveFailed"));
    } finally { setAvatarLoading(false); }
  };

  const uploadBannerFile = async (file: File) => {
    setBannerLoading(true); msg("error", "");
    try {
      const { banner } = await addProfileBanner(file);
      bumpPublicMediaCache(banner);
      setBannerPreview(banner);
      if (user) updateUser({ ...user, banner });
      msg("success", t("settings.accountExtra.bannerUpdated"));
    } catch (err) {
      msg("error", err instanceof ApiError ? err.message : t("settings.profile.bannerUploadFailed"));
      throw err;
    } finally { setBannerLoading(false); }
  };

  const handleCropConfirm = async (file: File) => {
    if (!cropTarget) return;
    const kind = cropTarget.kind;
    try {
      if (kind === "avatar") {
        await uploadAvatarFile(file);
      } else {
        await uploadBannerFile(file);
      }
      setCropTarget(null);
    } catch {
      /* error already surfaced via msg(); keep crop modal open for retry */
    }
  };

  const handleRemoveBanner = async () => {
    setBannerLoading(true); msg("error", "");
    try {
      await removeProfileBanner();
      if (user) bumpPublicMediaCacheForUser(user.id, "banner");
      setBannerPreview(null);
      if (user) updateUser({ ...user, banner: null });
      msg("success", t("settings.profile.bannerRemoved"));
    } catch (err) {
      msg("error", err instanceof ApiError ? err.message : t("settings.profile.bannerRemoveFailed"));
    } finally { setBannerLoading(false); }
  };

  const handleLogout = async () => { await logout(); requestClose(); };

  const handleRevokeSession = async (session: UserSessionRow) => {
    setSessionActionId(session.id);
    setSessionsError("");
    try {
      const res = await revokeSession(session.id);
      if (session.isCurrent || res.currentSessionRevoked) {
        await logout();
        requestClose();
        return;
      }
      await loadSessions();
    } catch (err) {
      setSessionsError(
        err instanceof ApiError ? err.message : t("settings.account.sessionRevokeFailed"),
      );
    } finally {
      setSessionActionId(null);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setRevokeOthersBusy(true);
    setSessionsError("");
    try {
      await revokeOtherSessions();
      await loadSessions();
    } catch (err) {
      setSessionsError(
        err instanceof ApiError ? err.message : t("settings.account.revokeOthersFailed"),
      );
    } finally {
      setRevokeOthersBusy(false);
    }
  };

  const resetAccountAction = () => {
    setAccountAction(null);
    setAccountPassword("");
    setAccountCode("");
    setAccountError("");
  };

  const handleCancelDeletion = async () => {
    setAccountError("");
    if (!accountPassword) {
      setAccountError(t("settings.account.cancelDeletionPassword"));
      return;
    }
    if (user?.twoFactorEnabled && !accountCode.trim()) {
      setAccountError(t("validation.twoFactor.codeRequired"));
      return;
    }
    setAccountBusy(true);
    try {
      const res = await cancelAccountDeletion(
        accountPassword,
        accountCode.trim() || undefined,
      );
      resetAccountAction();
      toast.success(res.message);
      await refreshUser();
    } catch (err) {
      setAccountError(
        err instanceof ApiError ? err.message : t("settings.account.cancelDeletionFailed"),
      );
    } finally {
      setAccountBusy(false);
    }
  };

  const handleAccountAction = async (e: FormEvent) => {
    e.preventDefault();
    setAccountError("");

    if (!accountPassword) {
      setAccountError(t("validation.password.required"));
      return;
    }
    if (user?.twoFactorEnabled && !accountCode.trim()) {
      setAccountError(t("validation.twoFactor.codeRequired"));
      return;
    }

    setAccountBusy(true);
    try {
      if (accountAction === "disable") {
        await disableAccount(accountPassword, accountCode.trim() || undefined);
        resetAccountAction();
        await logout();
        requestClose();
      } else if (accountAction === "delete") {
        const res = await requestAccountDeletion(
          accountPassword,
          accountCode.trim() || undefined,
        );
        resetAccountAction();
        toast.success(res.message);
        await refreshUser();
      }
    } catch (err) {
      setAccountError(
        err instanceof ApiError ? err.message : t("settings.account.operationFailed"),
      );
    } finally {
      setAccountBusy(false);
    }
  };

  const handleTwoFactorEnabled = () => {
    if (user) updateUser({ ...user, twoFactorEnabled: true });
    toast.success(t("auth.twoFactorSetup.enabled"));
    setSecurityError("");
  };

  const handleDisableTwoFactor = async (e: FormEvent) => {
    e.preventDefault();
    setSecurityError("");
    if (!disablePassword || !disableCode.trim()) {
      setSecurityError(t("validation.twoFactor.passwordAndCode"));
      return;
    }
    setTwoFactorBusy(true);
    try {
      await disableTwoFactor(disablePassword, disableCode.trim());
      if (user) updateUser({ ...user, twoFactorEnabled: false });
      setDisablePassword("");
      setDisableCode("");
      toast.success(t("auth.twoFactorSetup.disabled"));
    } catch (err) {
      setSecurityError(err instanceof ApiError ? err.message : t("auth.twoFactorSetup.disableFailed"));
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!currentPassword) {
      setPasswordError(t("validation.password.currentRequired"));
      return;
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      setPasswordError(strengthError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("validation.password.mismatch"));
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(t("validation.password.sameAsCurrent"));
      return;
    }

    if (user?.twoFactorEnabled && !changePasswordCode.trim()) {
      setPasswordError(t("validation.twoFactor.codeRequired"));
      return;
    }

    setPasswordBusy(true);
    try {
      const breachCheck = await checkPasswordBreach(newPassword);
      if (breachCheck === "breached") {
        setPasswordError(PASSWORD_BREACH_MESSAGE);
        return;
      }

      const { user: updated } = await changePassword(
        currentPassword,
        newPassword,
        user?.twoFactorEnabled ? changePasswordCode.trim() : undefined,
      );
      updateUser(updated);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangePasswordCode("");
      toast.success(t("settings.account.passwordChanged"));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t("settings.account.passwordChangeFailed");
      setPasswordError(
        isPasswordBreachError(message) ? PASSWORD_BREACH_MESSAGE : message,
      );
    } finally {
      setPasswordBusy(false);
    }
  };


  const defaultAvatarSrc = getDefaultAvatarImage(resolveAvatarColorIndex(activeColorIndex));
  const navName = userLabel(user);
  const warningCount = warnings.length;
  const unacknowledgedCount = warnings.filter((w) => !w.acknowledged).length;

  const renderAvatarContent = (size: "sm" | "lg") => (
    <>
      <img src={avatarSrc || defaultAvatarSrc} alt={t("common.avatar")} />
      {(avatarLoading && size === "lg") && (
        <div className="as-avatar-overlay"><div className="as-spinner" /></div>
      )}
      {size === "lg" && !avatarLoading && (
        <div className="as-avatar-hover" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
      )}
    </>
  );

  const navPanel = (
    <aside className={`as-nav${inline ? " as-nav--inline" : ""}`}>
      {!inline && (
        <>
          <div className="as-nav-identity">
            <div
              className="as-nav-avatar"
              style={{ background: avatarSrc ? undefined : accentColor }}
            >
              {renderAvatarContent("sm")}
            </div>
            <div className="as-nav-identity-text">
              <strong>{navName}</strong>
              <span>@{user?.username}</span>
            </div>
          </div>
          <div className="as-nav-divider" />
        </>
      )}

      {inline && <h2 className="as-nav-title">{t("settings.title")}</h2>}

      <p className="as-nav-label">{t("settings.nav.account")}</p>

      <button
        className={`as-nav-item${section === "konto" ? " active" : ""}`}
        onClick={() => { setSection("konto"); onSectionChange?.(); }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
        </svg>
        {t("settings.nav.myAccount")}
      </button>

      <button
        className={`as-nav-item${section === "profil" ? " active" : ""}`}
        onClick={() => { setSection("profil"); onSectionChange?.(); }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        {t("settings.nav.profile")}
      </button>

      <button
        className={`as-nav-item${section === "sesje" ? " active" : ""}`}
        onClick={() => { setSection("sesje"); onSectionChange?.(); }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        {t("settings.nav.sessions")}
      </button>

      <p className="as-nav-label as-nav-label--spaced">{t("settings.nav.app")}</p>

      <button
        className={`as-nav-item${section === "glos" ? " active" : ""}`}
        onClick={() => { setSection("glos"); onSectionChange?.(); }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="22"/>
        </svg>
        {t("settings.nav.voice")}
      </button>

      <button
        className={`as-nav-item${section === "jezyk" ? " active" : ""}`}
        onClick={() => { setSection("jezyk"); onSectionChange?.(); }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        {t("settings.language.title")}
      </button>

      <button
        className={`as-nav-item${section === "boty" ? " active" : ""}`}
        onClick={() => { setSection("boty"); onSectionChange?.(); }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2"/>
          <circle cx="12" cy="5" r="2"/>
          <path d="M12 7v4"/>
        </svg>
        {t("settings.nav.bots")}
      </button>

      <button
        className={`as-nav-item${section === "integracje" ? " active" : ""}`}
        onClick={() => { setSection("integracje"); onSectionChange?.(); }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4"/><path d="M12 18v4"/>
          <path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/>
          <path d="M2 12h4"/><path d="M18 12h4"/>
        </svg>
        {t("settings.nav.integrations")}
      </button>

      <button
        className={`as-nav-item${section === "ostrzezenia" ? " active" : ""}`}
        onClick={() => { setSection("ostrzezenia"); onSectionChange?.(); }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        {t("settings.nav.warnings")}
        {warningCount > 0 ? (
          <span className={`as-nav-count${unacknowledgedCount > 0 ? " as-nav-count--alert" : ""}`}>
            {warningCount}
          </span>
        ) : null}
      </button>

      <div className="as-nav-spacer" />
      <button className="as-nav-item as-nav-danger" onClick={handleLogout}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        {t("settings.nav.logout")}
      </button>
    </aside>
  );

  const settingsSections = (
    <div key={section}>
          {section === "profil" && (
            <>
              <h2 className="as-section-title">{t("settings.nav.profile")}</h2>
              <p className="as-section-subtitle">
                {t("settings.profile.subtitle")}
              </p>

              <input
                ref={avatarFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarChange(f);
                  e.target.value = "";
                }}
              />
              <input
                ref={bannerFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleBannerChange(f);
                  e.target.value = "";
                }}
              />

              <div className="as-banner-block">
                <button
                  type="button"
                  className="as-banner-preview"
                  style={bannerStyle}
                  disabled={bannerLoading}
                  onClick={() => bannerFileRef.current?.click()}
                  aria-label={t("settings.profile.changeBannerAria")}
                >
                  {bannerLoading ? (
                    <div className="as-avatar-overlay"><div className="as-spinner" /></div>
                  ) : (
                    <div className="as-banner-hover" aria-hidden>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      <span>{t("settings.profile.changeBanner")}</span>
                    </div>
                  )}
                </button>
                <div className="as-profile-header-actions">
                  {bannerPreview && (
                    <button
                      type="button"
                      className="as-btn-danger-text"
                      disabled={bannerLoading}
                      onClick={handleRemoveBanner}
                    >
                      {t("settings.profile.removeBanner")}
                    </button>
                  )}
                  <p className="as-upload-hint">
                    {t("upload.maxSizeHint", { size: MAX_AVATAR_SIZE_LABEL })}
                  </p>
                </div>
              </div>

              <div className="as-profile-header-row">
                <button
                  type="button"
                  className="as-avatar-lg"
                  style={{ background: avatarSrc ? undefined : accentColor }}
                  disabled={avatarLoading}
                  onClick={() => avatarFileRef.current?.click()}
                  aria-label={t("settings.profile.changePhotoAria")}
                >
                  {renderAvatarContent("lg")}
                </button>
                <div className="as-profile-header-actions">
                  <button
                    type="button"
                    className="as-btn-secondary"
                    disabled={avatarLoading}
                    onClick={() => avatarFileRef.current?.click()}
                  >
                    {t("settings.profile.changePhoto")}
                  </button>
                  {avatarPreview && (
                    <button
                      type="button"
                      className="as-btn-danger-text"
                      disabled={avatarLoading}
                      onClick={handleRemoveAvatar}
                    >
                      {t("common.remove")}
                    </button>
                  )}
                  <p className="as-upload-hint">
                    {t("upload.maxSizeHint", { size: MAX_AVATAR_SIZE_LABEL })}
                  </p>
                </div>
              </div>

              <div className="as-card as-data-card">
                <p className="as-card-label">{t("settings.profile.personalData")}</p>
                <div className="as-data-row">
                  <span className="as-data-label">{t("common.displayName")}</span>
                  <span className="as-data-value">{profileValues.displayName || navName}</span>
                </div>
                <div className="as-data-row">
                  <span className="as-data-label">{t("common.username")}</span>
                  <span className="as-data-value">@{user?.username}</span>
                </div>
                <div className="as-data-row">
                  <span className="as-data-label">{t("common.bio")}</span>
                  <span className="as-data-value">{profileValues.bio || t("common.emDash")}</span>
                </div>
              </div>

              <form className="as-card" onSubmit={handleSave} noValidate>
                <p className="as-card-label">{t("settings.profile.editProfile")}</p>
                {error && <div className="as-error" role="alert">{error}</div>}
                <ProfileFormFields
                  values={profileValues}
                  onChange={(patch) =>
                    setProfileValues((prev) => ({ ...prev, ...patch }))
                  }
                  variant="settings"
                  actions={
                    <button type="submit" className="as-btn-primary as-profile-save-btn" disabled={saving}>
                      {saving ? t("common.saving") : t("settings.profile.saveChanges")}
                    </button>
                  }
                />
              </form>
            </>
          )}

          {section === "konto" && (
            <>
              <h2 className="as-section-title">{t("settings.nav.myAccount")}</h2>
              <p className="as-section-subtitle">{t("settings.account.subtitle")}</p>

              <div className="as-account-hero">
                <div
                  className="as-account-hero-avatar"
                  style={{ background: avatarSrc ? undefined : accentColor }}
                >
                  {renderAvatarContent("sm")}
                </div>
                <div className="as-account-hero-copy">
                  <strong>{navName}</strong>
                  <span>@{user?.username}</span>
                  {user?.id ? <code className="as-account-hero-id">{user.id}</code> : null}
                </div>
              </div>

              {user?.deletionScheduledAt ? (
                <div className="as-deletion-pending-banner" role="status">
                  <p>
                    <strong>{t("settings.account.deletionScheduled")}</strong>{" "}
                    {t("settings.account.deletionScheduledBody", {
                      date: new Date(user.deletionScheduledAt).toLocaleString(dateLocale),
                    })}
                  </p>
                </div>
              ) : null}

              <div className="as-card">
                <p className="as-card-label">{t("common.username")}</p>
                <p className="as-hint" style={{ marginBottom: "1rem" }}>
                  {t("settings.account.usernameHint", { username: user?.username ?? "" })}
                </p>
                <form className="as-form" onSubmit={handleChangeUsername} noValidate>
                  <div className="as-field">
                    <label htmlFor="as-username">{t("settings.account.newUsername")}</label>
                    <input
                      id="as-username"
                      type="text"
                      value={usernameValue}
                      onChange={(e) => setUsernameValue(e.target.value)}
                      autoComplete="username"
                      spellCheck={false}
                      maxLength={32}
                    />
                  </div>
                  <div className="as-field">
                    <label htmlFor="as-username-password">{t("auth.fields.currentPassword")}</label>
                    <input
                      id="as-username-password"
                      type="password"
                      value={usernamePassword}
                      onChange={(e) => setUsernamePassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  {user?.twoFactorEnabled && (
                    <div className="as-field">
                      <label htmlFor="as-username-code">{t("auth.fields.twoFactorCode")}</label>
                      <input
                        id="as-username-code"
                        type="text"
                        value={usernameCode}
                        onChange={(e) => setUsernameCode(e.target.value)}
                        placeholder="123456"
                        autoComplete="one-time-code"
                      />
                    </div>
                  )}
                  {usernameError && <div className="as-error" role="alert">{usernameError}</div>}
                  <button type="submit" className="as-btn-primary" disabled={usernameBusy}>
                    {usernameBusy ? t("common.saving") : t("settings.account.changeUsername")}
                  </button>
                </form>
              </div>

              <p className="as-group-label">{t("settings.accountExtra.authGroup")}</p>

              <div className="as-setting-card">
                <div className="as-setting-row">
                  <div className="as-setting-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
                    </svg>
                  </div>
                  <div className="as-setting-info">
                    <div className="as-setting-title">{t("auth.twoFactorSetup.sectionTitle")}</div>
                    <div className="as-setting-desc">{t("auth.twoFactorSetup.sectionDesc")}</div>
                  </div>
                  <button
                    type="button"
                    className={`as-status-pill${user?.twoFactorEnabled ? " as-status-pill--success" : " as-status-pill--warn"}`}
                    onClick={() => {
                      if (!user?.twoFactorEnabled) {
                        setSecurityError("");
                        setTwoFactorSetupOpen(true);
                      }
                    }}
                  >
                    {user?.twoFactorEnabled ? t("auth.twoFactorSetup.active") : t("auth.twoFactorSetup.inactive")}
                  </button>
                </div>
              </div>

              <div className="as-setting-card">
                <div className="as-setting-row">
                  <div className="as-setting-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <div className="as-setting-info">
                    <div className="as-setting-title">{t("settings.account.changePassword")}</div>
                    <div className="as-setting-desc">{t("settings.account.changePasswordHint")}</div>
                  </div>
                </div>
                <form className="as-form as-form--inset" onSubmit={handleChangePassword} noValidate>
                  <div className="as-field">
                    <label htmlFor="as-current-password">{t("auth.fields.currentPassword")}</label>
                    <input
                      id="as-current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="as-field">
                    <label htmlFor="as-new-password">{t("auth.fields.newPassword")}</label>
                    <input
                      id="as-new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="as-field">
                    <label htmlFor="as-confirm-password">{t("auth.fields.confirmPassword")}</label>
                    <input
                      id="as-confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  {user?.twoFactorEnabled && (
                    <div className="as-field">
                      <label htmlFor="as-change-password-code">{t("auth.fields.twoFactorCode")}</label>
                      <input
                        id="as-change-password-code"
                        type="text"
                        value={changePasswordCode}
                        onChange={(e) => setChangePasswordCode(e.target.value)}
                        placeholder="123456"
                        autoComplete="one-time-code"
                      />
                    </div>
                  )}
                  {passwordError && <div className="as-error" role="alert">{passwordError}</div>}
                  <button type="submit" className="as-btn-primary" disabled={passwordBusy}>
                    {passwordBusy ? t("common.saving") : t("settings.account.changePasswordSubmit")}
                  </button>
                </form>
              </div>

              {user?.twoFactorEnabled && (
                <div className="as-setting-card">
                  <form className="as-form as-form--inset" onSubmit={handleDisableTwoFactor} noValidate>
                    <p className="as-hint">{t("auth.twoFactorSetup.disableHint")}</p>
                    <div className="as-field">
                      <label htmlFor="as-disable-password">{t("auth.fields.password")}</label>
                      <input
                        id="as-disable-password"
                        type="password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="as-field">
                      <label htmlFor="as-disable-code">{t("auth.fields.authCode")}</label>
                      <input
                        id="as-disable-code"
                        type="text"
                        value={disableCode}
                        onChange={(e) => setDisableCode(e.target.value)}
                        placeholder="123456"
                        autoComplete="one-time-code"
                      />
                    </div>
                    <button type="submit" className="as-btn-danger" disabled={twoFactorBusy}>
                      {twoFactorBusy ? t("common.disconnecting") : t("auth.twoFactorSetup.disable")}
                    </button>
                  </form>
                </div>
              )}


              {securityError && <div className="as-error" role="alert">{securityError}</div>}
              <p className="as-group-label">{t("settings.accountExtra.managementGroup")}</p>
              <p className="as-account-mgmt-lead">
                {t("settings.account.managementLead")}
              </p>

              <div className="as-account-mgmt-list">
                <button
                  type="button"
                  className={`as-account-mgmt-card${accountAction === "disable" ? " as-account-mgmt-card--active" : ""}`}
                  onClick={() => {
                    setAccountAction("disable");
                    setAccountError("");
                  }}
                >
                  <span className="as-account-mgmt-icon" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                  </span>
                  <span className="as-account-mgmt-copy">
                    <strong>{t("settings.account.disableTitle")}</strong>
                    <span>{t("settings.account.disableDesc")}</span>
                  </span>
                  <span className="as-account-mgmt-chevron" aria-hidden>›</span>
                </button>

                <button
                  type="button"
                  className={`as-account-mgmt-card${accountAction === "delete" ? " as-account-mgmt-card--active" : ""}`}
                  disabled={Boolean(user?.deletionScheduledAt)}
                  onClick={() => {
                    setAccountAction("delete");
                    setAccountError("");
                  }}
                >
                  <span className="as-account-mgmt-icon" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                  </span>
                  <span className="as-account-mgmt-copy">
                    <strong>{t("settings.account.deleteTitle")}</strong>
                    <span>{t("settings.account.deleteDesc")}</span>
                  </span>
                  <span className="as-account-mgmt-chevron" aria-hidden>›</span>
                </button>
              </div>

              {user?.deletionScheduledAt ? (
                <div className="as-account-confirm">
                  <p className="as-account-confirm-title">{t("settings.account.cancelDeletion")}</p>
                  <p className="as-hint">
                    {t("settings.accountExtra.cancelDeletionHint", { twoFactor: twoFactorSuffix })}
                  </p>
                  <div className="as-field">
                    <label htmlFor="as-cancel-deletion-password">{t("auth.fields.password")}</label>
                    <input
                      id="as-cancel-deletion-password"
                      type="password"
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  {user?.twoFactorEnabled && (
                    <div className="as-field">
                      <label htmlFor="as-cancel-deletion-code">{t("auth.fields.twoFactorCode")}</label>
                      <input
                        id="as-cancel-deletion-code"
                        type="text"
                        value={accountCode}
                        onChange={(e) => setAccountCode(e.target.value)}
                        placeholder="123456"
                        autoComplete="one-time-code"
                      />
                    </div>
                  )}
                  {accountError && <div className="as-error" role="alert">{accountError}</div>}
                  <div className="as-danger-zone-actions">
                    <button
                      type="button"
                      className="as-btn-primary"
                      disabled={accountBusy}
                      onClick={() => void handleCancelDeletion()}
                    >
                      {accountBusy ? t("common.cancel") : t("settings.account.cancelDeletionSubmit")}
                    </button>
                  </div>
                </div>
              ) : null}

              {accountAction ? (
                <div className="as-account-confirm">
                  <form className="as-form" onSubmit={handleAccountAction} noValidate>
                    <p className="as-account-confirm-title">
                      {accountAction === "disable"
                        ? t("settings.account.confirmDisable")
                        : t("settings.account.confirmDelete")}
                    </p>
                    <p className="as-hint">
                      {t("settings.account.confirmPasswordHint", { twoFactor: twoFactorSuffix })}
                    </p>
                    {accountAction === "disable" ? (
                      <p className="as-hint">{t("settings.account.disableNoDelete")}</p>
                    ) : null}
                    <div className="as-field">
                      <label htmlFor="as-account-password">{t("auth.fields.password")}</label>
                      <input
                        id="as-account-password"
                        type="password"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        autoComplete="current-password"
                      />
                    </div>
                    {user?.twoFactorEnabled && (
                      <div className="as-field">
                        <label htmlFor="as-account-code">{t("auth.fields.twoFactorCode")}</label>
                        <input
                          id="as-account-code"
                          type="text"
                          value={accountCode}
                          onChange={(e) => setAccountCode(e.target.value)}
                          placeholder="123456"
                          autoComplete="one-time-code"
                        />
                      </div>
                    )}
                    {accountError && <div className="as-error" role="alert">{accountError}</div>}
                    <div className="as-danger-zone-actions">
                      <button
                        type="button"
                        className="as-btn-ghost"
                        onClick={resetAccountAction}
                        disabled={accountBusy}
                      >
                        {t("common.cancel")}
                      </button>
                      <button type="submit" className="as-btn-danger" disabled={accountBusy}>
                        {accountBusy
                          ? t("common.processing")
                          : accountAction === "disable"
                            ? t("settings.account.disableAccount")
                            : t("settings.account.markForDeletion")}
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}
            </>
          )}

          {section === "sesje" && (
            <>
              <h2 className="as-section-title">{t("settings.account.sessionsTitle")}</h2>
              <p className="as-group-label">{t("settings.account.activeSessions")}</p>

              {sessionsError && <div className="as-error" role="alert">{sessionsError}</div>}

              {sessionsLoading ? (
                <p className="as-hint">{t("session.loadingSessions")}</p>
              ) : sessions.length === 0 ? (
                <p className="as-hint">{t("session.noSessions")}</p>
              ) : (
                <div className="as-sessions-list">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`as-session-row${session.isCurrent ? " as-session-row--current" : ""}`}
                    >
                      <BrowserSessionIcon
                        browser={session.browser}
                        isKnown={session.isKnown}
                      />
                      <div className="as-session-copy">
                        <p className="as-session-device">{session.label}</p>
                        <p className="as-session-meta">
                          {t("session.createdAt", {
                            time: formatSessionRelativeTime(session.createdAt),
                          })}
                        </p>
                      </div>
                      <div className="as-session-actions">
                        <button
                          type="button"
                          className="as-btn-danger-text as-session-logout-btn"
                          disabled={sessionActionId === session.id}
                          onClick={() => void handleRevokeSession(session)}
                        >
                          {sessionActionId === session.id ? t("common.loggingOut") : t("common.logout")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sessions.some((s) => !s.isCurrent) ? (
                <button
                  type="button"
                  className="as-action-row"
                  disabled={revokeOthersBusy || sessionsLoading}
                  onClick={() => void handleRevokeOtherSessions()}
                >
                  <span className="as-action-row-icon as-action-row-icon--danger">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                  </span>
                  <span className="as-action-row-copy">
                    <strong>{t("session.revokeOthers")}</strong>
                    <span>{t("session.revokeOthersHint")}</span>
                  </span>
                  <span className="as-action-row-chevron" aria-hidden>›</span>
                </button>
              ) : null}

              <div className="as-info-banner">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <p>
                  {t("session.securityHint")}
                </p>
              </div>
            </>
          )}

          {section === "jezyk" && <LanguageSettingsPanel />}

          {section === "boty" && <BotsPanel />}

          {section === "glos" && <VoiceSettingsPanel />}

          {section === "integracje" && (
            <IntegrationsPanel
              spotifyOauthError={spotifyOauthError}
              spotifyOauthConnected={spotifyOauthConnected}
            />
          )}

          {section === "ostrzezenia" && (
            <>
              <h2 className="as-section-title">{t("settings.warnings.title")}</h2>

              <div className="as-card">
                <p className="as-card-label">{t("settings.warnings.violations")}</p>
                <p className="as-hint" style={{ marginBottom: "1rem" }}>
                  {t("settings.warnings.intro")}
                </p>

                <div className="as-warn-stats">
                  <div className="as-warn-stat">
                    <span className="as-warn-stat-num">{warningCount}</span>
                    <span className="as-warn-stat-label">
                      {t("presence.warning", { count: warningCount })}
                    </span>
                  </div>
                  <div
                    className={`as-warn-stat${unacknowledgedCount > 0 ? " as-warn-stat--alert" : ""}`}
                  >
                    <span className="as-warn-stat-num">{unacknowledgedCount}</span>
                    <span className="as-warn-stat-label">{t("settings.warnings.unread")}</span>
                  </div>
                </div>
              </div>

              <div className="as-card">
                <p className="as-card-label">{t("settings.warnings.history")}</p>
                {warningsLoading ? (
                  <p className="as-hint">{t("common.loading")}</p>
                ) : warnings.length === 0 ? (
                  <div className="as-warn-empty">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <p>{t("settings.warnings.empty")}</p>
                  </div>
                ) : (
                  <div className="as-warn-list">
                    {warnings.map((w) => (
                      <div
                        key={w.id}
                        className={`as-warn-item as-warn-item--${w.severity}`}
                      >
                        <div className="as-warn-item-head">
                          <span className={`as-warn-sev as-warn-sev--${w.severity}`}>
                            {WARNING_SEVERITY_LABELS[w.severity]}
                          </span>
                          <span className="as-warn-date">
                            {formatWarningDate(w.createdAt)}
                          </span>
                        </div>
                        <p className="as-warn-reason">{w.reason}</p>
                        <div className="as-warn-status">
                          {w.acknowledged ? (
                            <span className="as-warn-ack">{t("common.acknowledged")}</span>
                          ) : (
                            <span className="as-warn-unack">{t("common.unread")}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
    </div>
  );

  if (inline) {
    return (
      <>
        <div className="settings-inline" style={accentStyle}>
          <div className="app-shell__settings-nav">{navPanel}</div>
          <div className="app-shell__settings-content as-content as-content--inline">
            <div className="as-content-topbar">
              <button
                type="button"
                className="as-close as-close--inline"
                onClick={requestClose}
                aria-label={t("common.closeSettings")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              <span className="as-close-hint">ESC</span>
            </div>
            <div className="as-content-inner">
              {settingsSections}
            </div>
          </div>
        </div>
        <TwoFactorSetupModal
          isOpen={twoFactorSetupOpen}
          onClose={() => setTwoFactorSetupOpen(false)}
          onEnabled={handleTwoFactorEnabled}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={`klovy-backdrop as-backdrop${closing ? " closing" : ""}`}
        onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
        role="dialog"
        aria-modal="true"
        aria-label={t("common.accountSettings")}
      >
        <div className="as-shell klovy-shell" style={accentStyle}>
          {navPanel}
          <div className="as-content">
            <button className="as-close" onClick={requestClose} aria-label={t("common.close")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            {settingsSections}
          </div>
        </div>
      </div>
      <TwoFactorSetupModal
        isOpen={twoFactorSetupOpen}
        onClose={() => setTwoFactorSetupOpen(false)}
        onEnabled={handleTwoFactorEnabled}
      />
      {cropTarget ? (
        <ImageCropModal
          file={cropTarget.file}
          aspect={cropTarget.kind === "avatar" ? 1 : 1024 / 384}
          outputWidth={cropTarget.kind === "avatar" ? 512 : 1024}
          outputHeight={cropTarget.kind === "avatar" ? 512 : 384}
          round={cropTarget.kind === "avatar"}
          title={
            cropTarget.kind === "avatar"
              ? t("imageCrop.avatarTitle")
              : t("imageCrop.bannerTitle")
          }
          maxSizeLabel={MAX_AVATAR_SIZE_LABEL}
          busy={cropTarget.kind === "avatar" ? avatarLoading : bannerLoading}
          onCancel={() => setCropTarget(null)}
          onConfirm={handleCropConfirm}
        />
      ) : null}
    </>
  );
}
