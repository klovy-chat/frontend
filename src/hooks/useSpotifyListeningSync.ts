import { useEffect, useRef } from "react";
import { getSpotifyStatus, syncSpotifyListening } from "../api/integrations";
import { useAuth } from "../context/AuthContext";
import { getClientInstanceId } from "../utils/env/clientInstanceId";
import { SPOTIFY_CONNECTION_CHANGED } from "../utils/sync/spotifyConnectionSync";
import type { ListeningActivity, User } from "../types";

const SYNC_INTERVAL_MS = 8000;

export function useSpotifyListeningSync(): void {
  const { user, updateUser } = useAuth();
  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const connectedRef = useRef(false);
  const shareRef = useRef(true);
  const enabledRef = useRef(false);

  useEffect(() => {
    if (!user || user.isBot) return;

    let cancelled = false;

    const refreshStatus = async () => {
      try {
        const status = await getSpotifyStatus();
        if (cancelled) return;
        connectedRef.current = status.connected;
        shareRef.current = status.shareListening;
        enabledRef.current = status.enabled;
        const current = userRef.current;
        if (current && status.shareListening !== current.shareListening) {
          updateUser({ ...current, shareListening: status.shareListening });
        }
      } catch {
        if (!cancelled) {
          connectedRef.current = false;
          enabledRef.current = false;
        }
      }
    };

    void refreshStatus();

    const onConnectionChanged = () => void refreshStatus();
    window.addEventListener(SPOTIFY_CONNECTION_CHANGED, onConnectionChanged);

    return () => {
      cancelled = true;
      window.removeEventListener(SPOTIFY_CONNECTION_CHANGED, onConnectionChanged);
    };
  }, [user?.id, user?.isBot, updateUser]);

  useEffect(() => {
    if (!user || user.isBot) return;

    const clientInstanceId = getClientInstanceId();

    const runSync = async () => {
      if (document.hidden) return;
      const current = userRef.current;
      if (!current) return;

      if (!connectedRef.current || !shareRef.current || !enabledRef.current) return;

      try {
        const result = await syncSpotifyListening({
          clientType: "web",
          clientInstanceId,
        });
        shareRef.current = result.shareListening;
        const latest = userRef.current;
        if (!latest) return;
        updateUser({
          ...latest,
          shareListening: result.shareListening,
          listeningActivity: result.listeningActivity,
        });
      } catch {
        // Ignoruj błędy sieciowe — kolejna próba za 8 s
      }
    };

    const onVisibility = () => {
      if (!document.hidden) void runSync();
    };

    void runSync();
    const timer = window.setInterval(() => void runSync(), SYNC_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user?.id, user?.isBot, updateUser]);
}

export function isListeningNow(
  activity: ListeningActivity | null | undefined,
): activity is ListeningActivity {
  return Boolean(activity?.isPlaying && activity.trackTitle);
}
