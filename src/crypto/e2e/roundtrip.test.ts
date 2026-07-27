/**
 * Roundtrip tests for E2E opaque payloads and channel cipher.
 */
import { describe, expect, it } from "vitest";
import { wrapOpaquePayload, unwrapOpaquePayload } from "./opaquePayload";
import { arrayBufferToBase64 } from "./bufferUtils";
import {
  isChannelEnvelopeContent,
  isE2eCiphertextContent,
  isSignalEnvelopeContent,
  maskUndecryptableMessage,
  readableContentForPreview,
  unwrapIncomingMessage,
} from "../messageContent";
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

describe("E2E envelope detection", () => {
  it("detects channel ciphertext envelopes", () => {
    const wrapped = wrapOpaquePayload(
      JSON.stringify({ keyId: 123, data: "ciphertext==" }),
    );
    expect(isChannelEnvelopeContent(wrapped)).toBe(true);
    expect(readableContentForPreview(wrapped, true)).toBe("");
  });

  it("detects signal ciphertext envelopes", () => {
    const wrapped = wrapOpaquePayload(JSON.stringify({ type: 3, body: "abc" }));
    expect(isSignalEnvelopeContent(wrapped)).toBe(true);
  });

  it("masks undecryptable ciphertext instead of showing raw base64", () => {
    const wrapped = wrapOpaquePayload(
      JSON.stringify({ keyId: 123, data: "ciphertext==" }),
    );
    const masked = maskUndecryptableMessage({
      _id: "1",
      content: wrapped,
      e2eEncrypted: true,
      sender: "user-a",
      timestamp: new Date().toISOString(),
    });
    expect(masked.content).toBe("");
    expect(masked.e2eDecryptFailed).toBe(true);
  });

  it("unwraps opaque transport layer without E2E for display only", () => {
    const wire = wrapOpaquePayload("co tam");
    const unwrapped = unwrapIncomingMessage({
      _id: "2",
      content: wire,
      e2eEncrypted: false,
      sender: "user-a",
      timestamp: new Date().toISOString(),
    });
    expect(unwrapped.content).toBe("co tam");
    expect(wire).not.toBe("co tam");
  });

  it("does not treat opaque transport as E2E ciphertext", () => {
    const wire = wrapOpaquePayload("dupa");
    expect(isE2eCiphertextContent(wire)).toBe(false);
    expect(readableContentForPreview(wire, false)).toBe("dupa");
  });

  it("peels legacy double-wrapped opaque transport", () => {
    const once = wrapOpaquePayload("noo");
    const twice = wrapOpaquePayload(once);
    expect(unwrapIncomingMessage({
      _id: "3",
      content: twice,
      e2eEncrypted: false,
      sender: "user-a",
      timestamp: new Date().toISOString(),
    }).content).toBe("noo");
  });

  it("unwraps short polish text from single opaque layer", () => {
    const wire = wrapOpaquePayload("noo");
    expect(wire).toBe("bm9v");
    expect(unwrapIncomingMessage({
      _id: "4",
      content: wire,
      e2eEncrypted: false,
      sender: "user-a",
      timestamp: new Date().toISOString(),
    }).content).toBe("noo");
  });

  it("does not decode binary blobs into replacement-character garbage", () => {
    // Simulates a server-sealed blob mistaken for client opaque (invalid UTF-8 inner).
    const fakeOpaque = arrayBufferToBase64(new Uint8Array([0xff, 0xfe, 0xfd, 0x00]).buffer);
    const result = unwrapIncomingMessage({
      _id: "5",
      content: fakeOpaque,
      e2eEncrypted: false,
      sender: "user-a",
      timestamp: new Date().toISOString(),
    }).content;
    expect(result).toBe(fakeOpaque);
    expect(result).not.toContain("\uFFFD");
  });

  it("does not false-positive unwrap plaintext that merely looks like base64", () => {
    const plain = "cycki";
    expect(unwrapIncomingMessage({
      _id: "6",
      content: plain,
      e2eEncrypted: false,
      sender: "user-a",
      timestamp: new Date().toISOString(),
    }).content).toBe(plain);
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
