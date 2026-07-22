/**
 * Roundtrip tests for E2E opaque payloads and channel cipher.
 */
import { describe, expect, it } from "vitest";
import { wrapOpaquePayload, unwrapOpaquePayload } from "./opaquePayload";
import {
  decryptChannelMessage,
  encryptChannelMessage,
} from "./signal/channelCipher";

describe("opaque payload wrap", () => {
  it("roundtrips JSON envelopes as base64 for server storage", () => {
    const inner = JSON.stringify({ type: 3, body: "abc123" });
    const wrapped = wrapOpaquePayload(inner);
    expect(wrapped).not.toContain("{");
    expect(unwrapOpaquePayload(wrapped)).toBe(inner);
  });
});

describe("channel E2E roundtrip", () => {
  it("encrypts and decrypts channel text", async () => {
    const channelId = "channel-test-1";
    const senderId = "user-a";
    const plaintext = "hello encrypted channel";

    const encrypted = await encryptChannelMessage(channelId, senderId, plaintext);

    const decrypted = await decryptChannelMessage(
      channelId,
      senderId,
      encrypted.content,
    );
    expect(decrypted).toBe(plaintext);
  });
});
