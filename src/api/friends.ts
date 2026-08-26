// friends.ts
// HTTP zaproszeń i blokad.
// Zakres:
//  - UI DM dodatkowo ufa friendsCache, żeby composer nie migał
//  - invite/accept/block; po mutacji patch friendsCache
// Zmiana relacji: inwaliduj cache znajomych (FE i BE typing cache).
// Przy zmianach: friendsCache.ts, controllers/friends.rs.

import { apiRequest } from "./client";
import type { Contact, FriendRequestItem } from "../types";

export function sendFriendRequest(username: string) {
  return apiRequest<{
    message: string;
    autoAccepted?: boolean;
    friend?: Contact;
    request?: FriendRequestItem;
  }>("/api/friends/send", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function getReceivedFriendRequests() {
  return apiRequest<{ requests: FriendRequestItem[] }>("/api/friends/received");
}

export function getSentFriendRequests() {
  return apiRequest<{ requests: FriendRequestItem[] }>("/api/friends/sent");
}

export function getFriends() {
  return apiRequest<{ friends: Contact[] }>("/api/friends/list");
}

export function acceptFriendRequest(requestId: string) {
  return apiRequest<{ message: string; friend: Contact }>(
    `/api/friends/${requestId}/accept`,
    { method: "POST" },
  );
}

export function rejectFriendRequest(requestId: string) {
  return apiRequest<{ message: string }>(`/api/friends/${requestId}/reject`, {
    method: "POST",
  });
}

export function cancelFriendRequest(requestId: string) {
  return apiRequest<{ message: string }>(`/api/friends/${requestId}/cancel`, {
    method: "POST",
  });
}

export function checkFriendship(otherUserId: string) {
  return apiRequest<{
    isFriend: boolean;
    isBlockedByMe?: boolean;
    isBlockedByOther?: boolean;
    isDmBlocked?: boolean;
    pendingRequest: { direction: "incoming" | "outgoing"; requestId: string } | null;
  }>(`/api/friends/status/${otherUserId}`);
}

export function removeFriend(friendUserId: string) {
  return apiRequest<{ message: string }>(`/api/friends/${friendUserId}`, {
    method: "DELETE",
  });
}
