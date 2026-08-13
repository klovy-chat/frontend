import { useEffect, useRef } from "react";
import { useWebSocket, useWebSocketConnected } from "../../context/WebSocketContext";
import { useAuth } from "../../context/AuthContext";
import { WsType } from "../../api/wsProtocol";
import unreadSync from "../../utils/sync/unreadSync";
import {
  getMutedConversationKeys,
  isConversationMuted,
  mergeMutedFromHttp,
  subscribeMutedConversations,
} from "../../utils/sync/mutedConversations";
import {
  isChatPageMounted,
  subscribeChatPageMounted,
} from "../../utils/sync/chatPageMounted";
import {
  ackPendingMarkReadByKey,
  peekPendingMarkReadKeys,
  queuePendingMarkRead,
  subscribePendingMarkReads,
  takePendingMarkReads,
} from "../../utils/sync/pendingMarkRead";
import { getContactsForList } from "../../api/contacts";
import { getUserChannels } from "../../api/channels";

type UnreadPayload = {
  kind?: string;
  type?: "dm" | "channel" | string;
  id?: string;
  unreadCount?: number;
  delta?: number;
  revision?: number;
  generation?: number;
};

const IGNORE_DELTAS_MS = 2_000;

async function httpSumUnreadInto(
  countsRef: { current: Map<string, number> },
  opts?: {
    cancelled?: () => boolean;
    gensAtStart?: Map<string, number>;
    generationRef?: { current: Map<string, number> };
    /** Keys that received deltas during in-flight heal (same-gen safe). */
    dirtyRef?: { current: Set<string> };
  },
): Promise<boolean> {
  try {
    const [contactsRes, channelsRes] = await Promise.all([
      getContactsForList(),
      getUserChannels(),
    ]);
    if (opts?.cancelled?.()) return false;
    const prev = countsRef.current;
    const dirty = opts?.dirtyRef?.current;
    const next = new Map<string, number>();
    let total = 0;
    // Open-chat / in-flight mark-read — force 0 (not max with stale HTTP).
    const pendingZero = new Set(peekPendingMarkReadKeys());
    const preferLive = (key: string, httpN: number): number => {
      if (pendingZero.has(key)) return 0;
      if (!opts?.gensAtStart || !opts.generationRef) return httpN;
      const liveGen = opts.generationRef.current.get(key) ?? 0;
      const startGen = opts.gensAtStart.get(key) ?? 0;
      const dirtyHit = dirty?.has(key) ?? false;
      if ((dirtyHit || liveGen > startGen) && prev.has(key)) {
        const live = prev.get(key) ?? 0;
        // Absolute 0 during heal (mark-read) must win over stale HTTP.
        if (live === 0 && (dirtyHit || liveGen > startGen)) return 0;
        return Math.max(httpN, live);
      }
      return httpN;
    };
    const rosterIds: string[] = [];
    const httpMuted: string[] = [];
    for (const c of contactsRes.contacts ?? []) {
      const key = `dm:${c._id}`;
      rosterIds.push(key);
      if (c.isMuted) httpMuted.push(key);
    }
    for (const ch of channelsRes.channels ?? []) {
      const key = `channel:${ch._id}`;
      rosterIds.push(key);
      if (ch.isMuted) httpMuted.push(key);
    }
    // Final cancel before mute merge + title mutate (superseded heal must not touch store).
    if (opts?.cancelled?.()) return false;
    const mutedBefore = new Set(getMutedConversationKeys());
    mergeMutedFromHttp(httpMuted, rosterIds);
    // Unmute mid-heal must not leave sticky-0 dirty beating HTTP unread.
    if (dirty) {
      for (const key of mutedBefore) {
        const kind = key.startsWith("dm:") ? "dm" : "channel";
        const id = key.slice(key.indexOf(":") + 1);
        if (!isConversationMuted(kind, id)) dirty.delete(key);
      }
    }
    for (const c of contactsRes.contacts ?? []) {
      const key = `dm:${c._id}`;
      const muted = isConversationMuted("dm", c._id);
      const n = muted || pendingZero.has(key)
        ? 0
        : Math.max(0, preferLive(key, c.unreadCount ?? 0));
      next.set(key, n);
      total += n;
    }
    for (const ch of channelsRes.channels ?? []) {
      const key = `channel:${ch._id}`;
      const muted = isConversationMuted("channel", ch._id);
      const n = muted || pendingZero.has(key)
        ? 0
        : Math.max(0, preferLive(key, ch.unreadCount ?? 0));
      next.set(key, n);
      total += n;
    }
    // Belt-and-suspenders — remount race between build and publish.
    if (opts?.cancelled?.()) return false;
    dirty?.clear();
    countsRef.current = next;
    // One notify — exclude(0) then setCount would flash open-chat into title.
    unreadSync.setCountAndLocalExclude(total, 0);
    return true;
  } catch {
    /* keep prior title until next absolute */
    return false;
  }
}

/** Title sum excluding muted + pendingZero (does not mutate countsRef). */
function sumCountsForTitle(counts: Map<string, number>): number {
  const pendingZero = new Set(peekPendingMarkReadKeys());
  let sum = 0;
  for (const [key, n] of counts) {
    const kind = key.startsWith("dm:") ? "dm" : "channel";
    const id = key.slice(key.indexOf(":") + 1);
    if (isConversationMuted(kind, id) || pendingZero.has(key)) continue;
    sum += Math.max(0, n);
  }
  return sum;
}

type BridgeHealRefs = {
  countsRef: { current: Map<string, number> };
  generationRef: { current: Map<string, number> };
  dirtyDuringHealRef: { current: Set<string> };
  chatMountedRef: { current: boolean };
  ignoreDeltasUntilRef: { current: number };
  healInFlightRef: { current: boolean };
  healGenRef: { current: number };
  seededRef: { current: boolean };
  prevMutedKeysRef: { current: Set<string> };
  /** Left/deleted/unfriended — reject UNREAD invent until heal reseeds. */
  droppedKeysRef: { current: Set<string> };
};

/** Settings heal with retry — keep ∞ + exclude until success (no title inflate). */
function beginBridgeHeal(
  refs: BridgeHealRefs,
  extraCancelled?: () => boolean,
): void {
  refs.ignoreDeltasUntilRef.current = Number.POSITIVE_INFINITY;
  refs.healInFlightRef.current = true;
  const gen = ++refs.healGenRef.current;
  const gensAtStart = new Map(refs.generationRef.current);
  const attempt = () => {
    void httpSumUnreadInto(refs.countsRef, {
      cancelled: () =>
        (extraCancelled?.() ?? false) ||
        refs.healGenRef.current !== gen ||
        refs.chatMountedRef.current,
      gensAtStart,
      generationRef: refs.generationRef,
      dirtyRef: refs.dirtyDuringHealRef,
    }).then((ok) => {
      if (extraCancelled?.()) return;
      if (refs.healGenRef.current !== gen || refs.chatMountedRef.current) return;
      if (ok) {
        refs.healInFlightRef.current = false;
        refs.ignoreDeltasUntilRef.current = Date.now() + IGNORE_DELTAS_MS;
        refs.seededRef.current = true;
        refs.prevMutedKeysRef.current = new Set(getMutedConversationKeys());
        // HTTP roster is SoT — clear leave/delete tombstones.
        refs.droppedKeysRef.current.clear();
      } else {
        // Keep ∞ and prior exclude; retry shortly.
        window.setTimeout(() => {
          if (extraCancelled?.()) return;
          if (refs.healGenRef.current !== gen || refs.chatMountedRef.current) {
            return;
          }
          attempt();
        }, 750);
      }
    });
  };
  attempt();
}

/**
 * Keeps document-title badge fresh while ChatPage/Sidebar is unmounted
 * (Settings / Invite). While Chat is mounted, Sidebar owns the total; this
 * bridge only mirrors per-key baselines so leave→absolute mark-read stays correct.
 */
export function UnreadBadgeBridge() {
  const ws = useWebSocket();
  const wsConnected = useWebSocketConnected();
  const { user } = useAuth();
  const countsRef = useRef(new Map<string, number>());
  const generationRef = useRef(new Map<string, number>());
  const revisionRef = useRef(new Map<string, number>());
  const dirtyDuringHealRef = useRef(new Set<string>());
  const chatMountedRef = useRef(isChatPageMounted());
  const wasConnectedRef = useRef(wsConnected);
  const ignoreDeltasUntilRef = useRef(0);
  const healInFlightRef = useRef(false);
  const healGenRef = useRef(0);
  /** True after a successful HTTP seed while Chat is unmounted. */
  const seededRef = useRef(false);
  /** Last muted keys observed while seeded — unmute transition detection. */
  const prevMutedKeysRef = useRef<Set<string>>(new Set());
  /** Leave/delete/unfriend tombstones until heal confirms roster. */
  const droppedKeysRef = useRef<Set<string>>(new Set());

  // Drain pending mark-reads while shell is mounted (Chat→Settings keeps socket).
  useEffect(() => {
    if (!ws || !wsConnected || !user?.id) return;
    const userId = user.id;
    const flush = (redrainInFlight: boolean) => {
      const { marks, generation } = takePendingMarkReads(userId, {
        redrainInFlight,
      });
      for (const mark of marks) {
        if (mark.kind === "dm") {
          void ws
            .send(WsType.MARK_CONVERSATION_READ, {
              userId: mark.userId,
              contactId: mark.contactId,
            })
            .then((ok) => {
              // Wire ack ≠ server absolute — keep inFlight until UNREAD absolute.
              if (!ok) queuePendingMarkRead(mark, generation);
            })
            .catch(() => {
              queuePendingMarkRead(mark, generation);
            });
        } else {
          void ws
            .send(WsType.MARK_CHANNEL_READ, {
              userId: mark.userId,
              channelId: mark.channelId,
            })
            .then((ok) => {
              if (!ok) queuePendingMarkRead(mark, generation);
            })
            .catch(() => {
              queuePendingMarkRead(mark, generation);
            });
        }
      }
    };
    // Reconnect / mount: re-drain inFlight. Notify path: only new pending.
    flush(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") flush(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    const unsub = subscribePendingMarkReads(() => flush(false));
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      unsub();
    };
  }, [ws, wsConnected, user?.id]);

  const healRefs = (): BridgeHealRefs => ({
    countsRef,
    generationRef,
    dirtyDuringHealRef,
    chatMountedRef,
    ignoreDeltasUntilRef,
    healInFlightRef,
    healGenRef,
    seededRef,
    prevMutedKeysRef,
    droppedKeysRef,
  });

  useEffect(() => subscribeChatPageMounted(() => {
    const wasMounted = chatMountedRef.current;
    chatMountedRef.current = isChatPageMounted();
    // Chat → Settings/Invite: Sidebar unmounts — seed title badge from HTTP.
    if (wasMounted && !chatMountedRef.current) {
      // Keep title exclude until heal setCount+exclude(0) together (avoids flash).
      // Keep dirty — absolute sticky-0 from Chat must survive until HTTP merge.
      beginBridgeHeal(healRefs());
    }
    if (!wasMounted && chatMountedRef.current) {
      // Invalidate any in-flight Settings heal and drop ∞ accumulate mode.
      healGenRef.current += 1;
      seededRef.current = false;
      healInFlightRef.current = false;
      ignoreDeltasUntilRef.current = 0;
    }
  }), []);

  useEffect(() => {
    const was = wasConnectedRef.current;
    wasConnectedRef.current = wsConnected;
    if (!wsConnected) {
      generationRef.current.clear();
      revisionRef.current.clear();
      // Drop dirty — gens are gone; sticky-0 must not beat offline HTTP unread
      // after reconnect (pendingZero still covers in-flight mark-read).
      dirtyDuringHealRef.current.clear();
      healInFlightRef.current = false;
      // Keep droppedKeys tombstones until heal confirms roster (do not clear).
      return;
    }
    if (!was) {
      // Arm ∞ before clearing gens (gap until heal/Sidebar refresh).
      ignoreDeltasUntilRef.current = Number.POSITIVE_INFINITY;
      generationRef.current.clear();
      revisionRef.current.clear();
      dirtyDuringHealRef.current.clear();
      seededRef.current = false;
      healInFlightRef.current = true;
      // Keep droppedKeys until successful heal clears them.

      if (chatMountedRef.current) {
        // Keep countsRef baselines; dirty cleared — HTTP/Sidebar own post-reconnect.
        healInFlightRef.current = false;
        // Finite grace — Sidebar owns merge; permanent ∞ would dirty-accumulate
        // and overcount on next Settings preferLive.
        ignoreDeltasUntilRef.current = Date.now() + 3_500;
        return;
      }
      // Keep countsRef for preferLive deltas during heal; dirty cleared above.
      let cancelled = false;
      beginBridgeHeal(healRefs(), () => cancelled);
      return () => {
        cancelled = true;
      };
    }
  }, [wsConnected]);

  // pendingZero ack/track while Settings owns title — re-sum without roster change.
  useEffect(
    () =>
      subscribePendingMarkReads(() => {
        if (chatMountedRef.current || !seededRef.current) return;
        unreadSync.setCount(sumCountsForTitle(countsRef.current));
      }),
    [],
  );

  useEffect(() => {
    if (!ws) return;

    const onUnread = (raw: UnreadPayload) => {
      const kind = raw.type ?? raw.kind;
      const id = raw.id;
      if (!kind || !id || (kind !== "dm" && kind !== "channel")) return;

      const key = `${kind}:${id}`;
      // Left/deleted/unfriended — do not invent key back from late absolute.
      if (droppedKeysRef.current.has(key)) {
        if (seededRef.current && !chatMountedRef.current) {
          beginBridgeHeal(healRefs());
        }
        return;
      }
      const gen = raw.generation ?? 0;
      const lastGen = generationRef.current.get(key) ?? 0;
      const isAbsolute = typeof raw.unreadCount === "number";
      // Stale absolute — do not ack pendingZero (newer mark-read may still be in flight).
      if (gen < lastGen) {
        return;
      }

      const rev = raw.revision ?? 0;
      // Same-gen revisionless deltas after absolute → phantom overcount.
      if (!isAbsolute && gen === lastGen && rev <= 0) return;
      if (isAbsolute || gen > lastGen) {
        generationRef.current.set(key, gen);
      }

      {
        const last = revisionRef.current.get(key) ?? 0;
        if (rev > 0) {
          if (!isAbsolute && rev <= last) return;
          // Same-gen absolute older than applied delta — delayed mark-read vs newer +1.
          if (isAbsolute && gen === lastGen && last > 0 && rev < last) {
            // Ignore — ack only on apply path.
            return;
          }
          revisionRef.current.set(key, isAbsolute ? Math.max(last, rev) : rev);
        } else if (isAbsolute && gen === lastGen && last > 0) {
          // Revisionless absolute after a revisioned delta — ignore (clobber risk).
          return;
        }
      }

      const ignoreUntil = ignoreDeltasUntilRef.current;
      const ignoring = !isAbsolute && Date.now() < ignoreUntil;
      const httpInFlight = ignoreUntil === Number.POSITIVE_INFINITY;
      // Finite post-heal grace no longer drops deltas — gen/rev already filter delayed.
      // During in-flight heal (∞): accumulate baselines for preferLive only.
      if (ignoring && httpInFlight && typeof raw.delta === "number") {
        // No invent-0 baseline for unknown keys — wait for heal seed.
        if (!countsRef.current.has(key)) return;
        const muted = isConversationMuted(kind as "dm" | "channel", id);
        const prev = countsRef.current.get(key) ?? 0;
        countsRef.current.set(key, muted ? 0 : Math.max(0, prev + raw.delta));
        // Never dirty muted→0 — unmute heal must not preferLive sticky 0 over HTTP.
        if (!muted) dirtyDuringHealRef.current.add(key);
        return;
      }
      if (ignoring && httpInFlight) return;

      const muted = isConversationMuted(kind as "dm" | "channel", id);
      const prev = countsRef.current.get(key);

      if (chatMountedRef.current) {
        if (typeof raw.delta === "number") {
          // Bridge is not HTTP-seeded while Chat owns roster — no invent-0.
          if (prev === undefined) return;
          countsRef.current.set(
            key,
            muted ? 0 : Math.max(0, prev + raw.delta),
          );
          if (!muted) dirtyDuringHealRef.current.add(key);
        } else if (typeof raw.unreadCount === "number") {
          ackPendingMarkReadByKey(key);
          countsRef.current.set(
            key,
            muted ? 0 : Math.max(0, raw.unreadCount),
          );
          // Next Chat→Settings heal must preferLive sticky 0 over stale HTTP.
          if (!muted) dirtyDuringHealRef.current.add(key);
        }
        return;
      }

      if (typeof raw.delta === "number") {
        // Seeded Settings: unknown key → heal (no invent-0), muted or not.
        if (prev === undefined) {
          if (seededRef.current) beginBridgeHeal(healRefs());
          return;
        }
        if (muted) {
          countsRef.current.set(key, 0);
          if (seededRef.current) {
            unreadSync.setCount(sumCountsForTitle(countsRef.current));
          }
          return;
        }
        const next = Math.max(0, prev + raw.delta);
        countsRef.current.set(key, next);
        dirtyDuringHealRef.current.add(key);
        if (seededRef.current) {
          unreadSync.setCount(sumCountsForTitle(countsRef.current));
        }
        return;
      }
      if (typeof raw.unreadCount === "number") {
        // Absolute from server — clear mark-read zero-guard for this key.
        // Unknown key while seeded: heal (CHANNEL_ADDED / leave race) — no invent.
        if (prev === undefined) {
          ackPendingMarkReadByKey(key);
          if (seededRef.current) beginBridgeHeal(healRefs());
          return;
        }
        ackPendingMarkReadByKey(key);
        const next = muted ? 0 : Math.max(0, raw.unreadCount);
        countsRef.current.set(key, next);
        if (!muted) dirtyDuringHealRef.current.add(key);
        if (!seededRef.current) return;
        unreadSync.setCount(sumCountsForTitle(countsRef.current));
      }
    };

    return ws.subscribe(WsType.UNREAD_UPDATED, onUnread);
  }, [ws]);

  // Settings title: drop left/deleted/unfriended keys so countsRef cannot overcount.
  useEffect(() => {
    if (!ws) return;
    const selfId = user?.id;
    const dropKey = (key: string) => {
      // Always tombstone — Chat-mounted leave must fence late absolute after Chat→Settings.
      ackPendingMarkReadByKey(key);
      countsRef.current.delete(key);
      dirtyDuringHealRef.current.delete(key);
      generationRef.current.delete(key);
      revisionRef.current.delete(key);
      droppedKeysRef.current.add(key);
      if (!chatMountedRef.current && seededRef.current) {
        unreadSync.setCount(sumCountsForTitle(countsRef.current));
      }
    };
    const unsubs = [
      ws.subscribe(WsType.CHANNEL_LEFT, (e: { channelId?: string }) => {
        if (e.channelId) dropKey(`channel:${e.channelId}`);
      }),
      // Kick/ban may only emit member-left — treat self as leave for title.
      ws.subscribe(
        WsType.CHANNEL_MEMBER_LEFT,
        (e: { channelId?: string; userId?: string }) => {
          if (e.channelId && selfId && e.userId === selfId) {
            dropKey(`channel:${e.channelId}`);
          }
        },
      ),
      ws.subscribe(WsType.CHANNEL_DELETED, (e: { channelId?: string }) => {
        if (e.channelId) dropKey(`channel:${e.channelId}`);
      }),
      ws.subscribe(WsType.FRIENDSHIP_REMOVED, (e: { userId?: string; contactId?: string }) => {
        const id = e.userId ?? e.contactId;
        if (id) dropKey(`dm:${id}`);
      }),
      // Wipe may emit conversation-deleted without absolute — always zero baseline.
      ws.subscribe(WsType.CONVERSATION_DELETED, (e: { contactId?: string }) => {
        if (!e.contactId) return;
        const key = `dm:${e.contactId}`;
        ackPendingMarkReadByKey(key);
        countsRef.current.set(key, 0);
        dirtyDuringHealRef.current.delete(key);
        if (!chatMountedRef.current && seededRef.current) {
          unreadSync.setCount(sumCountsForTitle(countsRef.current));
        }
      }),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, [ws, user?.id]);

  // Mute BC/storage — re-zero muted keys; heal only on muted→unmuted transitions.
  useEffect(() => {
    return subscribeMutedConversations(() => {
      if (chatMountedRef.current || !seededRef.current) return;
      let changed = false;
      for (const key of countsRef.current.keys()) {
        const kind = key.startsWith("dm:") ? "dm" : "channel";
        const id = key.slice(key.indexOf(":") + 1);
        const muted = isConversationMuted(kind, id);
        if (muted && (countsRef.current.get(key) ?? 0) !== 0) {
          countsRef.current.set(key, 0);
          changed = true;
        }
      }
      const unmutedKeys: string[] = [];
      for (const key of prevMutedKeysRef.current) {
        const kind = key.startsWith("dm:") ? "dm" : "channel";
        const id = key.slice(key.indexOf(":") + 1);
        if (!isConversationMuted(kind, id)) unmutedKeys.push(key);
      }
      // Full mute set (not only keys in countsRef) so unmute heal cannot miss.
      prevMutedKeysRef.current = new Set(getMutedConversationKeys());
      if (changed) {
        unreadSync.setCount(sumCountsForTitle(countsRef.current));
      }
      if (unmutedKeys.length === 0) return;
      // Drop muted sticky-0 dirty so HTTP unread can win after unmute.
      for (const key of unmutedKeys) dirtyDuringHealRef.current.delete(key);
      beginBridgeHeal(healRefs());
    });
  }, []);

  return null;
}
