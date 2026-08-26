// protocol.ts
// Nazwy typów ramek WS { type, payload }.
// Zakres:
//  - kontrakt z serwerem, bez logiki
//  - same stringi type; payload buduje socketPayload.ts
// Zmiana stringa type to breaking change obu stron.
// Przy zmianach: api/ws.ts, ws/handlers.rs.

export const WsType = {

  SEND_MESSAGE: "sendMessage",
  SEND_CHANNEL_MESSAGE: "send-channel-message",
  EDIT_MESSAGE: "editMessage",
  DELETE_MESSAGE: "deleteMessage",
  MESSAGE_REACTION: "message-reaction",
  TYPING: "typing",
  MARK_MESSAGE_READ: "mark-message-read",
  MARK_CONVERSATION_READ: "mark-conversation-read",
  MARK_CHANNEL_READ: "mark-channel-read",
  SET_ONLINE: "set-online",
  SET_OFFLINE: "set-offline",
  SET_STATUS: "set-status",
  CALL_INVITE: "call:invite",
  CALL_ACCEPT: "call:accept",
  CALL_REJECT: "call:reject",
  CALL_CANCEL: "call:cancel",
  CALL_END: "call:end",
  CALL_TIMEOUT: "call:timeout",
  CHANNEL_VOICE_JOIN: "channel-voice:join",
  CHANNEL_VOICE_LEAVE: "channel-voice:leave",
  CHANNEL_VOICE_STATE: "channel-voice:state",

  RECEIVE_MESSAGE: "receiveMessage",
  RECEIVE_CHANNEL_MESSAGE: "receive-channel-message",
  MESSAGE_EDITED: "message-edited",
  MESSAGE_DELETED: "message-deleted",
  MESSAGE_READ: "message-read",
  MESSAGES_READ: "messages-read",
  DM_ERROR: "dm-error",
  UNREAD_UPDATED: "unread-updated",
  USER_STATUS_CHANGED: "user-status-changed",
  MESSAGE_MENTION: "message-mention",
  PROFILE_UPDATED: "profile-updated",
  CONTACT_PROFILE_UPDATED: "contact-profile-updated",
  PROFILE_IMAGE_UPDATED: "profile-image-updated",
  CONTACT_AVATAR_UPDATED: "contact-avatar-updated",
  PROFILE_BANNER_UPDATED: "profile-banner-updated",
  CONTACT_BANNER_UPDATED: "contact-banner-updated",
  CHANNEL_ADDED: "channel-added",
  CHANNEL_LEFT: "channel-left",
  CHANNEL_MEMBER_LEFT: "channel-member-left",
  CHANNEL_MEMBER_JOINED: "channel-member-joined",
  CHANNEL_NAME_UPDATED: "channel-name-updated",
  CHANNEL_SLOWMODE_UPDATED: "channel-slowmode-updated",
  CHANNEL_CHAT_LOCKED_UPDATED: "channel-chat-locked-updated",
  CHANNEL_MODERATION_UPDATED: "channel-moderation-updated",
  CHANNEL_AVATAR_UPDATED: "channel-avatar-updated",
  CHANNEL_DELETED: "channel-deleted",
  CONVERSATION_DELETED: "conversation-deleted",
  FRIENDSHIP_REMOVED: "friendship-removed",
  FRIENDSHIP_ADDED: "friendship-added",
  USER_WARNED: "user:warned",
  USER_WARNING_REVOKED: "user:warning-revoked",
  CONTACT_BLOCK_UPDATED: "contact-block-updated",
  CALL_INCOMING: "call:incoming",
  CALL_ACCEPTED: "call:accepted",
  CALL_REJECTED: "call:rejected",
  CALL_CANCELLED: "call:cancelled",
  CALL_ENDED: "call:ended",
  CALL_UNAVAILABLE: "call:unavailable",
  SESSION_REVOKED: "session:revoked",
  WHITELIST_APPROVED: "whitelist:approved",
  ANNOUNCEMENT_PUBLISHED: "announcement:published",
  ERROR: "error",

  PING: "ping",
  PONG: "pong",
} as const;

export interface WsFrame {
  type: string;
  payload?: unknown;
}
