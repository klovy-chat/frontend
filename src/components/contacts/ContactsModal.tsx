import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  sendFriendRequest,
  getReceivedFriendRequests,
  getSentFriendRequests,
  getFriends,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
} from "../../api/friends";
import { getBlockedContacts, toggleContactBlock } from "../../api/contacts";
import { Avatar } from "../common/Avatar";
import { useToast } from "../../context/ToastContext";
import { userLabel, availabilityStatusLabel } from "../../utils/user/format";
import type { Contact, FriendRequestItem } from "../../types";
import "../../styles/contacts/contacts-modal.css";

export type ContactsTab = "invite" | "myContacts" | "sent" | "blocked";

interface ContactsModalProps {
  isOpen: boolean;
  isClosing: boolean;
  onClose: () => void;
  onSelectContact: (contact: Contact) => void;
  onRefreshContacts: () => Promise<void>;
}

const TABS: ContactsTab[] = ["invite", "myContacts", "sent", "blocked"];

function EmptyState({
  icon,
  title,
  sub,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="contacts-modal__empty">
      <div className="contacts-modal__empty-icon">{icon}</div>
      <div className="contacts-modal__empty-title">{title}</div>
      <div className="contacts-modal__empty-sub">{sub}</div>
    </div>
  );
}

const ICONS = {
  invite: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  contacts: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  sent: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7z" />
    </svg>
  ),
  blocked: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </svg>
  ),
};

function contactStatus(contact: Contact): "online" | "away" | "brb" | "dnd" | "offline" {
  if (!contact.isOnline) return "offline";
  return contact.availabilityStatus ?? "online";
}

export function ContactsModal({
  isOpen,
  isClosing,
  onClose,
  onSelectContact,
  onRefreshContacts,
}: ContactsModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [tab, setTab] = useState<ContactsTab>("invite");
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSentPulse, setInviteSentPulse] = useState(false);
  const [contactsSearch, setContactsSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequestItem[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestItem[]>([]);
  const [friendsList, setFriendsList] = useState<Contact[]>([]);
  const [blockedList, setBlockedList] = useState<Contact[]>([]);

  const tabsRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);

  const tabLabels = useMemo(
    (): Record<ContactsTab, string> => ({
      invite: t("modals.contacts.tabs.invites"),
      myContacts: t("modals.contacts.tabs.friends"),
      sent: t("modals.contacts.tabs.sent"),
      blocked: t("modals.contacts.tabs.blocked"),
    }),
    [t],
  );

  const counts = useMemo(
    () => ({
      invite: receivedRequests.length,
      myContacts: friendsList.length,
      sent: sentRequests.length,
      blocked: blockedList.length,
    }),
    [receivedRequests.length, friendsList.length, sentRequests.length, blockedList.length],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [received, sent, friends, blocked] = await Promise.all([
        getReceivedFriendRequests(),
        getSentFriendRequests(),
        getFriends(),
        getBlockedContacts(),
      ]);
      setReceivedRequests(received.requests);
      setSentRequests(sent.requests);
      setFriendsList(friends.friends);
      setBlockedList(blocked.contacts);
    } catch {
      /**/
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && !isClosing) {
      void loadData();
    }
  }, [isOpen, isClosing, loadData]);

  const updateIndicator = useCallback(() => {
    const tabs = tabsRef.current;
    const indicator = indicatorRef.current;
    if (!tabs || !indicator) return;
    const active = tabs.querySelector(".contacts-modal__tab.active") as HTMLElement | null;
    if (!active) return;
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft - 4}px)`;
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateIndicator();
  }, [isOpen, tab, counts, loading, updateIndicator]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => updateIndicator();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen, updateIndicator]);

  const notifyInvite = (message: string, isError = false) => {
    if (isError) toast.error(message);
    else toast.success(message);
  };

  const handleSendInvite = async () => {
    const raw = inviteUsername.trim();
    if (!raw) {
      setInviteError(t("auth.username.inviteRequired"));
      return;
    }
    setInviteSending(true);
    setInviteError(null);
    try {
      const res = await sendFriendRequest(raw);
      const handle = raw.startsWith("@") ? raw : `@${raw}`;
      setInviteSentPulse(true);
      notifyInvite(t("modals.contacts.invite.sent", { handle }));
      setInviteUsername("");
      await loadData();
      await onRefreshContacts();
      setTimeout(() => setInviteSentPulse(false), 1800);
      if (res.autoAccepted && res.friend) {
        onSelectContact(res.friend);
        onClose();
      }
    } catch (err) {
      notifyInvite(
        err instanceof Error ? err.message : t("modals.contacts.invite.sendFailed"),
        true,
      );
    } finally {
      setInviteSending(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      const res = await acceptFriendRequest(requestId);
      await loadData();
      await onRefreshContacts();
      onSelectContact(res.friend);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("modals.contacts.invite.acceptFailed"));
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await rejectFriendRequest(requestId);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("modals.contacts.invite.rejectFailed"));
    }
  };

  const handleCancelSent = async (requestId: string) => {
    try {
      await cancelFriendRequest(requestId);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("modals.contacts.invite.cancelFailed"));
    }
  };

  const filteredFriends = useMemo(() => {
    const q = contactsSearch.trim().toLowerCase();
    if (!q) return friendsList;
    return friendsList.filter((f) => {
      const label = userLabel(f).toLowerCase();
      const uname = (f.username ?? "").toLowerCase();
      return label.includes(q) || uname.includes(q) || `@${uname}`.includes(q);
    });
  }, [friendsList, contactsSearch]);

  const renderMain = () => {
    if (loading) {
      return <p className="contacts-modal__loading">{t("common.loading")}</p>;
    }

    if (tab === "invite") {
      if (receivedRequests.length === 0) {
        return (
          <EmptyState
            icon={ICONS.invite}
            title={t("modals.contacts.invite.emptyTitle")}
            sub={t("modals.contacts.invite.emptySub")}
          />
        );
      }
      return (
        <div className="contacts-modal__list">
          {receivedRequests.map((req, i) => (
            <div key={req._id} className="contacts-modal__row" style={{ animationDelay: `${i * 40}ms` }}>
              <Avatar
                displayName={req.from?.displayName}
                username={req.from?.username}
                image={req.from?.image ?? null}
                color={req.from?.color}
                size={40}
              />
              <div className="contacts-modal__info">
                <div className="contacts-modal__name">{userLabel(req.from ?? {})}</div>
                <div className="contacts-modal__meta">
                  {req.from?.username ? `@${req.from.username}` : t("common.user")}
                  {t("modals.contacts.invite.newInvite")}
                </div>
              </div>
              <div className="contacts-modal__actions">
                <button
                  type="button"
                  className="contacts-modal__icon-btn contacts-modal__icon-btn--accept"
                  title={t("common.accept")}
                  onClick={() => void handleAccept(req._id)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="contacts-modal__icon-btn contacts-modal__icon-btn--decline"
                  title={t("common.reject")}
                  onClick={() => void handleReject(req._id)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (tab === "myContacts") {
      return (
        <>
          <div className="contacts-modal__search">
            <span className="contacts-modal__search-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="text"
              placeholder={t("modals.contacts.friends.searchPlaceholder")}
              value={contactsSearch}
              onChange={(e) => setContactsSearch(e.target.value)}
            />
          </div>
          {filteredFriends.length === 0 ? (
            <EmptyState
              icon={ICONS.contacts}
              title={friendsList.length === 0 ? t("modals.contacts.friends.emptyTitle") : t("modals.contacts.friends.noResultsTitle")}
              sub={
                friendsList.length === 0
                  ? t("modals.contacts.friends.emptySub")
                  : t("modals.contacts.friends.noResultsSub")
              }
            />
          ) : (
            <div className="contacts-modal__list">
              {filteredFriends.map((f, i) => {
                const status = contactStatus(f);
                return (
                  <div key={f._id} className="contacts-modal__row" style={{ animationDelay: `${i * 35}ms` }}>
                    <div className="contacts-modal__avatar-wrap">
                      <Avatar
                        displayName={f.displayName}
                        username={f.username}
                        image={f.image}
                        color={f.color}
                        size={38}
                      />
                      <span className={`contacts-modal__status-dot contacts-modal__status-dot--${status}`} />
                    </div>
                    <div className="contacts-modal__info">
                      <div className="contacts-modal__name">{userLabel(f)}</div>
                      <div className="contacts-modal__meta">
                        {f.username ? `@${f.username}` : t("common.contact")}
                        {" · "}
                        {availabilityStatusLabel(status)}
                      </div>
                    </div>
                    <div className="contacts-modal__actions">
                      <button
                        type="button"
                        className="contacts-modal__pill-btn"
                        onClick={() => {
                          onSelectContact(f);
                          onClose();
                        }}
                      >
                        {t("modals.contacts.invite.write")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      );
    }

    if (tab === "sent") {
      if (sentRequests.length === 0) {
        return (
          <EmptyState
            icon={ICONS.sent}
            title={t("modals.contacts.invite.sentEmptyTitle")}
            sub={t("modals.contacts.invite.sentEmptySub")}
          />
        );
      }
      return (
        <div className="contacts-modal__list">
          {sentRequests.map((req, i) => (
            <div key={req._id} className="contacts-modal__row" style={{ animationDelay: `${i * 40}ms` }}>
              <Avatar
                displayName={req.to?.displayName}
                username={req.to?.username}
                image={req.to?.image ?? null}
                color={req.to?.color}
                size={40}
              />
              <div className="contacts-modal__info">
                <div className="contacts-modal__name">{userLabel(req.to ?? {})}</div>
                <div className="contacts-modal__meta">
                  {req.to?.username ? `@${req.to.username}` : t("common.user")}
                  {t("modals.contacts.invite.pending")}
                </div>
              </div>
              <div className="contacts-modal__actions">
                <button
                  type="button"
                  className="contacts-modal__pill-btn"
                  onClick={() => void handleCancelSent(req._id)}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (tab === "blocked") {
      if (blockedList.length === 0) {
        return (
          <EmptyState
            icon={ICONS.blocked}
            title={t("modals.contacts.blocked.emptyTitle")}
            sub={t("modals.contacts.blocked.emptySub")}
          />
        );
      }
      return (
        <div className="contacts-modal__list">
          {blockedList.map((contact, i) => (
            <div key={contact._id} className="contacts-modal__row" style={{ animationDelay: `${i * 40}ms` }}>
              <Avatar
                displayName={contact.displayName}
                username={contact.username}
                image={contact.image ?? null}
                color={contact.color}
                size={40}
              />
              <div className="contacts-modal__info">
                <div className="contacts-modal__name">{userLabel(contact)}</div>
                <div className="contacts-modal__meta">
                  {contact.username ? `@${contact.username}` : t("common.contact")}
                  {t("modals.contacts.invite.blockedStatus")}
                </div>
              </div>
              <div className="contacts-modal__actions">
                <button
                  type="button"
                  className="contacts-modal__pill-btn"
                  onClick={() => void toggleContactBlock(contact._id).then(() => loadData())}
                >
                  {t("modals.contacts.blocked.unblock")}
                </button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={`klovy-backdrop klovy-backdrop--center${isClosing ? " closing" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("modals.contacts.title")}
    >
      <div className={`klovy-shell contacts-modal${isClosing ? " closing" : ""}`}>
        <div className="contacts-modal__header">
          <div>
            <h2>{t("modals.contacts.title")}</h2>
            <p>{t("modals.contacts.subtitle")}</p>
          </div>
          <button
            type="button"
            className="contacts-modal__close"
            onClick={onClose}
            title={t("common.close")}
            aria-label={t("common.close")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="contacts-modal__tabs-row">
          <div className="contacts-modal__tabs" ref={tabsRef}>
            <div className="contacts-modal__tab-indicator" ref={indicatorRef} />
            {TABS.map((key) => (
              <button
                key={key}
                type="button"
                className={`contacts-modal__tab${tab === key ? " active" : ""}`}
                onClick={() => setTab(key)}
              >
                {tabLabels[key]}
                <span className="contacts-modal__tab-count">{counts[key]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="contacts-modal__body">
          <div className="contacts-modal__main">{renderMain()}</div>

          <div className="contacts-modal__side">
            <div className="contacts-modal__side-label">{t("modals.contacts.invite.label")}</div>
            <div className="contacts-modal__add-field">
              <input
                type="text"
                value={inviteUsername}
                placeholder={t("modals.contacts.invite.placeholder")}
                autoComplete="off"
                className={`contacts-modal__add-input${inviteError ? " contacts-modal__add-input--error" : ""}`}
                onChange={(e) => {
                  setInviteUsername(e.target.value);
                  setInviteError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSendInvite();
                }}
              />
              <button
                type="button"
                className={`contacts-modal__send-btn${inviteSentPulse ? " contacts-modal__send-btn--sent" : ""}`}
                title={t("modals.contacts.invite.send")}
                disabled={inviteSending}
                onClick={() => void handleSendInvite()}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </button>
            </div>
            <p className="contacts-modal__hint">
              {t("modals.contacts.invite.hintExtended")}
            </p>
            {inviteError && (
              <div className="contacts-modal__toast contacts-modal__toast--error contacts-modal__toast--show" role="alert">
                {inviteError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
