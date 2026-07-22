export interface SenderKeyStoredDetail {
  channelId: string;
  senderId: string;
}

const SENDER_KEY_STORED = "klovy:e2e-sender-key-stored";

export function onSenderKeyStored(
  listener: (detail: SenderKeyStoredDetail) => void,
): () => void {
  const handler = (event: Event) => {
    listener((event as CustomEvent<SenderKeyStoredDetail>).detail);
  };
  window.addEventListener(SENDER_KEY_STORED, handler);
  return () => window.removeEventListener(SENDER_KEY_STORED, handler);
}

export function emitSenderKeyStored(detail: SenderKeyStoredDetail) {
  window.dispatchEvent(new CustomEvent(SENDER_KEY_STORED, { detail }));
}
