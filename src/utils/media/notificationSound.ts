// notificationSound.ts
// Lekki helper do odtwarzania dźwięku powiadomienia o nowej wiadomości.
// Plik audio leży w public/ i jest serwowany pod /assets/notification.mp3.
// Korzystamy z jednego współdzielonego elementu Audio, aby nie tworzyć
// nowego obiektu przy każdej wiadomości.

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

/**
 * Odtwarza dźwięk powiadomienia. Błędy (np. blokada autoplay zanim
 * użytkownik wejdzie w interakcję ze stroną) są celowo wyciszane —
 * brak dźwięku nie powinien przerywać działania aplikacji.
 */
export function playNotificationSound(): void {
  const a = getAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {
    /* ignorujemy — dźwięk jest opcjonalny */
  }
}
