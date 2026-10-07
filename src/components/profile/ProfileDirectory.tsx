import { useRef, useState, type FormEvent } from "react";
import { Camera, CalendarDays, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { updateProfile, changeUsername, addProfileImage } from "../../api/auth";
import { Avatar } from "../common/Avatar";
import { ImageCrop } from "../common/ImageCrop";
import { userLabel } from "../../utils/user/format";
import { sanitizeUsernameInput, validateUsernameInput } from "../../utils/auth/username";
import { sanitizeBioInput, sanitizeDisplayNameInput } from "../../utils/text/unicode";
import { BIO_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH } from "../../constants/profile";
import { MAX_AVATAR_SIZE_LABEL } from "../../constants/upload";
import "../../styles/account/profile-directory.css";
export function ProfileDirectory() {
  const { t, i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.displayName ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [crop, setCrop] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const input = useRef<HTMLInputElement>(null);
  if (!user) return null;
  const usernameChanged = username !== user.username;
  async function save(event: FormEvent) {
    event.preventDefault(); if (!user || busy) return;
    const error = usernameChanged ? validateUsernameInput(username) : null;
    if (error) { setFeedback(error); return; }
    setBusy(true); setFeedback("");
    try {
      if (usernameChanged) { const changed = await changeUsername(username, password, code || undefined); updateUser(changed); setPassword(""); setCode(""); }
      const updated = await updateProfile({ displayName: name.trim(), bio, color: user.color ?? undefined }); updateUser(updated);
      setFeedback(t("settings.profile.saved", { defaultValue: "Saved" }));
    } catch (error) { setFeedback(error instanceof Error ? error.message : t("errors.generic")); }
    finally { setBusy(false); }
  }
  async function upload(file: File) {
    if (!user) return; setBusy(true); setFeedback("");
    try { const result = await addProfileImage(file); updateUser({ ...user, image: result.image }); setCrop(null); }
    catch (error) { setFeedback(error instanceof Error ? error.message : t("errors.generic")); }
    finally { setBusy(false); }
  }
  return <section className="profile-directory"><form onSubmit={save}>
    <div className="profile-directory__identity"><div className="profile-directory__avatar"><Avatar displayName={name} username={username} image={user.image} color={user.color} size={96} /><button type="button" disabled={busy} onClick={() => input.current?.click()} aria-label={t("settings.profile.changePhoto", { defaultValue: "Change photo" })}><Camera size={16} /></button></div><h1>{userLabel({ displayName: name, username })}</h1><span>@{username}</span><div className="profile-directory__joined"><span>{t("settings.profile.directory.joined")}</span><div><CalendarDays size={15} aria-hidden="true" /><time dateTime={user.createdAt}>{user.createdAt ? new Date(user.createdAt).toLocaleDateString(i18n.resolvedLanguage ?? i18n.language, { day: "numeric", month: "long", year: "numeric" }) : t("common.emDash")}</time></div></div></div>
    <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (file) setCrop(file); event.target.value = ""; }} />
    <fieldset disabled={busy}>
      <label>{t("profile.form.displayNameRequired")}<input required maxLength={DISPLAY_NAME_MAX_LENGTH} value={name} onChange={event => setName(sanitizeDisplayNameInput(event.target.value))} autoComplete="nickname" /></label>
      <label>{t("settings.profile.directory.username")}<input required maxLength={32} value={username} onChange={event => setUsername(sanitizeUsernameInput(event.target.value))} autoComplete="username" /></label>
      {usernameChanged && <><label>{t("settings.profile.directory.password")}<input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>{user.twoFactorEnabled && <label>{t("settings.profile.directory.code")}<input required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} /></label>}</>}
      <label>{t("profile.form.bioLabel")}<textarea rows={4} maxLength={BIO_MAX_LENGTH} value={bio} onChange={event => setBio(sanitizeBioInput(event.target.value))} /></label>
      <button type="submit" className="profile-directory__save" disabled={!name.trim() || (usernameChanged && !password)}><Check size={16} strokeWidth={1.75} aria-hidden="true" /><span>{busy ? t("common.saving") : t("settings.profile.saveChanges")}</span></button>
    </fieldset>
    {feedback && <p role="status">{feedback}</p>}
    {crop && <ImageCrop file={crop} aspect={1} outputWidth={512} outputHeight={512} round title={t("settings.profile.changePhoto", { defaultValue: "Change photo" })} maxSizeLabel={MAX_AVATAR_SIZE_LABEL} busy={busy} onCancel={() => setCrop(null)} onConfirm={upload} />}
  </form></section>;
}
