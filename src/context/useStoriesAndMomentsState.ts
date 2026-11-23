import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChatConversation,
  ChatMessage,
  SocialMoment,
  StoryAudience,
  StoryItem,
  User,
} from '../types';
import {
  appendStorySorted,
  buildStoryTrayUsers,
  computeMomentExpiryIso,
  emptyStoryStorage,
  filterActiveMoments,
  hasUserUnseenStories,
  readStoryMuted,
  upsertOwnNote,
  writeMomentsStorage,
  writeStoryMuted,
  writeStoryStorage,
} from '../lib/storyUtils';
import { apiFetch, uploadMediaSource } from '../lib/api';
import { findDirectConversation } from '../lib/visibility';
import { makeClientId } from './contextHelpers';

interface UseStoriesAndMomentsDeps {
  serverOnlineRef: React.MutableRefObject<boolean>;
  isAuthenticatedRef: React.MutableRefObject<boolean>;
  currentUserRef: React.MutableRefObject<User>;
  conversationsRef: React.MutableRefObject<ChatConversation[]>;
  authBootstrapped: boolean;
  isAuthenticated: boolean;
  currentUser: User;
  users: User[];
  setCurrentUser: React.Dispatch<React.SetStateAction<User>>;
  setConversations: React.Dispatch<React.SetStateAction<ChatConversation[]>>;
  setMessagesByConversation: React.Dispatch<React.SetStateAction<Record<string, ChatMessage[]>>>;
  requireAuthForWrite: () => boolean;
  handleApiError: (err: unknown, fallbackMessage?: string) => void;
  showAppToast: (message: string, tone?: 'info' | 'error' | 'success') => void;
  syncApi: <T>(path: string, init?: RequestInit) => Promise<T | null>;
}

export function useStoriesAndMomentsState({
  serverOnlineRef,
  isAuthenticatedRef,
  currentUserRef,
  conversationsRef,
  authBootstrapped,
  isAuthenticated,
  currentUser,
  users,
  setCurrentUser,
  setConversations,
  setMessagesByConversation,
  requireAuthForWrite,
  handleApiError,
  showAppToast,
  syncApi,
}: UseStoriesAndMomentsDeps) {
  const [storiesByUser, setStoriesByUser] = useState<Record<string, StoryItem[]>>({});
  const [storyStorage, setStoryStorage] = useState(() => emptyStoryStorage());
  const [storyMuted, setStoryMutedState] = useState<boolean>(() => readStoryMuted());
  const [socialMoments, setSocialMoments] = useState<SocialMoment[]>([]);
  const [seenInstantIds, setSeenInstantIds] = useState<string[]>([]);
  const [storyToast, setStoryToast] = useState<{ storyId: string; message: string } | null>(null);
  const storyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStoryMuted = useCallback((val: boolean) => {
    setStoryMutedState(val);
    writeStoryMuted(val);
  }, []);

  const markStorySeen = useCallback(
    (storyId: string) => {
      setStoryStorage((prev) => {
        if (prev.seen[storyId]) return prev;
        const next = {
          ...prev,
          seen: { ...prev.seen, [storyId]: new Date().toISOString() },
        };
        writeStoryStorage(next, currentUserRef.current.id);
        return next;
      });
      if (serverOnlineRef.current && isAuthenticatedRef.current) {
        void syncApi(`/api/stories/${encodeURIComponent(storyId)}/view`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
      }
    },
    [currentUserRef, isAuthenticatedRef, serverOnlineRef, syncApi]
  );

  const saveStoryProgress = useCallback(
    (userId: string, storyId: string, pct: number) => {
      setStoryStorage((prev) => {
        const next = {
          ...prev,
          progress: {
            ...prev.progress,
            [userId]: { storyId, pct: Math.max(0, Math.min(100, pct)) },
          },
        };
        writeStoryStorage(next, currentUserRef.current.id);
        return next;
      });
    },
    [currentUserRef]
  );

  const clearUserStoryProgress = useCallback(
    (userId: string) => {
      setStoryStorage((prev) => {
        if (!prev.progress[userId]) return prev;
        const nextProgress = { ...prev.progress };
        delete nextProgress[userId];
        const next = { ...prev, progress: nextProgress };
        writeStoryStorage(next, currentUserRef.current.id);
        return next;
      });
    },
    [currentUserRef]
  );

  useEffect(() => {
    const active = filterActiveMoments(socialMoments);
    if (active.length !== socialMoments.length) {
      setSocialMoments(active);
    }
    if (authBootstrapped && isAuthenticated && currentUser.id !== 'guest') {
      writeMomentsStorage(active, currentUser.id);
    }
  }, [authBootstrapped, currentUser.id, isAuthenticated, socialMoments]);

  const markInstantSeen = useCallback((id: string) => {
    setSeenInstantIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const dismissStoryToast = useCallback(() => {
    if (storyToastTimerRef.current) {
      clearTimeout(storyToastTimerRef.current);
      storyToastTimerRef.current = null;
    }
    setStoryToast(null);
  }, []);

  const publishStory = useCallback(
    async (story: StoryItem, mediaSource?: File | Blob): Promise<boolean> => {
      if (story.kind === 'instant' || story.mode === 'instants') return false;
      if (!requireAuthForWrite()) return false;

      const normalizedStory: StoryItem = {
        ...story,
        kind: story.kind ?? 'story',
        durationSec: Math.max(1, Math.round(story.durationSec || 5)),
      };
      const prevHadActiveStory = Boolean(currentUserRef.current.hasActiveStory);
      const prevHadUnseenStory = Boolean(currentUserRef.current.hasUnseenStory);

      setStoriesByUser((prev) => {
        const list = prev[normalizedStory.authorId] ?? [];
        return {
          ...prev,
          [normalizedStory.authorId]: appendStorySorted(list, normalizedStory),
        };
      });
      if (normalizedStory.authorId === currentUserRef.current.id) {
        setCurrentUser((prev) => ({ ...prev, hasActiveStory: true, hasUnseenStory: true }));
      }
      if (storyToastTimerRef.current) clearTimeout(storyToastTimerRef.current);
      setStoryToast({ storyId: normalizedStory.id, message: 'تم نشر قصتك' });
      storyToastTimerRef.current = setTimeout(() => {
        setStoryToast(null);
      }, 5000);

      if (!serverOnlineRef.current) return true;

      try {
        let mediaId: string | undefined;
        if (normalizedStory.mediaType !== 'text') {
          const uploadTarget = mediaSource ?? normalizedStory.mediaUrl;
          const uploaded = await uploadMediaSource(
            uploadTarget,
            normalizedStory.mediaType === 'video' ? 'story-video' : 'story-image'
          );
          mediaId = uploaded.mediaId;
        }

        const res = await apiFetch<{
          id: string;
          mediaUrl: string;
          createdAt: string;
          expiresAt: string;
        }>('/api/stories', {
          method: 'POST',
          body: JSON.stringify({
            id: normalizedStory.id,
            kind: normalizedStory.kind,
            ...(mediaId ? { mediaId } : {}),
            mediaType: normalizedStory.mediaType,
            ...(normalizedStory.caption ? { caption: normalizedStory.caption } : {}),
            ...(normalizedStory.soundId ? { soundId: normalizedStory.soundId } : {}),
            ...(normalizedStory.soundTitle ? { soundTitle: normalizedStory.soundTitle } : {}),
            ...(typeof normalizedStory.videoVolume === 'number'
              ? { videoVolume: normalizedStory.videoVolume }
              : {}),
            ...(typeof normalizedStory.musicVolume === 'number'
              ? { musicVolume: normalizedStory.musicVolume }
              : {}),
            ...(typeof normalizedStory.soundStartSec === 'number'
              ? { soundStartSec: normalizedStory.soundStartSec }
              : {}),
            durationSec: normalizedStory.durationSec,
            audience: normalizedStory.audience,
            ...(normalizedStory.recipientIds && normalizedStory.recipientIds.length > 0
              ? { recipientIds: normalizedStory.recipientIds }
              : {}),
            mode: normalizedStory.mode,
            ...(normalizedStory.bgGradient ? { bgGradient: normalizedStory.bgGradient } : {}),
            ...(normalizedStory.overlays ? { overlays: normalizedStory.overlays } : {}),
          }),
        });

        if (res.mediaUrl) {
          setStoriesByUser((prev) => ({
            ...prev,
            [normalizedStory.authorId]: (prev[normalizedStory.authorId] ?? []).map((item) =>
              item.id === normalizedStory.id ? { ...item, mediaUrl: res.mediaUrl } : item
            ),
          }));
        }
        return true;
      } catch (err) {
        setStoriesByUser((prev) => {
          const nextList = (prev[normalizedStory.authorId] ?? []).filter(
            (s) => s.id !== normalizedStory.id
          );
          const nextMap = { ...prev };
          if (nextList.length > 0) nextMap[normalizedStory.authorId] = nextList;
          else delete nextMap[normalizedStory.authorId];
          return nextMap;
        });
        if (normalizedStory.authorId === currentUserRef.current.id) {
          setCurrentUser((prev) => ({
            ...prev,
            hasActiveStory: prevHadActiveStory,
            hasUnseenStory: prevHadUnseenStory,
          }));
        }
        dismissStoryToast();
        handleApiError(err, 'تعذّر حفظ القصة على الخادم');
        return false;
      }
    },
    [currentUserRef, dismissStoryToast, handleApiError, requireAuthForWrite, serverOnlineRef, setCurrentUser]
  );

  const publishNote = useCallback(
    (input: { text: string; soundId?: string; audience: StoryAudience }) => {
      const now = Date.now();
      const prevMoments = socialMoments;
      const updated = upsertOwnNote(filterActiveMoments(socialMoments, now), currentUser.id, input, now);
      setSocialMoments(updated);
      writeMomentsStorage(updated, currentUser.id);
      if (serverOnlineRef.current && isAuthenticatedRef.current) {
        void apiFetch<SocialMoment>('/api/moments/note', {
          method: 'POST',
          body: JSON.stringify({
            text: input.text,
            audience: input.audience === 'custom' ? 'everyone' : input.audience,
          }),
        })
          .then((saved) => {
            setSocialMoments((prev) => {
              const next = [saved, ...prev.filter((m) => !(m.kind === 'note' && m.authorId === currentUser.id))];
              writeMomentsStorage(next, currentUser.id);
              return next;
            });
          })
          .catch((err) => {
            setSocialMoments(prevMoments);
            writeMomentsStorage(prevMoments, currentUser.id);
            handleApiError(err, 'تعذّر نشر الملاحظة');
          });
      }
      return updated[0]!;
    },
    [currentUser.id, handleApiError, isAuthenticatedRef, serverOnlineRef, socialMoments]
  );

  const deleteOwnNote = useCallback(() => {
    const prevMoments = socialMoments;
    setSocialMoments((prev) => {
      const next = prev.filter((m) => !(m.kind === 'note' && m.authorId === currentUser.id));
      writeMomentsStorage(next, currentUser.id);
      return next;
    });
    if (serverOnlineRef.current && isAuthenticatedRef.current) {
      void apiFetch('/api/moments/note', { method: 'DELETE' }).catch((err) => {
        setSocialMoments(prevMoments);
        writeMomentsStorage(prevMoments, currentUser.id);
        handleApiError(err, 'تعذّر حذف الملاحظة');
      });
    }
  }, [currentUser.id, handleApiError, isAuthenticatedRef, serverOnlineRef, socialMoments]);

  const publishInstantMoment = useCallback(
    async (input: {
      mediaUrl: string;
      mediaSource?: File | Blob;
      mediaType?: 'image' | 'video';
      audience: StoryAudience;
      caption?: string;
    }): Promise<SocialMoment | null> => {
      if (!requireAuthForWrite()) return null;
      const now = Date.now();
      const actorId = currentUserRef.current.id;
      const momentId = `mom-inst-${now}-${Math.random().toString(36).slice(2, 6)}`;
      const moment: SocialMoment = {
        id: momentId,
        kind: 'instant',
        authorId: actorId,
        mediaUrl: input.mediaUrl,
        mediaType: input.mediaType ?? 'image',
        text: input.caption,
        audience: input.audience,
        createdAt: new Date(now).toISOString(),
        expiresAt: computeMomentExpiryIso(now),
      };
      setSocialMoments((prev) => {
        const next = [moment, ...filterActiveMoments(prev, now)];
        writeMomentsStorage(next, actorId);
        return next;
      });

      if (serverOnlineRef.current && isAuthenticatedRef.current) {
        try {
          const mediaType = input.mediaType === 'video' ? 'video' : 'image';
          const uploaded = await uploadMediaSource(
            input.mediaSource ?? input.mediaUrl,
            mediaType === 'video' ? 'story-video' : 'story-image'
          );
          const res = await apiFetch<{ id: string; mediaUrl: string }>('/api/stories', {
            method: 'POST',
            body: JSON.stringify({
              id: momentId,
              kind: 'instant',
              mode: 'instants',
              mediaId: uploaded.mediaId,
              mediaType,
              ...(input.caption ? { caption: input.caption } : {}),
              durationSec: 5,
              audience: input.audience,
            }),
          });
          if (res.mediaUrl) {
            setSocialMoments((prev) => {
              const updated = prev.map((m) =>
                m.id === momentId ? { ...m, mediaUrl: res.mediaUrl } : m
              );
              writeMomentsStorage(updated, actorId);
              return updated;
            });
          }
        } catch (err) {
          setSocialMoments((prev) => {
            const rolledBack = prev.filter((m) => m.id !== momentId);
            writeMomentsStorage(rolledBack, actorId);
            return rolledBack;
          });
          handleApiError(err, 'تعذّر حفظ اللحظة على الخادم');
          return null;
        }
      }

      return moment;
    },
    [currentUserRef, handleApiError, isAuthenticatedRef, requireAuthForWrite, serverOnlineRef]
  );

  const replyToMoment = useCallback(
    (targetUser: User, quotedText: string | undefined, replyText: string) => {
      const trimmed = replyText.trim();
      if (!trimmed) return;
      if (!requireAuthForWrite()) return;
      const body = quotedText ? `رداً على ملاحظتك «${quotedText}»: ${trimmed}` : trimmed;
      const existingConv = findDirectConversation(conversationsRef.current, targetUser.id);
      const msgId = makeClientId('msg');

      const dispatchSend = async (targetConvId: string) => {
        const newMsg: ChatMessage = {
          id: msgId,
          senderId: currentUserRef.current.id,
          text: body,
          timestamp: 'الآن',
          isOwn: true,
          kind: 'text',
          status: 'sent',
        };
        setMessagesByConversation((prev) => ({
          ...prev,
          [targetConvId]: [...(prev[targetConvId] ?? []), newMsg],
        }));
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetConvId
              ? { ...c, lastMessage: `أنت: ${body}`, lastMessageTime: new Date().toISOString() }
              : c
          )
        );
        if (serverOnlineRef.current) {
          await syncApi(`/api/conversations/${encodeURIComponent(targetConvId)}/messages`, {
            method: 'POST',
            body: JSON.stringify({ id: msgId, clientMsgId: msgId, text: body }),
          });
        }
      };

      if (existingConv) {
        void dispatchSend(existingConv.id);
        return;
      }

      if (!serverOnlineRef.current) {
        const localConvId = makeClientId('conv');
        const newConv: ChatConversation = {
          id: localConvId,
          peerId: targetUser.id,
          title: targetUser.displayName,
          avatarUrl: targetUser.avatarUrl,
          lastMessage: `أنت: ${body}`,
          lastMessageTime: new Date().toISOString(),
          unreadCount: 0,
          isOnline: false,
        };
        setConversations((prev) => [newConv, ...prev]);
        void dispatchSend(localConvId);
        return;
      }

      void apiFetch<{ id: string; conversation: ChatConversation }>('/api/conversations/start', {
        method: 'POST',
        body: JSON.stringify({ recipientId: targetUser.id }),
      })
        .then((res) => {
          setConversations((prev) =>
            prev.some((c) => c.id === res.id) ? prev : [res.conversation, ...prev]
          );
          return dispatchSend(res.id);
        })
        .catch((err) => handleApiError(err, 'تعذّر إرسال الرد'));
    },
    [
      conversationsRef,
      currentUserRef,
      handleApiError,
      requireAuthForWrite,
      serverOnlineRef,
      setConversations,
      setMessagesByConversation,
      syncApi,
    ]
  );

  const storyTrayUsers = buildStoryTrayUsers(
    currentUser.id,
    users,
    storiesByUser,
    storyStorage.seen
  );

  const hasUserUnseenStory = useCallback(
    (userId: string) => hasUserUnseenStories(storiesByUser[userId] ?? [], storyStorage.seen),
    [storiesByUser, storyStorage.seen]
  );

  const deleteStory = useCallback(
    async (storyId: string): Promise<boolean> => {
      if (!requireAuthForWrite()) return false;
      const prevStories = storiesByUser;
      const prevHasActiveStory = currentUserRef.current.hasActiveStory;
      setStoriesByUser((prev) => {
        const next: Record<string, StoryItem[]> = {};
        for (const [uid, items] of Object.entries(prev)) {
          const filtered = items.filter((item) => item.id !== storyId);
          if (filtered.length > 0) next[uid] = filtered;
        }
        const ownRemaining = next[currentUser.id] ?? [];
        if (ownRemaining.length === 0) {
          setCurrentUser((u) => ({ ...u, hasActiveStory: false, hasUnseenStory: false }));
        }
        return next;
      });
      if (!serverOnlineRef.current) return true;
      try {
        await apiFetch(`/api/stories/${encodeURIComponent(storyId)}`, { method: 'DELETE' });
        showAppToast('تم حذف القصة', 'success');
        return true;
      } catch (err) {
        setStoriesByUser(prevStories);
        setCurrentUser((u) => ({ ...u, hasActiveStory: prevHasActiveStory }));
        handleApiError(err, 'تعذّر حذف القصة');
        return false;
      }
    },
    [currentUser.id, currentUserRef, handleApiError, requireAuthForWrite, serverOnlineRef, setCurrentUser, showAppToast, storiesByUser]
  );

  const voteStoryPoll = useCallback(
    async (storyId: string, optionIndex: number) => {
      if (!requireAuthForWrite()) return;
      try {
        const res = await apiFetch<{ pollVotes: number[]; userVotedOptionIndex: number }>(
          `/api/stories/${encodeURIComponent(storyId)}/vote`,
          {
            method: 'POST',
            body: JSON.stringify({ optionIndex }),
          }
        );
        setStoriesByUser((prev) => {
          const next: Record<string, StoryItem[]> = {};
          for (const [uid, list] of Object.entries(prev)) {
            next[uid] = list.map((s) =>
              s.id === storyId
                ? { ...s, pollVotes: res.pollVotes, userVotedOptionIndex: res.userVotedOptionIndex }
                : s
            );
          }
          return next;
        });
      } catch (err) {
        handleApiError(err, 'تعذّر تسجيل التصويت');
      }
    },
    [handleApiError, requireAuthForWrite]
  );

  const undoLastStory = useCallback(() => {
    if (!storyToast) return;
    const targetId = storyToast.storyId;
    void deleteStory(targetId);
    dismissStoryToast();
  }, [deleteStory, dismissStoryToast, storyToast]);

  return {
    storiesByUser,
    setStoriesByUser,
    storyStorage,
    setStoryStorage,
    storyMuted,
    setStoryMuted,
    socialMoments,
    setSocialMoments,
    seenInstantIds,
    setSeenInstantIds,
    storyToast,
    setStoryToast,
    dismissStoryToast,
    storyTrayUsers,
    hasUserUnseenStory,
    markStorySeen,
    saveStoryProgress,
    clearUserStoryProgress,
    publishStory,
    deleteStory,
    voteStoryPoll,
    undoLastStory,
    publishNote,
    deleteOwnNote,
    publishInstantMoment,
    replyToMoment,
    markInstantSeen,
  };
}
