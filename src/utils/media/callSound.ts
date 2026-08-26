// callSound.ts
// Dźwięk ringtone; stop przy accept/reject; szacunek DND.
// Zakres:
//  - IncomingCall
//  - ringtone; stop przy accept/reject; szacunek DND
// Nowy plik audio: public/ + ten loader.
// Przy zmianach: IncomingCall.tsx, presence (dnd).

const INCOMING_CALL_SOUND_URL = "/assets/call-incoming.mp3";

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!audio) {
    audio = new Audio(INCOMING_CALL_SOUND_URL);
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = 0.65;
  }
  return audio;
}

export function startIncomingCallSound(): void {
  const a = getAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {

  }
}

export function stopIncomingCallSound(): void {
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch {
    /* ignore */
  }
}
