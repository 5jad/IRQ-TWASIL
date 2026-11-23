import { useCallback, useState } from 'react';
import type { Post, PostComment, SavedCollection, User } from '../types';
import { apiFetch, uploadMediaSource } from '../lib/api';
import { isVideoSource } from '../lib/apiHelpers';
import {
  insertCommentInTree,
  makeClientId,
  toggleCommentLikeInTree,
} from './contextHelpers';

interface UseFeedStateDeps {
  serverOnlineRef: React.MutableRefObject<boolean>;
  currentUserRef: React.MutableRefObject<User>;
  setCurrentUser: React.Dispatch<React.SetStateAction<User>>;
  requireAuthForWrite: () => boolean;
  handleApiError: (err: unknown, fallbackMessage?: string) => void;
  showAppToast: (message: string, tone?: 'info' | 'error' | 'success') => void;
}

export function useFeedState({
  serverOnlineRef,
  currentUserRef,
  setCurrentUser,
  requireAuthForWrite,
  handleApiError,
  showAppToast,
}: UseFeedStateDeps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsNextCursor, setPostsNextCursor] = useState<string | null>(null);
  const [postsHasMore, setPostsHasMore] = useState<boolean>(false);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState<boolean>(false);
  const [loadingCommentsByPostId, setLoadingCommentsByPostId] = useState<Record<string, boolean>>({});
  const [activePostComments, setActivePostComments] = useState<Post | null>(null);
  const [savedCollections, setSavedCollections] = useState<SavedCollection[]>([]);

  const loadMorePosts = useCallback(async () => {
    if (!serverOnlineRef.current || isLoadingMorePosts || !postsHasMore || !postsNextCursor) {
      return;
    }
    setIsLoadingMorePosts(true);
    try {
      const res = await apiFetch<{
        posts: Post[];
        nextCursor: string | null;
        hasMore: boolean;
      }>(`/api/posts?limit=20&cursor=${encodeURIComponent(postsNextCursor)}`);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const appended = res.posts.filter((p) => !seen.has(p.id));
        return [...prev, ...appended];
      });
      setPostsNextCursor(res.nextCursor ?? null);
      setPostsHasMore(Boolean(res.hasMore));
    } catch (err) {
      handleApiError(err, 'تعذّر تحميل المزيد من المنشورات');
    } finally {
      setIsLoadingMorePosts(false);
    }
  }, [handleApiError, isLoadingMorePosts, postsHasMore, postsNextCursor, serverOnlineRef]);

  const loadPostComments = useCallback(
    async (postId: string) => {
      if (!serverOnlineRef.current) return;
      setLoadingCommentsByPostId((prev) => ({ ...prev, [postId]: true }));
      try {
        const res = await apiFetch<{ comments: PostComment[]; totalCount: number }>(
          `/api/posts/${encodeURIComponent(postId)}/comments`
        );
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, comments: res.comments, commentsCount: res.totalCount }
              : p
          )
        );
        setActivePostComments((prev) =>
          prev && prev.id === postId
            ? { ...prev, comments: res.comments, commentsCount: res.totalCount }
            : prev
        );
      } catch (err) {
        handleApiError(err, 'تعذّر تحميل التعليقات');
      } finally {
        setLoadingCommentsByPostId((prev) => ({ ...prev, [postId]: false }));
      }
    },
    [handleApiError, serverOnlineRef]
  );

  const fetchSinglePost = useCallback(
    async (postId: string): Promise<Post | null> => {
      if (!serverOnlineRef.current) return null;
      try {
        const res = await apiFetch<{ post: Post }>(`/api/posts/${encodeURIComponent(postId)}`);
        if (!res.post) return null;
        setPosts((prev) => (prev.some((p) => p.id === res.post.id) ? prev : [res.post, ...prev]));
        return res.post;
      } catch {
        return null;
      }
    },
    [serverOnlineRef]
  );

  const toggleLikePost = useCallback(
    (postId: string) => {
      if (!requireAuthForWrite()) return;
      let prevPostSnapshot: Post | undefined;
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          prevPostSnapshot = p;
          const isLiked = !p.isLiked;
          return {
            ...p,
            isLiked,
            likesCount: isLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1),
          };
        })
      );
      if (!serverOnlineRef.current) return;
      void apiFetch(`/api/posts/${encodeURIComponent(postId)}/like`, {
        method: 'POST',
        body: JSON.stringify({}),
      }).catch((err) => {
        if (prevPostSnapshot) {
          const snap = prevPostSnapshot;
          setPosts((prev) => prev.map((p) => (p.id === postId ? snap : p)));
        }
        handleApiError(err, 'تعذّر تحديث الإعجاب');
      });
    },
    [handleApiError, requireAuthForWrite, serverOnlineRef]
  );

  const toggleRepostPost = useCallback(
    (postId: string) => {
      if (!requireAuthForWrite()) return;
      let prevPostSnapshot: Post | undefined;
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          prevPostSnapshot = p;
          const isReposted = !p.isReposted;
          return {
            ...p,
            isReposted,
            repostsCount: isReposted ? p.repostsCount + 1 : Math.max(0, p.repostsCount - 1),
          };
        })
      );
      if (!serverOnlineRef.current) return;
      void apiFetch<{ isReposted: boolean; repostsCount: number }>(
        `/api/posts/${encodeURIComponent(postId)}/repost`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      )
        .then((res) => {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId ? { ...p, isReposted: res.isReposted, repostsCount: res.repostsCount } : p
            )
          );
          if (res.isReposted) {
            showAppToast('تمت إعادة النشر', 'success');
          }
        })
        .catch((err) => {
          if (prevPostSnapshot) {
            const snap = prevPostSnapshot;
            setPosts((prev) => prev.map((p) => (p.id === postId ? snap : p)));
          }
          handleApiError(err, 'تعذّر إعادة النشر');
        });
    },
    [handleApiError, requireAuthForWrite, serverOnlineRef, showAppToast]
  );

  const toggleSavePost = useCallback(
    (postId: string) => {
      if (!requireAuthForWrite()) return;
      let prevPostSnapshot: Post | undefined;
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          prevPostSnapshot = p;
          return { ...p, isSaved: !p.isSaved };
        })
      );
      if (!serverOnlineRef.current) return;
      void apiFetch(`/api/posts/${encodeURIComponent(postId)}/save`, {
        method: 'POST',
        body: JSON.stringify({}),
      }).catch((err) => {
        if (prevPostSnapshot) {
          const snap = prevPostSnapshot;
          setPosts((prev) => prev.map((p) => (p.id === postId ? snap : p)));
        }
        handleApiError(err, 'تعذّر حفظ المنشور');
      });
    },
    [handleApiError, requireAuthForWrite, serverOnlineRef]
  );

  const votePoll = useCallback(
    (postId: string, optionIndex: number) => {
      if (!requireAuthForWrite()) return;
      let prevPollSnapshot: Post['poll'] | undefined;
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId || !p.poll || p.poll.userVotedIndex !== undefined) return p;
          prevPollSnapshot = p.poll;
          const updatedOptions = p.poll.options.map((opt, i) =>
            i === optionIndex ? { ...opt, votes: opt.votes + 1 } : opt
          );
          return {
            ...p,
            poll: {
              ...p.poll,
              options: updatedOptions,
              totalVotes: p.poll.totalVotes + 1,
              userVotedIndex: optionIndex,
            },
          };
        })
      );
      if (!serverOnlineRef.current) return;
      void apiFetch(`/api/posts/${encodeURIComponent(postId)}/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionIndex }),
      }).catch((err) => {
        if (prevPollSnapshot) {
          const snap = prevPollSnapshot;
          setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, poll: snap } : p)));
        }
        handleApiError(err, 'تعذّر تسجيل التصويت');
      });
    },
    [handleApiError, requireAuthForWrite, serverOnlineRef]
  );

  const createPost = useCallback(
    async (
      text: string,
      mediaSource?: File | Blob | string | Array<File | Blob | string>,
      options?: {
        kind?: 'media' | 'text' | 'video' | 'reel';
        audioTrack?: string;
        location?: string;
        audience?: 'everyone' | 'followers' | 'friends';
        aspectRatio?: '4/5' | '1/1' | '16/9' | '9/16';
        isVideo?: boolean;
      }
    ): Promise<boolean> => {
      if (!requireAuthForWrite()) return false;
      const id = makeClientId('post');
      const createdAt = new Date().toISOString();

      const sources = Array.isArray(mediaSource)
        ? mediaSource.slice(0, 10)
        : mediaSource
        ? [mediaSource]
        : [];

      const localPreviewUrls = sources
        .map((src) =>
          typeof src === 'string'
            ? src
            : src instanceof Blob
            ? URL.createObjectURL(src)
            : ''
        )
        .filter(Boolean);

      const hasVideo = options?.isVideo ?? sources.some((src) => isVideoSource(src));
      const resolvedKind: Post['kind'] =
        options?.kind === 'reel'
          ? 'reel'
          : hasVideo && sources.length === 1
          ? 'video'
          : localPreviewUrls.length > 0
          ? 'media'
          : 'text';
      const resolvedAspectRatio = options?.aspectRatio ?? (resolvedKind === 'reel' ? '9/16' : '4/5');

      const newPost: Post = {
        id,
        author: currentUserRef.current,
        kind: resolvedKind,
        text,
        media:
          localPreviewUrls.length > 0
            ? localPreviewUrls.map((url) => ({
                url,
                aspectRatio: resolvedAspectRatio,
                alt: resolvedKind === 'reel' ? 'ريلز جديد' : 'منشور جديد',
              }))
            : undefined,
        audioTrack: options?.audioTrack,
        location: options?.location,
        audience: options?.audience,
        likesCount: 0,
        commentsCount: 0,
        repostsCount: 0,
        createdAt,
      };

      setPosts((prev) => [newPost, ...prev]);
      setCurrentUser((prev) => ({ ...prev, postsCount: prev.postsCount + 1 }));

      if (!serverOnlineRef.current) return true;

      try {
        const uploadedMediaIds: string[] = [];
        for (const src of sources) {
          const srcIsVideo = options?.isVideo && sources.length === 1 ? true : isVideoSource(src);
          const uploaded = await uploadMediaSource(
            src,
            srcIsVideo ? 'post-video' : 'post-image'
          );
          uploadedMediaIds.push(uploaded.mediaId);
        }

        const res = await apiFetch<{
          id: string;
          createdAt: string;
          media?: Post['media'];
          kind: Post['kind'];
          audioTrack?: string;
          location?: string;
        }>('/api/posts', {
          method: 'POST',
          body: JSON.stringify({
            id,
            text,
            ...(uploadedMediaIds.length === 1 ? { mediaId: uploadedMediaIds[0] } : {}),
            ...(uploadedMediaIds.length > 0 ? { mediaIds: uploadedMediaIds } : {}),
            ...(options?.kind ? { kind: options.kind } : {}),
            ...(options?.audioTrack ? { audioTrack: options.audioTrack } : {}),
            ...(options?.location ? { location: options.location } : {}),
            ...(options?.audience ? { audience: options.audience } : {}),
            ...(options?.aspectRatio ? { aspectRatio: options.aspectRatio } : {}),
            createdAt,
          }),
        });

        if (res.media || res.kind) {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === id
                ? {
                    ...p,
                    ...(res.media ? { media: res.media } : {}),
                    kind: res.kind,
                    ...(res.audioTrack ? { audioTrack: res.audioTrack } : {}),
                    ...(res.location ? { location: res.location } : {}),
                  }
                : p
            )
          );
        }
        return true;
      } catch (err) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        setCurrentUser((prev) => ({ ...prev, postsCount: Math.max(0, prev.postsCount - 1) }));
        handleApiError(err, resolvedKind === 'reel' ? 'تعذّر نشر الريلز' : 'تعذّر نشر المنشور');
        return false;
      }
    },
    [currentUserRef, handleApiError, requireAuthForWrite, serverOnlineRef, setCurrentUser]
  );

  const deletePost = useCallback(
    async (postId: string) => {
      if (!requireAuthForWrite()) return;
      const prevPosts = posts;
      const prevCount = currentUserRef.current.postsCount;
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setCurrentUser((prev) => ({
        ...prev,
        postsCount: Math.max(0, prev.postsCount - 1),
      }));
      if (serverOnlineRef.current) {
        try {
          await apiFetch(`/api/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' });
          showAppToast('تم حذف المنشور', 'success');
        } catch (err) {
          setPosts(prevPosts);
          setCurrentUser((prev) => ({ ...prev, postsCount: prevCount }));
          handleApiError(err, 'تعذّر حذف المنشور');
        }
      } else {
        showAppToast('تم حذف المنشور', 'success');
      }
    },
    [currentUserRef, handleApiError, posts, requireAuthForWrite, serverOnlineRef, setCurrentUser, showAppToast]
  );

  const addCommentToPost = useCallback(
    (postId: string, text: string, parentId?: string) => {
      if (!text.trim()) return;
      if (!requireAuthForWrite()) return;
      const id = makeClientId('comm');
      const createdAt = new Date().toISOString();
      const trimmed = text.trim();
      const newComment: PostComment = {
        id,
        parentId,
        author: currentUserRef.current,
        text: trimmed,
        createdAt,
        likesCount: 0,
        isLiked: false,
        replies: [],
      };

      const prevPostsSnapshot = posts;
      const prevActiveCommentsSnapshot = activePostComments;

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          return {
            ...p,
            commentsCount: p.commentsCount + 1,
            comments: insertCommentInTree(p.comments ?? [], newComment, parentId),
          };
        })
      );

      setActivePostComments((prev) => {
        if (!prev || prev.id !== postId) return prev;
        return {
          ...prev,
          commentsCount: prev.commentsCount + 1,
          comments: insertCommentInTree(prev.comments ?? [], newComment, parentId),
        };
      });

      if (!serverOnlineRef.current) return;
      void apiFetch(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          id,
          ...(parentId ? { parentId } : {}),
          text: trimmed,
          createdAt,
        }),
      }).catch((err) => {
        setPosts(prevPostsSnapshot);
        setActivePostComments(prevActiveCommentsSnapshot);
        handleApiError(err, 'تعذّر إضافة التعليق');
      });
    },
    [activePostComments, currentUserRef, handleApiError, posts, requireAuthForWrite, serverOnlineRef]
  );

  const likeComment = useCallback(
    (postId: string, commentId: string) => {
      if (!requireAuthForWrite()) return;
      const prevPostsSnapshot = posts;
      const prevActiveCommentsSnapshot = activePostComments;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId && p.comments
            ? { ...p, comments: toggleCommentLikeInTree(p.comments, commentId) }
            : p
        )
      );
      setActivePostComments((prev) =>
        prev && prev.id === postId && prev.comments
          ? { ...prev, comments: toggleCommentLikeInTree(prev.comments, commentId) }
          : prev
      );
      if (!serverOnlineRef.current) return;
      void apiFetch(`/api/comments/${encodeURIComponent(commentId)}/like`, {
        method: 'POST',
        body: JSON.stringify({}),
      }).catch((err) => {
        setPosts(prevPostsSnapshot);
        setActivePostComments(prevActiveCommentsSnapshot);
        handleApiError(err, 'تعذّر تحديث الإعجاب بالتعليق');
      });
    },
    [activePostComments, handleApiError, posts, requireAuthForWrite, serverOnlineRef]
  );

  const createSavedCollection = useCallback(
    async (name: string): Promise<SavedCollection | null> => {
      if (!requireAuthForWrite()) return null;
      const trimmed = name.trim();
      if (!trimmed) return null;
      try {
        const col = await apiFetch<SavedCollection>('/api/saved-collections', {
          method: 'POST',
          body: JSON.stringify({ name: trimmed }),
        });
        setSavedCollections((prev) => [...prev, col]);
        showAppToast('تم إنشاء المجموعة', 'success');
        return col;
      } catch (err) {
        handleApiError(err, 'تعذّر إنشاء المجموعة');
        return null;
      }
    },
    [handleApiError, requireAuthForWrite, showAppToast]
  );

  const deleteSavedCollection = useCallback(
    async (collectionId: string): Promise<boolean> => {
      if (!requireAuthForWrite()) return false;
      const prev = savedCollections;
      setSavedCollections((list) => list.filter((c) => c.id !== collectionId));
      try {
        await apiFetch(`/api/saved-collections/${encodeURIComponent(collectionId)}`, {
          method: 'DELETE',
        });
        showAppToast('تم حذف المجموعة', 'success');
        return true;
      } catch (err) {
        setSavedCollections(prev);
        handleApiError(err, 'تعذّر حذف المجموعة');
        return false;
      }
    },
    [handleApiError, requireAuthForWrite, savedCollections, showAppToast]
  );

  const toggleSavedCollectionItem = useCallback(
    async (collectionId: string, postId: string) => {
      if (!requireAuthForWrite()) return;
      const prev = savedCollections;
      setSavedCollections((list) =>
        list.map((c) => {
          if (c.id !== collectionId) return c;
          const exists = c.postIds.includes(postId);
          return {
            ...c,
            postIds: exists ? c.postIds.filter((id) => id !== postId) : [...c.postIds, postId],
          };
        })
      );
      try {
        await apiFetch(`/api/saved-collections/${encodeURIComponent(collectionId)}/items`, {
          method: 'POST',
          body: JSON.stringify({ postId }),
        });
      } catch (err) {
        setSavedCollections(prev);
        handleApiError(err, 'تعذّر تحديث المجموعة');
      }
    },
    [handleApiError, requireAuthForWrite, savedCollections]
  );

  return {
    posts,
    setPosts,
    postsNextCursor,
    setPostsNextCursor,
    postsHasMore,
    setPostsHasMore,
    isLoadingMorePosts,
    loadMorePosts,
    loadingCommentsByPostId,
    loadPostComments,
    fetchSinglePost,
    activePostComments,
    setActivePostComments,
    savedCollections,
    setSavedCollections,
    toggleLikePost,
    toggleRepostPost,
    toggleSavePost,
    votePoll,
    createPost,
    deletePost,
    addCommentToPost,
    likeComment,
    createSavedCollection,
    deleteSavedCollection,
    toggleSavedCollectionItem,
  };
}
