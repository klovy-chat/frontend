// tracks.ts
// Mute/unmute tracków LiveKit (mic/cam).
// Zakres:
//  - wspólne DM i kanał
//  - mute/unmute mic i kamery; CallContext orkiestruje
// Stan UI i track muszą iść w parze — CallContext orkiestruje.
// Przy zmianach: CallContext.tsx, CallView.tsx.

import { Track, type LocalParticipant, type RemoteParticipant } from "livekit-client";

export function readLocalCameraTrack(participant: LocalParticipant) {
  return participant.getTrackPublication(Track.Source.Camera)?.track ?? null;
}

export function readLocalScreenShareTrack(participant: LocalParticipant) {
  return participant.getTrackPublication(Track.Source.ScreenShare)?.track ?? null;
}

export function readRemoteCameraTrack(participant: RemoteParticipant) {
  for (const pub of participant.trackPublications.values()) {
    if (
      pub.kind === Track.Kind.Video
      && pub.source === Track.Source.Camera
      && pub.track
    ) {
      return pub.track;
    }
  }
  return null;
}

export function readRemoteScreenShareTrack(participant: RemoteParticipant) {
  for (const pub of participant.trackPublications.values()) {
    if (
      pub.kind === Track.Kind.Video
      && pub.source === Track.Source.ScreenShare
      && pub.track
    ) {
      return pub.track;
    }
  }
  return null;
}
