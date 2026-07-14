import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { updateProfile } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { isPendingWhitelist } from "../utils/auth/whitelist";
import { ApiError } from "../api/client";
import {
  ProfileFormFields,
  profileValuesFromUser,
  type ProfileFormValues,
} from "../components/profile/ProfileFormFields";
import { AuthPageLayout } from "../components/auth/AuthPageLayout";
import "../styles/auth/auth.css";
import "../styles/account/profile.css";

export function ProfileSetupPage() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<ProfileFormValues>(() =>
    profileValuesFromUser(user),
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const patchValues = (patch: Partial<ProfileFormValues>) =>
    setValues((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!values.displayName.trim()) {
      setError(t("validation.displayName.required"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      const updated = await updateProfile({
        displayName: values.displayName.trim(),
        bio: values.bio.trim() || undefined,
        color: values.color,
      });
      updateUser(updated);
      navigate(isPendingWhitelist(updated) ? "/pending" : "/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("auth.setup.saveFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout>
      <div className="al-card al-card--solo">
        <div className="al-left">
          <h1 className="al-title">{t("auth.setup.title")}</h1>

          <form className="al-form" onSubmit={handleSubmit} noValidate>
            <ProfileFormFields
              values={values}
              onChange={patchValues}
              variant="setup"
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
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className="al-btn-submit" disabled={loading}>
              {loading ? t("common.saving") : t("auth.setup.submit")}
            </button>
          </form>
        </div>
      </div>
    </AuthPageLayout>
  );
}
