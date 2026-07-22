import type { Message } from "../../types";
import type { WebSocketClient } from "../../api/ws";
import type { E2ECapabilityMap } from "./types";
import { SignalE2EProvider } from "./signal/SignalE2EProvider";
import { onIdentityChange } from "./signal/identityTrust";
import type { E2eAttachmentMeta } from "./signal/attachmentCipher";

const provider = new SignalE2EProvider();

export { onIdentityChange };

export const e2eService = {
  refreshStatus: () => provider.refreshStatus(),
  setCurrentUserId: (userId: string | null) => provider.setCurrentUserId(userId),
  isEnabled: () => provider.isEnabled(),
  getFingerprint: () => provider.getFingerprint(),
  getPeerFingerprint: (peerId: string) => provider.getPeerFingerprint(peerId),
  enable: (userId: string) => provider.enable(userId),
  disable: () => provider.disable(),
  resetKeys: () => provider.resetKeys(),
  getClearKeysOnLogout: () => provider.getClearKeysOnLogout(),
  setClearKeysOnLogout: (enabled: boolean) => provider.setClearKeysOnLogout(enabled),
  clearLocalKeysOnLogout: () => provider.clearLocalKeysOnLogout(),
  loadCapabilities: (userIds: string[]) => provider.loadCapabilities(userIds),
  peerSupportsE2e: (cap: E2ECapabilityMap, peerId: string) =>
    provider.peerSupportsE2e(cap, peerId),
  shouldEncryptDm: (peerId: string, cap: E2ECapabilityMap) =>
    provider.shouldEncryptDm(peerId, cap),
  encryptOutgoingDm: (peerId: string, plaintext: string) =>
    provider.encryptOutgoingDm(peerId, plaintext),
  encryptOutgoingChannel: (
    channelId: string,
    senderId: string,
    plaintext: string,
    memberIds: string[],
    ws: WebSocketClient | null,
    cap: E2ECapabilityMap,
  ) =>
    provider.encryptOutgoingChannel(
      channelId,
      senderId,
      plaintext,
      memberIds,
      ws,
      cap,
    ),
  onChannelMembersChanged: (
    channelId: string,
    senderId: string,
    memberIds: string[],
    ws: WebSocketClient | null,
    cap: E2ECapabilityMap,
  ) => provider.onChannelMembersChanged(channelId, senderId, memberIds, ws, cap),
  encryptOutgoingAttachment: (
    target:
      | { kind: "dm"; peerId: string; cap: E2ECapabilityMap }
      | {
          kind: "channel";
          channelId: string;
          senderId: string;
          memberIds: string[];
          cap: E2ECapabilityMap;
          ws: WebSocketClient | null;
        },
    file: File,
  ) => provider.encryptOutgoingAttachment(target, file),
  decryptAttachmentBlob: (fileUrl: string, meta: E2eAttachmentMeta) =>
    provider.decryptAttachmentBlob(fileUrl, meta),
  handleSenderKeyEvent: (payload: {
    senderId?: string;
    channelId?: string;
    distributionMessage?: string;
  }) => provider.handleSenderKeyEvent(payload),
  decryptMessage: (message: Message, currentUserId: string) =>
    provider.decryptMessage(message, currentUserId),
  decryptMessages: (messages: Message[], currentUserId: string) =>
    provider.decryptMessages(messages, currentUserId),
};
