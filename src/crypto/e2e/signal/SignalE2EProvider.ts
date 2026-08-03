import type { Message } from "../../../types";
import type { WebSocketClient } from "../../../api/ws";
import { WsType } from "../../../api/wsProtocol";
import type { IE2EProvider } from "../IE2EProvider";
import type { E2ECapabilityMap, E2EEncryptResult } from "../types";
import { E2E_VERSION_CHANNEL } from "../types";
import {
  buildSenderKeyDistribution,
  decryptChannelMessage,
  encryptChannelMessage,
  getOrCreateOwnSenderKey,
  rotateChannelSenderKey,
  storeReceivedSenderKey,
} from "./channelCipher";
import { emitSenderKeyStored } from "./events";
import {
  decryptFileFromE2e,
  encryptFileForE2e,
  isE2eAttachmentMeta,
  type E2eAttachmentMeta,
} from "./attachmentCipher";
import {
  rememberSentE2ePlaintext,
  resolveSentE2ePlaintext,
} from "../sentPlaintextCache";
import { unwrapOpaquePayload } from "../opaquePayload";
import {
  isChannelEnvelopeContent,
  isE2eCiphertextContent,
  isSignalEnvelopeContent,
} from "../../messageContent";
import { fetchMediaResource } from "../../../utils/media/media";
import {
  decryptDm,
  decryptDistributionPayload,
  encryptDistributionPayload,
  encryptDm,
  generateAndUploadKeyBundle,
  replenishPreKeysIfNeeded,
} from "./dmCipher";
import { clearE2eStore, hasLocalE2eKeys } from "./signalStore";
import {
  clearLocalKeysIfConfigured,
  getClearKeysOnLogout,
  setClearKeysOnLogout,
} from "./identityTrust";
import {
  deleteE2eKeys,
  fetchE2eCapabilities,
  fetchPeerFingerprint,
  getE2eStatus,
  patchE2eSettings,
  type E2eCapability,
} from "./prekeyClient";

export class SignalE2EProvider implements IE2EProvider {
  private enabled = false;
  private hasKeys = false;
  private fingerprint: string | null = null;
  private capabilityCache = new Map<string, E2eCapability>();
  private channelMemberSnapshot = new Map<string, string>();

  private memberSnapshotKey(memberIds: string[]): string {
    return [...memberIds].sort().join(",");
  }

  async getClearKeysOnLogout(): Promise<boolean> {
    return getClearKeysOnLogout();
  }

  async setClearKeysOnLogout(enabled: boolean): Promise<void> {
    await setClearKeysOnLogout(enabled);
  }

  async clearLocalKeysOnLogout(): Promise<void> {
    await clearLocalKeysIfConfigured();
    this.enabled = false;
    this.hasKeys = false;
    this.fingerprint = null;
  }

  async onChannelMembersChanged(
    channelId: string,
    senderId: string,
    memberIds: string[],
    ws: WebSocketClient | null,
    cap: E2ECapabilityMap,
  ): Promise<void> {
    if (!this.hasKeys) return;
    const snapshot = this.memberSnapshotKey(memberIds);
    const prev = this.channelMemberSnapshot.get(channelId);
    this.channelMemberSnapshot.set(channelId, snapshot);
    if (!prev || prev === snapshot) return;

    const rotated = await rotateChannelSenderKey(channelId, senderId);
    const distribution = buildSenderKeyDistribution({
      channelId,
      senderId,
      keyId: rotated.keyId,
      key: rotated.key,
    });
    const e2eMembers = memberIds.filter(
      (id) => id !== senderId && this.peerSupportsE2e(cap, id),
    );
    if (!ws || e2eMembers.length === 0) return;
    await Promise.all(
      e2eMembers.map(async (recipientId) => {
        try {
          const distributionMessage = await encryptDistributionPayload(
            recipientId,
            distribution,
          );
          ws.send(WsType.E2E_SENDER_KEY, {
            sender: senderId,
            recipientId,
            channelId,
            distributionMessage,
          });
        } catch {
          /**/
        }
      }),
    );
  }

  async encryptOutgoingAttachment(
    target:
      | { kind: "dm"; peerId: string; cap: E2ECapabilityMap }
      | { kind: "channel"; channelId: string; senderId: string; memberIds: string[]; cap: E2ECapabilityMap; ws: WebSocketClient | null },
    file: File,
  ): Promise<{ encryptedFile: Blob; wsPayload: E2EEncryptResult; fileName: string } | null> {
    if (!this.isEnabled() || !this.hasKeys) return null;

    const packed = await encryptFileForE2e(file);
    if (target.kind === "dm") {
      if (!this.shouldEncryptDm(target.peerId, target.cap)) return null;
      const wsPayload = await this.encryptOutgoingDm(target.peerId, packed.innerContent);
      return { encryptedFile: packed.encryptedBlob, wsPayload, fileName: file.name };
    }

    if (!this.shouldEncryptChannel(target.senderId, target.memberIds, target.cap)) {
      return null;
    }

    const wsPayload = await this.encryptOutgoingChannel(
      target.channelId,
      target.senderId,
      packed.innerContent,
      target.memberIds,
      target.ws,
      target.cap,
    );
    if (!wsPayload) return null;
    return { encryptedFile: packed.encryptedBlob, wsPayload, fileName: file.name };
  }

  async decryptAttachmentBlob(
    fileUrl: string,
    meta: E2eAttachmentMeta,
  ): Promise<Blob> {
    const response = await fetchMediaResource(fileUrl);
    if (!response.ok) throw new Error("E2E_ATTACHMENT_FETCH_FAILED");
    const encrypted = await response.arrayBuffer();
    return decryptFileFromE2e(encrypted, meta);
  }

  async refreshStatus() {
    const status = await getE2eStatus();
    this.enabled = status.enabled;
    this.hasKeys = status.hasKeys || (await hasLocalE2eKeys());
    this.fingerprint = status.fingerprint ?? null;
    if (status.oneTimePreKeysRemaining !== undefined) {
      void replenishPreKeysIfNeeded(status.oneTimePreKeysRemaining);
    }
    return status;
  }

  setCurrentUserId(_userId: string | null) {
    /** tracked by e2eService callers when enabling keys */
  }

  isEnabled(): boolean {
    return this.enabled && this.hasKeys;
  }

  /** Whether this device can encrypt outgoing messages (independent of the E2E settings toggle). */
  canEncryptOutgoing(): boolean {
    return this.hasKeys;
  }

  async canDecryptMessages(): Promise<boolean> {
    if (this.isEnabled()) return true;
    try {
      return await hasLocalE2eKeys();
    } catch {
      return false;
    }
  }

  getFingerprint(): string | null {
    return this.fingerprint;
  }

  async getPeerFingerprint(peerId: string): Promise<string | null> {
    const cached = this.capabilityCache.get(peerId)?.fingerprint;
    if (cached) return cached;
    try {
      const { fingerprint } = await fetchPeerFingerprint(peerId);
      return fingerprint ?? null;
    } catch {
      return null;
    }
  }

  clearCapabilityCache(): void {
    this.capabilityCache.clear();
  }

  async enable(userId: string): Promise<void> {
    this.setCurrentUserId(userId);
    const fingerprint = await generateAndUploadKeyBundle();
    await patchE2eSettings(true);
    this.enabled = true;
    this.hasKeys = true;
    this.fingerprint = fingerprint;
    this.capabilityCache.clear();
  }

  /** Prepare local E2E keys when the user opted in — auto-generates keys if enabled server-side. */
  async ensureReady(userId: string): Promise<void> {
    this.setCurrentUserId(userId);
    const status = await getE2eStatus();
    this.enabled = status.enabled;

    if (status.enabled && !(await hasLocalE2eKeys())) {
      const fingerprint = await generateAndUploadKeyBundle();
      this.hasKeys = true;
      this.fingerprint = fingerprint;
      return;
    }

    if (!(await hasLocalE2eKeys())) {
      this.hasKeys = false;
      return;
    }

    this.hasKeys = true;
    this.fingerprint = status.fingerprint ?? this.fingerprint;
    if (!status.hasKeys) {
      this.fingerprint = await generateAndUploadKeyBundle();
    }
  }

  async disable(): Promise<void> {
    await patchE2eSettings(false);
    this.enabled = false;
    this.capabilityCache.clear();
  }

  async resetKeys(): Promise<void> {
    await deleteE2eKeys();
    await clearE2eStore();
    this.hasKeys = false;
    this.fingerprint = null;
    this.enabled = false;
    this.capabilityCache.clear();
  }

  async loadCapabilities(
    userIds: string[],
    options?: { force?: boolean },
  ): Promise<E2ECapabilityMap> {
    if (options?.force) {
      for (const id of userIds) {
        this.capabilityCache.delete(id);
      }
    }
    const missing = userIds.filter((id) => !this.capabilityCache.has(id));
    if (missing.length > 0) {
      const { users } = await fetchE2eCapabilities(missing);
      for (const row of users) {
        this.capabilityCache.set(row.userId, row);
      }
    }
    const out: E2ECapabilityMap = {};
    for (const id of userIds) {
      const row = this.capabilityCache.get(id);
      if (row) {
        out[id] = {
          e2eEnabled: row.e2eEnabled,
          hasKeys: row.hasKeys,
          fingerprint: row.fingerprint,
        };
      }
    }
    return out;
  }

  async requestChannelSenderKeys(
    channelId: string,
    requesterId: string,
    memberIds: string[],
    ws: WebSocketClient,
  ): Promise<void> {
    if (!this.hasKeys) return;
    const targetUserIds = memberIds.filter((id) => id !== requesterId);
    if (targetUserIds.length === 0) return;
    ws.send(WsType.E2E_SENDER_KEY_REQUEST, {
      requesterId,
      channelId,
      targetUserIds,
    });
  }

  async handleSenderKeyRequest(
    payload: { channelId?: string; requesterId?: string },
    ws: WebSocketClient,
    ourUserId: string,
  ): Promise<void> {
    if (!this.hasKeys || !payload.channelId || !payload.requesterId) return;
    if (payload.requesterId === ourUserId) return;

    try {
      const senderKey = await getOrCreateOwnSenderKey(payload.channelId, ourUserId);
      const distribution = buildSenderKeyDistribution({
        channelId: payload.channelId,
        senderId: ourUserId,
        keyId: senderKey.keyId,
        key: senderKey.key,
      });
      const distributionMessage = await encryptDistributionPayload(
        payload.requesterId,
        distribution,
      );
      ws.send(WsType.E2E_SENDER_KEY, {
        sender: ourUserId,
        recipientId: payload.requesterId,
        channelId: payload.channelId,
        distributionMessage,
      });
    } catch {
      /**/
    }
  }

  peerSupportsE2e(cap: E2ECapabilityMap, peerId: string): boolean {
    const peer = cap[peerId];
    return Boolean(peer?.e2eEnabled && peer?.hasKeys);
  }

  shouldEncryptDm(peerId: string, cap: E2ECapabilityMap): boolean {
    return this.isEnabled() && this.peerSupportsE2e(cap, peerId);
  }

  shouldEncryptChannel(senderId: string, memberIds: string[], cap: E2ECapabilityMap): boolean {
    if (!this.isEnabled() || !this.hasKeys) return false;
    return memberIds.some(
      (id) => id !== senderId && this.peerSupportsE2e(cap, id),
    );
  }

  async encryptOutgoingDm(peerId: string, plaintext: string): Promise<E2EEncryptResult> {
    const result = await encryptDm(peerId, plaintext);
    rememberSentE2ePlaintext(result.content, plaintext);
    return {
      content: result.content,
      e2eEncrypted: true,
      e2eVersion: result.e2eVersion,
    };
  }

  async encryptOutgoingChannel(
    channelId: string,
    senderId: string,
    plaintext: string,
    memberIds: string[],
    ws: WebSocketClient | null,
    cap: E2ECapabilityMap,
  ): Promise<E2EEncryptResult | null> {
    if (!this.shouldEncryptChannel(senderId, memberIds, cap)) return null;
    const e2eMembers = memberIds.filter(
      (id) => id !== senderId && this.peerSupportsE2e(cap, id),
    );

    const encrypted = await encryptChannelMessage(channelId, senderId, plaintext);
    const distribution = buildSenderKeyDistribution({
      channelId,
      senderId,
      keyId: encrypted.keyId,
      key: encrypted.key,
    });

    if (ws && e2eMembers.length > 0) {
      await Promise.all(
        e2eMembers.map(async (recipientId) => {
          try {
            const distributionMessage = await encryptDistributionPayload(
              recipientId,
              distribution,
            );
            ws.send(WsType.E2E_SENDER_KEY, {
              sender: senderId,
              recipientId,
              channelId,
              distributionMessage,
            });
          } catch {
            /**/
          }
        }),
      );
    }

    rememberSentE2ePlaintext(encrypted.content, plaintext);
    return {
      content: encrypted.content,
      e2eEncrypted: true,
      e2eVersion: encrypted.e2eVersion,
    };
  }

  async handleSenderKeyEvent(payload: {
    senderId?: string;
    channelId?: string;
    distributionMessage?: string;
  }): Promise<void> {
    if (!payload.senderId || !payload.channelId || !payload.distributionMessage) {
      return;
    }
    try {
      const decoded = (await decryptDistributionPayload(
        payload.senderId,
        payload.distributionMessage,
      )) as {
        channelId?: string;
        senderId?: string;
        keyId?: number;
        key?: string;
      };
      if (
        !decoded.channelId ||
        !decoded.senderId ||
        typeof decoded.keyId !== "number" ||
        !decoded.key
      ) {
        return;
      }
      await storeReceivedSenderKey({
        channelId: decoded.channelId,
        senderId: decoded.senderId,
        keyId: decoded.keyId,
        key: decoded.key,
      });
      emitSenderKeyStored({
        channelId: decoded.channelId,
        senderId: decoded.senderId,
      });
    } catch {
      /**/
    }
  }

  async decryptMessage(message: Message, currentUserId: string): Promise<Message> {
    const encrypted = looksLikeEncryptedMessage(message);
    if (!encrypted) return message;

    const normalized = message.e2eEncrypted
      ? message
      : { ...message, e2eEncrypted: true };

    const senderId =
      typeof normalized.sender === "string"
        ? normalized.sender
        : normalized.sender._id ?? normalized.sender.id;
    if (!senderId) return { ...normalized, content: "[encrypted]" };

    const isOwn = senderId === currentUserId;
    if (isOwn) {
      const cached = await resolveSentE2ePlaintext(normalized._id, normalized.content);
      if (cached) {
        return { ...normalized, content: cached, ...this.applyAttachmentMeta(cached, normalized) };
      }
    }

    try {
      let plaintext: string;
      if (
        normalized.e2eVersion === E2E_VERSION_CHANNEL ||
        normalized.channelId ||
        normalized.channel ||
        isChannelEnvelopeContent(normalized.content)
      ) {
        const channelId = normalized.channelId ?? normalized.channel ?? "";
        plaintext = await decryptChannelMessage(channelId, senderId, normalized.content);
      } else {
        plaintext = await decryptDm(senderId, normalized.content);
      }
      return {
        ...normalized,
        content: plaintext,
        ...this.applyAttachmentMeta(plaintext, normalized),
      };
    } catch {
      if (isOwn) {
        const cached = await resolveSentE2ePlaintext(normalized._id, normalized.content);
        if (cached) {
          return { ...normalized, content: cached, ...this.applyAttachmentMeta(cached, normalized) };
        }
      }
      const fallback = tryNonE2eOpaqueFallback(normalized.content);
      if (fallback) {
        return { ...normalized, content: fallback, e2eEncrypted: false };
      }
      return {
        ...normalized,
        content: "",
        e2eDecryptFailed: true,
      };
    }
  }

  async decryptMessages(messages: Message[], currentUserId: string): Promise<Message[]> {
    return Promise.all(messages.map((m) => this.decryptMessage(m, currentUserId)));
  }

  private applyAttachmentMeta(plaintext: string, message: Message): Partial<Message> {
    try {
      const parsed = JSON.parse(plaintext) as unknown;
      if (!isE2eAttachmentMeta(parsed)) return {};
      return {
        content: parsed.fileName,
        fileName: parsed.fileName,
        fileType: parsed.fileType,
        e2eAttachment: {
          _e2eAttachment: true,
          fileName: parsed.fileName,
          fileType: parsed.fileType,
          fileKey: parsed.fileKey,
          fileIv: parsed.fileIv,
        },
        fileUrl: message.fileUrl,
      };
    } catch {
      return {};
    }
  }
}

function looksLikeEncryptedMessage(message: Message): boolean {
  return isE2eCiphertextContent(message.content);
}

function tryNonE2eOpaqueFallback(content: string): string | null {
  try {
    const inner = unwrapOpaquePayload(content);
    if (!inner || inner === content) return null;
    if (isSignalEnvelopeContent(content) || isChannelEnvelopeContent(content)) {
      return null;
    }
    return inner;
  } catch {
    return null;
  }
}
