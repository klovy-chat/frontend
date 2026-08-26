// UnreadSync.tsx
// Badge tytułu gdy nie ma Sidebara (Settings/Invite): HTTP heal + WS delty.
// Zakres:
//  - pendingZero, tombstones leave/wipe
//  - preferLive sticky-0
// Duplikowanie tej logiki w ChatWindow rozjedzie mark-read między kartami.
// Przy zmianach: unread.ts, markRead.ts, Sidebar.tsx, muted.ts.

import { useEffect, useRef } from "react";
import { useWebSocket, useWebSocketConnected } from "../../context/WebSocketContext";
import { useAuth } from "../../context/AuthContext";
import { WsType } from "../../api/protocol";
import unreadSync from "../../utils/sync/unread";
import {
  getMutedConversationKeys,
  isConversationMuted,
  mergeMutedFromHttp,
  subscribeMutedConversations,
} from "../../utils/sync/muted";
import {
  isChatMounted,
  subscribeChatMounted,
} from "../../utils/sync/chatMounted";
import {
  ackPendingMarkReadByKey,
  hasPendingMarkReads,
  peekPendingMarkReadKeys,
  queuePendingMarkRead,
  subscribePendingMarkReads,
  takePendingMarkReads,
} from "../../utils/sync/markRead";
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

    const pendingZero = new Set(peekPendingMarkReadKeys());
    const preferLive = (key: string, httpN: number): number => {
      if (pendingZero.has(key)) return 0;
      if (!opts?.gensAtStart || !opts.generationRef) return httpN;
      const liveGen = opts.generationRef.current.get(key) ?? 0;
      const startGen = opts.gensAtStart.get(key) ?? 0;
      const dirtyHit = dirty?.has(key) ?? false;
      if ((dirtyHit || liveGen > startGen) && prev.has(key)) {
        const live = prev.get(key) ?? 0;

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

    if (opts?.cancelled?.()) return false;
    const mutedBefore = new Set(getMutedConversationKeys());
    mergeMutedFromHttp(httpMuted, rosterIds);

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

    if (opts?.cancelled?.()) return false;
    dirty?.clear();
    countsRef.current = next;

    unreadSync.setCountAndLocalExclude(total, 0);
    return true;
  } catch {

    return false;
  }
}

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

type HealRefs = {
  countsRef: { current: Map<string, number> };
  generationRef: { current: Map<string, number> };
  dirtyDuringHealRef: { current: Set<string> };
  chatMountedRef: { current: boolean };
  ignoreDeltasUntilRef: { current: number };
  healInFlightRef: { current: boolean };
  healGenRef: { current: number };
  seededRef: { current: boolean };
  prevMutedKeysRef: { current: Set<string> };
  droppedKeysRef: { current: Set<string> };

  wipedKeysRef: { current: Set<string> };
};

function beginHeal(
  refs: HealRefs,
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

        refs.droppedKeysRef.current.clear();
        refs.wipedKeysRef.current.clear();
      } else {

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

export function UnreadSync() {
  const ws = useWebSocket();
  const wsConnected = useWebSocketConnected();
  const { user } = useAuth();
  const countsRef = useRef(new Map<string, number>());
  const generationRef = useRef(new Map<string, number>());
  const revisionRef = useRef(new Map<string, number>());
  const dirtyDuringHealRef = useRef(new Set<string>());
  const chatMountedRef = useRef(isChatMounted());
  const wasConnectedRef = useRef(wsConnected);
  const ignoreDeltasUntilRef = useRef(0);
  const healInFlightRef = useRef(false);
  const healGenRef = useRef(0);

  const seededRef = useRef(false);

  const prevMutedKeysRef = useRef<Set<string>>(new Set());

  const droppedKeysRef = useRef<Set<string>>(new Set());

  const wipedKeysRef = useRef<Set<string>>(new Set());
  const sessionUserIdRef = useRef<string | undefined>(user?.id);

  useEffect(() => {
    const next = user?.id;
    if (sessionUserIdRef.current === next) return;
    sessionUserIdRef.current = next;
    healGenRef.current += 1;
    countsRef.current.clear();
    generationRef.current.clear();
    revisionRef.current.clear();
    dirtyDuringHealRef.current.clear();
    droppedKeysRef.current.clear();
    wipedKeysRef.current.clear();
    prevMutedKeysRef.current.clear();
    seededRef.current = false;
    healInFlightRef.current = false;
    ignoreDeltasUntilRef.current = 0;
  }, [user?.id]);

  useEffect(() => {
    if (!ws || !wsConnected || !user?.id) return;
    const userId = user.id;
    const flush = (redrainInFlight: boolean) => {
      if (!hasPendingMarkReads(userId)) return;
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

  const healRefs = (): HealRefs => ({
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
    wipedKeysRef,
  });

  useEffect(() => subscribeChatMounted(() => {
    const wasMounted = chatMountedRef.current;
    chatMountedRef.current = isChatMounted();

    if (wasMounted && !chatMountedRef.current) {

      beginHeal(healRefs());
    }
    if (!wasMounted && chatMountedRef.current) {

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

      dirtyDuringHealRef.current.clear();
      healInFlightRef.current = false;

      return;
    }
    if (!was) {

      ignoreDeltasUntilRef.current = Number.POSITIVE_INFINITY;
      generationRef.current.clear();
      revisionRef.current.clear();
      dirtyDuringHealRef.current.clear();
      seededRef.current = false;
      healInFlightRef.current = true;

      if (chatMountedRef.current) {

        healInFlightRef.current = false;

        ignoreDeltasUntilRef.current = Date.now() + 3_500;
        return;
      }

      let cancelled = false;
      beginHeal(healRefs(), () => cancelled);
      return () => {
        cancelled = true;
      };
    }
  }, [wsConnected]);

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
      if (droppedKeysRef.current.has(key)) {
        if (seededRef.current && !chatMountedRef.current) {
          beginHeal(healRefs());
        }
        return;
      }
      if (wipedKeysRef.current.has(key)) return;
      const gen = raw.generation ?? 0;
      const lastGen = generationRef.current.get(key) ?? 0;
      const isAbsolute = typeof raw.unreadCount === "number";

      if (gen < lastGen) {
        return;
      }

      const rev = raw.revision ?? 0;

      if (!isAbsolute && gen === lastGen && rev <= 0) return;
      if (isAbsolute || gen > lastGen) {
        generationRef.current.set(key, gen);
      }

      {
        const last = revisionRef.current.get(key) ?? 0;
        if (rev > 0) {
          if (!isAbsolute && rev <= last) return;

          if (isAbsolute && gen === lastGen && last > 0 && rev < last) {

            return;
          }
          revisionRef.current.set(key, isAbsolute ? Math.max(last, rev) : rev);
        } else if (isAbsolute && gen === lastGen && last > 0) {

          return;
        }
      }

      const ignoreUntil = ignoreDeltasUntilRef.current;
      const ignoring = !isAbsolute && Date.now() < ignoreUntil;
      const httpInFlight = ignoreUntil === Number.POSITIVE_INFINITY;

      if (ignoring && httpInFlight && typeof raw.delta === "number") {
        if (!countsRef.current.has(key)) return;
        const muted = isConversationMuted(kind as "dm" | "channel", id);
        const prev = countsRef.current.get(key) ?? 0;
        countsRef.current.set(key, muted ? 0 : Math.max(0, prev + raw.delta));

        if (!muted) dirtyDuringHealRef.current.add(key);
        return;
      }
      if (ignoring && httpInFlight) return;

      const muted = isConversationMuted(kind as "dm" | "channel", id);
      const prev = countsRef.current.get(key);

      if (chatMountedRef.current) {
        if (typeof raw.delta === "number") {
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

          if (!muted) dirtyDuringHealRef.current.add(key);
        }
        return;
      }

      if (typeof raw.delta === "number") {
        if (prev === undefined) {
          if (seededRef.current) beginHeal(healRefs());
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

        if (prev === undefined) {
          ackPendingMarkReadByKey(key);
          if (seededRef.current) beginHeal(healRefs());
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

  useEffect(() => {
    if (!ws) return;
    const selfId = user?.id;
    const dropKey = (key: string) => {

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

      ws.subscribe(WsType.CONVERSATION_DELETED, (e: { contactId?: string }) => {
        if (!e.contactId) return;
        const key = `dm:${e.contactId}`;
        ackPendingMarkReadByKey(key);
        wipedKeysRef.current.add(key);
        countsRef.current.set(key, 0);
        dirtyDuringHealRef.current.delete(key);

        const prevGen = generationRef.current.get(key) ?? 0;
        generationRef.current.set(key, prevGen + 1);
        revisionRef.current.delete(key);
        if (!chatMountedRef.current && seededRef.current) {
          unreadSync.setCount(sumCountsForTitle(countsRef.current));
        }
      }),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, [ws, user?.id]);

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

      prevMutedKeysRef.current = new Set(getMutedConversationKeys());
      if (changed) {
        unreadSync.setCount(sumCountsForTitle(countsRef.current));
      }
      if (unmutedKeys.length === 0) return;

      for (const key of unmutedKeys) dirtyDuringHealRef.current.delete(key);
      beginHeal(healRefs());
    });
  }, []);

  return null;
}
