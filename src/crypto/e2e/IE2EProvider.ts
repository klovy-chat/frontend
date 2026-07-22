import type { Message } from "../../types";
import type { WebSocketClient } from "../../api/ws";
import type { E2ECapabilityMap, E2EEncryptResult } from "./types";

export interface IE2EProvider {
  refreshStatus(): Promise<{
    enabled: boolean;
    hasKeys: boolean;
    fingerprint?: string;
  }>;
  setCurrentUserId(userId: string | null): void;
  isEnabled(): boolean;
  getFingerprint(): string | null;
  enable(userId: string): Promise<void>;
  disable(): Promise<void>;
  resetKeys(): Promise<void>;
  loadCapabilities(userIds: string[]): Promise<E2ECapabilityMap>;
  peerSupportsE2e(cap: E2ECapabilityMap, peerId: string): boolean;
  shouldEncryptDm(peerId: string, cap: E2ECapabilityMap): boolean;
  encryptOutgoingDm(peerId: string, plaintext: string): Promise<E2EEncryptResult>;
  encryptOutgoingChannel(
    channelId: string,
    senderId: string,
    plaintext: string,
    memberIds: string[],
    ws: WebSocketClient | null,
    cap: E2ECapabilityMap,
  ): Promise<E2EEncryptResult | null>;
  handleSenderKeyEvent(payload: {
    senderId?: string;
    channelId?: string;
    distributionMessage?: string;
  }): Promise<void>;
  decryptMessage(message: Message, currentUserId: string): Promise<Message>;
  decryptMessages(messages: Message[], currentUserId: string): Promise<Message[]>;
}
