import { useTranslation } from "react-i18next";
import { ColorPicker } from "../account/ColorPicker";
import { BIO_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH } from "../../constants/profile";
import type { ReactNode } from "react";

export interface ProfileFormValues {
  displayName: string;
  bio: string;
  color: number;
}

interface ProfileFormFieldsProps {
  values: ProfileFormValues;
  onChange: (patch: Partial<ProfileFormValues>) => void;
  /** Klasy pól jak na stronie logowania/setup */
  variant?: "setup" | "settings";
  actions?: ReactNode;
}

export function ProfileFormFields({
  values,
  onChange,
  variant = "setup",
  actions,
}: ProfileFormFieldsProps) {
  const { t } = useTranslation();
  const isSetup = variant === "setup";
  const fieldClass = isSetup ? "al-field" : "as-field";
  const inputWrapClass = isSetup ? "al-input-wrap" : undefined;
  const bioRemaining = BIO_MAX_LENGTH - values.bio.length;

  const nameInput = (
    <input
      id="profile-display-name"
      type="text"
      value={values.displayName}
      onChange={(e) => onChange({ displayName: e.target.value })}
      placeholder={t("profile.form.displayNamePlaceholder")}
      required
      maxLength={DISPLAY_NAME_MAX_LENGTH}
      autoComplete="nickname"
    />
  );

  const bioInput = (
    <textarea
      id="profile-bio"
      value={values.bio}
      onChange={(e) =>
        onChange({ bio: e.target.value.slice(0, BIO_MAX_LENGTH) })
      }
      placeholder={t("profile.form.bioPlaceholderOptional")}
      rows={4}
      maxLength={BIO_MAX_LENGTH}
    />
  );

  return (
    <>
      <div className={fieldClass}>
        <label htmlFor="profile-display-name">{t("profile.form.displayNameRequired")}</label>
        {inputWrapClass ? (
          <div className={inputWrapClass}>{nameInput}</div>
        ) : (
          nameInput
        )}
        <p className="profile-field-hint">
          {t("profile.form.displayNameHint", { max: DISPLAY_NAME_MAX_LENGTH })}
        </p>
      </div>

      <div className={`${fieldClass} profile-bio-field`}>
        <label htmlFor="profile-bio">{t("profile.form.bioLabel")}</label>
        {inputWrapClass ? (
          <div className={inputWrapClass}>{bioInput}</div>
        ) : (
          bioInput
        )}
        <p className="profile-field-hint profile-bio-counter" aria-live="polite">
          {bioRemaining} / {BIO_MAX_LENGTH}
        </p>
      </div>

      <div className={fieldClass}>
        <label>{t("profile.form.avatarColor")}</label>
        <ColorPicker value={values.color} onChange={(color) => onChange({ color })} />
        {actions ? <div className="as-profile-save-row">{actions}</div> : null}
      </div>
    </>
  );
}

/** Wartości początkowe z kontekstu auth (setup + ustawienia). */
export function profileValuesFromUser(
  user: {
    displayName?: string | null;
    bio?: string | null;
    color?: number | null;
  } | null | undefined,
): ProfileFormValues {
  return {
    displayName: user?.displayName?.trim() || "",
    bio: user?.bio ?? "",
    color: user?.color ?? 0,
  };
}
