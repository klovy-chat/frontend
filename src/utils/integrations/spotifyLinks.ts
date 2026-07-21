const SPOTIFY_HTTPS_REGEX =
  /^https:\/\/open\.spotify\.com\/(track|album|playlist|episode|show|artist|user)\/([a-zA-Z0-9]+)/;

export function spotifyUriFromUrl(url: string): string | null {
  const match = url.trim().match(SPOTIFY_HTTPS_REGEX);
  if (!match) return null;
  return `spotify:${match[1]}:${match[2]}`;
}

/** Opens Spotify in the installed desktop/mobile app via URI scheme. */
export function openSpotifyAppLink(httpsUrl: string): void {
  const uri = spotifyUriFromUrl(httpsUrl);
  if (!uri) return;
  window.location.assign(uri);
}
