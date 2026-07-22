import { setCurve } from "@privacyresearch/libsignal-protocol-typescript";
import { AsyncCurve25519Wrapper } from "@privacyresearch/curve25519-typescript";

let initialized = false;

export async function ensureSignalInit(): Promise<void> {
  if (initialized) return;
  setCurve(new AsyncCurve25519Wrapper());
  initialized = true;
}
