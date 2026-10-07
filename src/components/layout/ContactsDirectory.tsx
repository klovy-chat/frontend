import { LoadingSkeleton } from "../common/LoadingSkeleton";
import { useEffect, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getFriends } from "../../api/friends";
import { Avatar } from "../common/Avatar";
import { userLabel, formatLastSeen } from "../../utils/user/format";
import { useUserPresence } from "../../context/PresenceContext";
import type { Contact } from "../../types";
import "../../styles/contacts/directory.css";
function Row({ contact, onSelect }: { contact: Contact; onSelect: (contact: Contact) => void }) {
  const { t } = useTranslation();
  const presence = useUserPresence(contact._id);
  const online = presence?.isOnline ?? contact.isOnline;
  return <div className="contacts-directory__row"><div className="contacts-directory__avatar"><Avatar displayName={contact.displayName} username={contact.username} image={contact.image} color={contact.color} size={40} />{(presence?.isOnline ?? contact.isOnline) && <span />}</div><div className="contacts-directory__identity"><strong>{userLabel(contact)}</strong><div className="contacts-directory__name-line"><span>{contact.username ? `@${contact.username}` : ""}</span><span className={online ? "contacts-directory__presence contacts-directory__presence--online" : "contacts-directory__presence"}>{formatLastSeen(presence?.lastSeen ?? contact.lastSeen, { isOnline: online, blocked: contact.isBlockedByMe })}</span></div></div><button type="button" onClick={() => onSelect(contact)}>{t("modals.contacts.invite.write")}</button></div>;
}
export function ContactsDirectory({ onAdd, onSelect, revision }: { onAdd: () => void; onSelect: (contact: Contact) => void; revision: number }) {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => { let cancelled = false; setLoading(true); setFailed(false); void getFriends().then(result => { if (!cancelled) setContacts(result.friends); }).catch(() => { if (!cancelled) setFailed(true); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [revision]);
  const filtered = contacts.filter(contact => `${userLabel(contact)} ${contact.username ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section className="contacts-directory"><header><div><h1>{t("nav.items.contacts")}</h1><p>{t("contactsDirectory.subtitle")}</p></div><div className="contacts-directory__header-actions"><span>{loading ? "…" : failed ? "—" : contacts.length} {t("chat.home.contacts")}</span><button type="button" onClick={onAdd}><UserPlus size={16} />{t("contactsDirectory.add")}</button></div></header><label className="contacts-directory__search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("contactsDirectory.search")} aria-label={t("contactsDirectory.search")} /></label>{loading && <LoadingSkeleton label={t("contactsDirectory.loading")} />}{failed && <p role="alert">{t("contactsDirectory.error")}</p>}{!loading && !failed && filtered.length === 0 && <p>{t("contactsDirectory.empty")}</p>}{filtered.map(contact => <Row key={contact._id} contact={contact} onSelect={onSelect} />)}</section>;
}
