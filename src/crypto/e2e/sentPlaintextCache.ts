import { idbGet, idbPut } from "./signal/e2eDb";

const byContent = new Map<string, string>();
const byMessageId = new Map<string, string>();

export function rememberSentE2ePlaintext(
  encryptedContent: string,
  plaintext: string,
): void {
  byContent.set(encryptedContent.trim(), plaintext);
}

export async function resolveSentE2ePlaintext(
  messageId: string | undefined,
  encryptedContent: string,
): Promise<string | null> {
  const trimmed = encryptedContent.trim();

  if (messageId) {
    const mem = byMessageId.get(messageId);
    if (mem) return mem;
    const stored = await idbGet<string>("meta", `sentPt:${messageId}`);
    if (stored) {
      byMessageId.set(messageId, stored);
      return stored;
    }
  }

  const pending = byContent.get(trimmed);
  if (pending && messageId) {
    byMessageId.set(messageId, pending);
    byContent.delete(trimmed);
    await idbPut("meta", `sentPt:${messageId}`, pending);
    return pending;
  }

  return pending ?? null;
}
