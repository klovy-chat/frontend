import { apiRequest } from "./client";
import type { Contact } from "../types";

export function getContactsForList() {
  return apiRequest<{ contacts: Contact[] }>(
    "/api/contacts/get-contacts-for-list",
  );
}

export function searchContacts(searchTerm: string) {
  return apiRequest<{ contacts: Contact[] }>("/api/contacts/search", {
    method: "POST",
    body: JSON.stringify({ searchTerm }),
  });
}

export function toggleContactMute(contactId: string) {
  return apiRequest<{ isMuted: boolean; message: string }>(
    `/api/contacts/${contactId}/mute`,
    { method: "POST" },
  );
}

export function getBlockedContacts() {
  return apiRequest<{ contacts: Contact[] }>("/api/contacts/blocked");
}

export function toggleContactBlock(contactId: string) {
  return apiRequest<{ isBlocked: boolean; message: string }>(
    `/api/contacts/${contactId}/block`,
    { method: "POST" },
  );
}
