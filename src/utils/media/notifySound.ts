// notifySound.ts
// Pinging nowej wiadomości (nie przy mute, DND, focus otwartego czatu).
// Zakres:
//  - Sidebar / powłoka
//  - ping nowej wiadomości; mute SoT = muted.ts
// Mute SoT = muted.ts, nie prop z HTTP.
// Przy zmianach: muted.ts, Sidebar.tsx.

const NOTIFICATION_SOUND_URL = "/assets/notification.mp3";

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!audio) {
    audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.preload = "auto";
    audio.volume = 0.5;
  }
  return audio;
}

export function playNotificationSound(): void {
  const a = getAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {

  }
}
