import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getContactsForList } from "../api/contacts";
import {
  getPresenceSettings,
  updatePresenceSettings,
  type PresenceSettings,
  type PresenceVisibility,
} from "../api/presence";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import type { Contact } from "../types";
import { formatLastSeen } from "../utils/user/format";

function localEndOfDay(): string {
  const end = new Date();
  end.setHours(24, 0, 0, 0);
  return end.toISOString();
}

function friendLabel(friend: Contact): string {
  return friend.displayName?.trim() || friend.username || friend._id;
}

export function PresencePrivacySettings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState<PresenceSettings>({
    presenceVisibility: "everyone",
    presenceVisibleTo: [],
    presenceHiddenUntil: null,
  });
  const [friends, setFriends] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [loadedSettings, contacts] = await Promise.all([
          getPresenceSettings(),
          getContactsForList(),
        ]);
        if (cancelled) return;
        setFriends(contacts.contacts);
        const friendIds = new Set(contacts.contacts.map((contact) => contact._id));
        setSettings({
          ...loadedSettings,
          presenceVisibleTo: loadedSettings.presenceVisibleTo.filter((id) => friendIds.has(id)),
        });
      } catch (loadError) {
        console.error("Failed to load presence privacy settings", loadError);
        if (!cancelled) setError(t("settings.status.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const saved = await updatePresenceSettings(settings);
      setSettings(saved);
      toast.success(t("settings.status.saved"));
    } catch (saveError) {
      console.error("Failed to save presence privacy settings", saveError);
      setError(t("settings.status.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const toggleFriend = (friendId: string) => {
    setSettings((current) => ({
      ...current,
      presenceVisibleTo: current.presenceVisibleTo.includes(friendId)
        ? current.presenceVisibleTo.filter((id) => id !== friendId)
        : [...current.presenceVisibleTo, friendId],
    }));
  };

  const setTemporaryHide = (duration: "hour" | "eightHours" | "day") => {
    const expires = new Date();
    if (duration === "hour") expires.setHours(expires.getHours() + 1);
    if (duration === "eightHours") expires.setHours(expires.getHours() + 8);
    setSettings((current) => ({
      ...current,
      presenceHiddenUntil:
        duration === "day" ? localEndOfDay() : expires.toISOString(),
    }));
  };

  const setVisibility = (presenceVisibility: PresenceVisibility) => {
    setSettings((current) => ({ ...current, presenceVisibility }));
  };

  const friendCanSee = settings.presenceVisibility === "everyone"
    || (settings.presenceVisibility === "friends" && friends.length > 0)
    || settings.presenceVisibleTo.length > 0;
  const temporaryHideActive = Boolean(
    settings.presenceHiddenUntil
    && new Date(settings.presenceHiddenUntil).getTime() > Date.now(),
  );
  const previewText = formatLastSeen(user?.lastSeen, {
    isOnline: user?.isOnline !== false && friendCanSee && !temporaryHideActive,
    hidden: !friendCanSee || temporaryHideActive,
    longAgo: user?.isLastSeenLongAgo,
  });
  const hiddenUntilLabel = settings.presenceHiddenUntil
    ? new Date(settings.presenceHiddenUntil).toLocaleString()
    : "";

  if (loading) {
    return <p className="as-section-subtitle">{t("common.loading")}</p>;
  }

  return (
    <section className="presence-settings">
      <h2 className="as-section-title">{t("settings.nav.status")}</h2>
      <p className="as-section-subtitle">{t("settings.status.subtitle")}</p>

      {error && <p className="as-error" role="alert">{error}</p>}

      <div className="as-card presence-settings__card">
        <h3>{t("settings.status.whoCanSee")}</h3>
        {(["everyone", "friends", "nobody"] as const).map((visibility) => (
          <label className="presence-settings__choice" key={visibility}>
            <input
              type="radio"
              name="presence-visibility"
              value={visibility}
              checked={settings.presenceVisibility === visibility}
              onChange={() => setVisibility(visibility)}
            />
            <span>{t(`settings.status.visibility.${visibility}`)}</span>
          </label>
        ))}
        <p className="presence-settings__hint">{t("settings.status.audienceHint")}</p>
      </div>

      <div className="as-card presence-settings__card">
        <h3>{t("settings.status.exceptionsTitle")}</h3>
        <p className="presence-settings__hint">{t("settings.status.exceptionsHint")}</p>
        {friends.length === 0 ? (
          <p className="presence-settings__hint">{t("settings.status.noFriends")}</p>
        ) : (
          <div className="presence-settings__friends">
            {friends.map((friend) => (
              <label className="presence-settings__choice" key={friend._id}>
                <input
                  type="checkbox"
                  checked={settings.presenceVisibleTo.includes(friend._id)}
                  disabled={
                    settings.presenceVisibleTo.length >= 500
                    && !settings.presenceVisibleTo.includes(friend._id)
                  }
                  onChange={() => toggleFriend(friend._id)}
                />
                <span>{friendLabel(friend)}</span>
              </label>
            ))}
          </div>
        )}
        {friends.length > 0 && (
          <p className="presence-settings__hint">{t("settings.status.exceptionsLimit")}</p>
        )}
      </div>

      <div className="as-card presence-settings__card">
        <h3>{t("settings.status.temporaryTitle")}</h3>
        <p className="presence-settings__hint">
          {temporaryHideActive
            ? t("settings.status.temporaryActive", { date: hiddenUntilLabel })
            : t("settings.status.temporaryHint")}
        </p>
        <div className="presence-settings__temporary">
          <button type="button" className="as-btn-secondary" onClick={() => setTemporaryHide("hour")}>
            {t("settings.status.hideOneHour")}
          </button>
          <button type="button" className="as-btn-secondary" onClick={() => setTemporaryHide("eightHours")}>
            {t("settings.status.hideEightHours")}
          </button>
          <button type="button" className="as-btn-secondary" onClick={() => setTemporaryHide("day")}>
            {t("settings.status.hideUntilEndOfDay")}
          </button>
          {settings.presenceHiddenUntil && (
            <button
              type="button"
              className="as-btn-danger-text"
              onClick={() => setSettings((current) => ({ ...current, presenceHiddenUntil: null }))}
            >
              {t("settings.status.stopTemporaryHide")}
            </button>
          )}
        </div>
      </div>

      <div className="as-card presence-settings__preview">
        <strong>{t("settings.status.previewTitle")}</strong>
        <span>{previewText}</span>
        <small>{t("settings.status.previewHint")}</small>
      </div>

      <button
        type="button"
        className="as-btn-primary presence-settings__save"
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? t("common.saving") : t("settings.profile.saveChanges")}
      </button>
    </section>
  );
}
