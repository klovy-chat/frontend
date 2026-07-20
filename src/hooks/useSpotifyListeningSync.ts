import { useEffect, useRef } from "react";
import { getSpotifyStatus, syncSpotifyListening } from "../api/integrations";
import { useAuth } from "../context/AuthContext";
import { getClientInstanceId } from "../utils/env/clientInstanceId";
import { SPOTIFY_CONNECTION_CHANGED } from "../utils/sync/spotifyConnectionSync";
import type { ListeningActivity, User } from "../types";

const SYNC_INTERVAL_MS = 45_000;
const STATUS_STORAGE_KEY = "klovy.spotify.connected";

function readKnownConnected(userId: string): boolean {
  try {
    return sessionStorage.getItem(`${STATUS_STORAGE_KEY}.${userId}`) === "1";
  } catch {
    return false;
  }
}

function writeKnownConnected(userId: string, connected: boolean): void {
  try {
    const key = `${STATUS_STORAGE_KEY}.${userId}`;
    if (connected) sessionStorage.setItem(key, "1");
    else sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Syncs Spotify listening activity only after we know the account is linked
 * (Integrations panel / OAuth return / previous session flag). Avoids hitting
 * Spotify APIs on every app refresh for users who never connected.
 */
export function useSpotifyListeningSync(): void {
  const { user, updateUser } = useAuth();
  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const connectedRef = useRef(false);
  const shareRef = useRef(true);
  const enabledRef = useRef(false);
  const armedRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const userId = user.id;

    const refreshStatus = async () => {
      try {
        const status = await getSpotifyStatus();
        if (cancelled) return;
        connectedRef.current = status.connected;
        shareRef.current = status.shareListening;
        enabledRef.current = status.enabled;
        writeKnownConnected(userId, status.connected);
        armedRef.current = status.connected;
        const current = userRef.current;
        if (current) {
          updateUser({
            ...current,
            shareListening: status.shareListening,
            spotifyConnected: status.connected,
            listeningActivity: status.connected
              ? current.listeningActivity
              : null,
          });
        }
      } catch {
        if (!cancelled) {
          connectedRef.current = false;
          enabledRef.current = false;
        }
      }
    };

    // Only probe status if we already know (or just learned) Spotify is linked.
    if (user.spotifyConnected || readKnownConnected(userId)) {
      armedRef.current = true;
      void refreshStatus();
    }

    const onConnectionChanged = () => {
      armedRef.current = true;
      void refreshStatus();
    };
    window.addEventListener(SPOTIFY_CONNECTION_CHANGED, onConnectionChanged);

    return () => {
      cancelled = true;
      window.removeEventListener(SPOTIFY_CONNECTION_CHANGED, onConnectionChanged);
    };
  }, [user?.id, user?.spotifyConnected, updateUser]);

  useEffect(() => {
    if (!user) return;

    const clientInstanceId = getClientInstanceId();

    const runSync = async () => {
      if (document.hidden) return;
      if (!armedRef.current) return;
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
          spotifyConnected: true,
        });
      } catch {
        // Network blip — next interval retries.
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
  }, [user?.id, updateUser]);
}

export function isListeningNow(
  activity: ListeningActivity | null | undefined,
): activity is ListeningActivity {
  return Boolean(activity?.isPlaying && activity.trackTitle);
}
