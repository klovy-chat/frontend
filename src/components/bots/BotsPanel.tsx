import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listMyBots,
  createBot,
  updateBot,
  regenerateBotToken,
  deleteBot,
} from "../../api/bots";
import { ApiError } from "../../api/client";
import { useLocale } from "../../context/LocaleContext";
import { useToast } from "../../context/ToastContext";
import { Avatar } from "../common/Avatar";
import { normalizeUsernameInput, validateUsernameInput } from "../../utils/auth/username";
import type { Bot } from "../../types";

const SEND_ENDPOINT = "/api/bot/channels/{channelId}/messages";

function TokenReveal({ token }: { token: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        border: "1px solid var(--accent-border)",
        background: "var(--accent-dim)",
      }}
    >
      <p className="as-hint" style={{ margin: "0 0 8px", color: "var(--accent)" }}>
        {t("modals.bots.create.tokenRevealHint")}
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <code
          style={{
            flex: 1,
            minWidth: 0,
            overflowWrap: "anywhere",
            fontSize: "0.78rem",
            background: "var(--bg-deep)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "8px 10px",
            color: "var(--text)",
          }}
        >
          {token}
        </code>
        <button type="button" className="as-btn-primary" onClick={copy}>
          {copied ? t("common.copied") : t("common.copy")}
        </button>
      </div>
    </div>
  );
}

interface BotEditFields {
  displayName: string;
  username: string;
}

export function BotsPanel() {
  const { t } = useTranslation();
  const { dateLocale } = useLocale();
  const toast = useToast();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");

  const [busyBotId, setBusyBotId] = useState<string | null>(null);
  const [revealedTokens, setRevealedTokens] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, BotEditFields>>({});
  const [editError, setEditError] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listMyBots()
      .then((res) => {
        if (!cancelled) setBots(res.bots ?? []);
      })
      .catch(() => {
        if (!cancelled) setBots([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError("");
    const validation = validateUsernameInput(username);
    if (validation) {
      setCreateError(validation);
      return;
    }
    setCreateBusy(true);
    try {
      const res = await createBot(normalizeUsernameInput(username), displayName.trim());
      const bot = res.bot;
      setBots((prev) => [bot, ...prev]);
      if (bot.token) {
        setRevealedTokens((prev) => ({ ...prev, [bot.id]: bot.token! }));
      }
      setUsername("");
      setDisplayName("");
    } catch (err) {
      setCreateError(
        err instanceof ApiError ? err.message : t("modals.bots.errors.createFailed"),
      );
    } finally {
      setCreateBusy(false);
    }
  };

  const handleRegenerate = async (botId: string) => {
    setBusyBotId(botId);
    try {
      const res = await regenerateBotToken(botId);
      setRevealedTokens((prev) => ({ ...prev, [botId]: res.token }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("modals.bots.errors.tokenFailed"));
    } finally {
      setBusyBotId(null);
    }
  };

  const handleSaveEdit = async (botId: string, currentUsername: string) => {
    const fields = editing[botId];
    if (!fields) return;

    const normalized = normalizeUsernameInput(fields.username);
    const usernameValidation = validateUsernameInput(fields.username);
    if (usernameValidation) {
      setEditError((prev) => ({ ...prev, [botId]: usernameValidation }));
      return;
    }

    setEditError((prev) => {
      const next = { ...prev };
      delete next[botId];
      return next;
    });
    setBusyBotId(botId);
    try {
      const patch: { displayName: string; username?: string } = {
        displayName: fields.displayName.trim(),
      };
      if (normalized !== currentUsername) {
        patch.username = normalized;
      }
      const res = await updateBot(botId, patch);
      setBots((prev) => prev.map((b) => (b.id === botId ? res.bot : b)));
      setEditing((prev) => {
        const next = { ...prev };
        delete next[botId];
        return next;
      });
    } catch (err) {
      setEditError((prev) => ({
        ...prev,
        [botId]:
          err instanceof ApiError ? err.message : t("modals.bots.errors.saveFailed"),
      }));
    } finally {
      setBusyBotId(null);
    }
  };

  const handleDelete = async (bot: Bot) => {
    if (!window.confirm(t("modals.bots.deleteConfirm", { username: bot.username }))) {
      return;
    }
    setBusyBotId(bot.id);
    try {
      await deleteBot(bot.id);
      setBots((prev) => prev.filter((b) => b.id !== bot.id));
      setRevealedTokens((prev) => {
        const next = { ...prev };
        delete next[bot.id];
        return next;
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("modals.bots.errors.deleteFailed"));
    } finally {
      setBusyBotId(null);
    }
  };

  return (
    <>
      <h2 className="as-section-title">{t("modals.bots.title")}</h2>

      <div className="as-card">
        <p className="as-card-label">{t("modals.bots.create.title")}</p>
        <p className="as-hint" style={{ marginBottom: "1rem" }}>
          {t("modals.bots.create.hint")}{" "}
          {t("modals.bots.create.apiHint", { endpoint: SEND_ENDPOINT })}
        </p>

        <form className="as-form" onSubmit={handleCreate} noValidate>
          <div className="as-field">
            <label htmlFor="bot-username">{t("modals.bots.create.username")}</label>
            <input
              id="bot-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("modals.bots.create.usernamePlaceholder")}
              spellCheck={false}
              maxLength={32}
            />
          </div>
          <div className="as-field">
            <label htmlFor="bot-displayname">{t("modals.bots.create.displayName")}</label>
            <input
              id="bot-displayname"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("modals.bots.create.displayNamePlaceholder")}
              maxLength={32}
            />
          </div>

          {createError && (
            <div className="as-error" role="alert">
              {createError}
            </div>
          )}

          <button type="submit" className="as-btn-primary" disabled={createBusy}>
            {createBusy ? t("modals.bots.create.creating") : t("modals.bots.create.submit")}
          </button>
        </form>
      </div>

      <div className="as-card">
        <p className="as-card-label">{t("modals.bots.list.title")}</p>
        {loading ? (
          <p className="as-hint">{t("common.loading")}</p>
        ) : bots.length === 0 ? (
          <p className="as-hint">{t("modals.bots.list.empty")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {bots.map((bot) => {
              const isEditing = bot.id in editing;
              const busy = busyBotId === bot.id;
              return (
                <div
                  key={bot.id}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-deep)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar
                      displayName={bot.displayName}
                      username={bot.username}
                      image={bot.image}
                      color={bot.color ?? undefined}
                      size={38}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: "0.9rem",
                          fontWeight: 600,
                          color: "var(--text)",
                        }}
                      >
                        {bot.displayName || bot.username}
                        <span
                          style={{
                            fontSize: "0.6rem",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            color: "#fff",
                            background: "#5865f2",
                            padding: "2px 5px",
                            borderRadius: 4,
                            textTransform: "uppercase",
                          }}
                        >
                          {t("modals.bots.create.botBadge")}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#50505a" }}>
                        @{bot.username}
                        {bot.tokenLastUsedAt
                          ? t("modals.bots.list.lastUsed", {
                              date: new Date(bot.tokenLastUsedAt).toLocaleString(dateLocale),
                            })
                          : t("modals.bots.list.tokenUnused")}
                      </div>
                    </div>
                  </div>

                  {isEditing ? (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div className="as-field">
                        <label htmlFor={`edit-username-${bot.id}`}>
                          {t("modals.bots.list.editUsername")}
                        </label>
                        <input
                          id={`edit-username-${bot.id}`}
                          type="text"
                          value={editing[bot.id].username}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [bot.id]: { ...prev[bot.id], username: e.target.value },
                            }))
                          }
                          spellCheck={false}
                          maxLength={32}
                          autoComplete="off"
                        />
                        <p className="as-hint" style={{ marginTop: 6 }}>
                          {t("modals.bots.create.usernameHint")}
                        </p>
                      </div>
                      <div className="as-field">
                        <label htmlFor={`edit-display-${bot.id}`}>
                          {t("modals.bots.list.editDisplayName")}
                        </label>
                        <input
                          id={`edit-display-${bot.id}`}
                          type="text"
                          value={editing[bot.id].displayName}
                          onChange={(e) =>
                            setEditing((prev) => ({
                              ...prev,
                              [bot.id]: { ...prev[bot.id], displayName: e.target.value },
                            }))
                          }
                          maxLength={32}
                        />
                      </div>

                      {editError[bot.id] && (
                        <div className="as-error" role="alert">
                          {editError[bot.id]}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          className="as-btn-primary"
                          disabled={busy}
                          onClick={() => void handleSaveEdit(bot.id, bot.username)}
                        >
                          {busy ? t("common.saving") : t("common.save")}
                        </button>
                        <button
                          type="button"
                          className="as-btn-ghost"
                          onClick={() => {
                            setEditing((prev) => {
                              const next = { ...prev };
                              delete next[bot.id];
                              return next;
                            });
                            setEditError((prev) => {
                              const next = { ...prev };
                              delete next[bot.id];
                              return next;
                            });
                          }}
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                      <button
                        type="button"
                        className="as-btn-ghost"
                        disabled={busy}
                        onClick={() =>
                          setEditing((prev) => ({
                            ...prev,
                            [bot.id]: {
                              displayName: bot.displayName ?? "",
                              username: bot.username,
                            },
                          }))
                        }
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="as-btn-ghost"
                        disabled={busy}
                        onClick={() => void handleRegenerate(bot.id)}
                      >
                        {busy ? "…" : t("modals.bots.list.newToken")}
                      </button>
                      <button
                        type="button"
                        className="as-btn-danger"
                        disabled={busy}
                        onClick={() => void handleDelete(bot)}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  )}

                  {revealedTokens[bot.id] && (
                    <TokenReveal token={revealedTokens[bot.id]} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
