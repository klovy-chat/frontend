export const SPOTIFY_CONNECTION_CHANGED = "klovy:spotify-connection-changed";

export function notifySpotifyConnectionChanged(): void {
  window.dispatchEvent(new Event(SPOTIFY_CONNECTION_CHANGED));
}
