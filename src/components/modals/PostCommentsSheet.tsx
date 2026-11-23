import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Avatar, VerifiedBadge } from '../ui/Avatar';
import { Heart, Send, X, CornerDownLeft, ShieldAlert } from 'lucide-react';
import { formatRelativeTime, formatCompactCount } from '../../lib/formatters';
import { Modal } from '../ui/Modal';
import type { PostComment } from '../../types';

export function PostCommentsSheet() {
  const {
    posts,
    activePostComments,
    setActivePostComments,
    addCommentToPost,
    likeComment,
    openReportModal,
    numeralSystem,
    currentUser,
    loadingCommentsByPostId,
    loadPostComments,
  } = useApp();

  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; displayName: string; username: string } | null>(null);

  const livePost = activePostComments
    ? posts.find((p) => p.id === activePostComments.id) ?? activePostComments
    : null;

  useEffect(() => {
    if (!livePost) return;
    if (livePost.comments === undefined) {
      void loadPostComments(livePost.id);
    }
  }, [livePost?.id, livePost?.comments, loadPostComments]);

  const isLoadingComments = Boolean(livePost && loadingCommentsByPostId[livePost.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !livePost) return;
    addCommentToPost(livePost.id, commentText, replyingTo?.id);
    setCommentText('');
    setReplyingTo(null);
  };

  const comments = livePost?.comments ?? [];

  const renderCommentNode = (comm: PostComment, depth = 0) => (
    <div key={comm.id} className="flex flex-col gap-2 group">
      <div className="flex items-start gap-2.5">
        <Avatar
          src={comm.author.avatarUrl}
          name={comm.author.displayName}
          size={depth === 0 ? 34 : 28}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-[var(--text)]">
                {comm.author.displayName}
              </span>
              <VerifiedBadge kind={comm.author.verifiedKind} size={depth === 0 ? 12 : 11} />
              <span className="text-[11px] text-[var(--text-muted)]">
                {formatRelativeTime(comm.createdAt, undefined, numeralSystem)}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {livePost && (
                <button
                  type="button"
                  onClick={() => likeComment(livePost.id, comm.id)}
                  className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--danger)] active:scale-90 transition-transform"
                  aria-label="إعجاب بالتعليق"
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      comm.isLiked ? 'text-[var(--danger)] fill-[var(--danger)]' : ''
                    }`}
                  />
                  {comm.likesCount > 0 && (
                    <span className="text-[11px] font-bold">
                      {formatCompactCount(comm.likesCount, numeralSystem)}
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => openReportModal('comment', `تعليق من ${comm.author.displayName}`, comm.id)}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--text-muted)] hover:text-[var(--danger)] transition-opacity p-0.5"
                title="إبلاغ"
                aria-label="إبلاغ"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-xs text-[var(--text)] leading-relaxed mt-1 whitespace-pre-wrap">
            {comm.text}
          </p>

          <button
            type="button"
            onClick={() => {
              setReplyingTo({
                id: comm.id,
                displayName: comm.author.displayName,
                username: comm.author.username,
              });
              setCommentText(`@${comm.author.username} `);
            }}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--primary)] font-semibold mt-1 flex items-center gap-1"
          >
            <CornerDownLeft className="w-3 h-3" />
            <span>رد</span>
          </button>
        </div>
      </div>

      {comm.replies && comm.replies.length > 0 && (
        <div
          className={`${
            depth === 0 ? 'ms-9 ps-3' : 'ms-6 ps-2.5'
          } border-s-2 border-[var(--border)] space-y-3 mt-1`}
        >
          {comm.replies.map((reply) => renderCommentNode(reply, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={Boolean(livePost)}
      onClose={() => {
        setReplyingTo(null);
        setActivePostComments(null);
      }}
      title="التعليقات"
      testId="tw-comments-sheet"
      className="items-end sm:items-center p-0 sm:p-4"
      contentClassName="sm:max-w-lg"
    >
      {livePost && (
        <div className="w-full bg-[var(--surface)] text-[var(--text)] rounded-t-3xl sm:rounded-3xl border border-[var(--border)] shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] select-none">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[var(--text)]">التعليقات</h3>
              <span className="px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-xs font-semibold text-[var(--text-muted)]">
                {formatCompactCount(livePost.commentsCount, numeralSystem)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setReplyingTo(null);
                setActivePostComments(null);
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] transition-colors active:scale-95"
              aria-label="إغلاق التعليقات"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Post Author Context Preview */}
          <div className="px-5 py-3 bg-[var(--surface-2)]/60 border-b border-[var(--border)] flex items-start gap-3">
            <Avatar
              src={livePost.author.avatarUrl}
              name={livePost.author.displayName}
              size={36}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-[var(--text)]">
                  {livePost.author.displayName}
                </span>
                <VerifiedBadge kind={livePost.author.verifiedKind} size={13} />
              </div>
              <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-0.5 leading-relaxed">
                {livePost.text}
              </p>
            </div>
          </div>

          {/* Comments Stream */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {isLoadingComments && comments.length === 0 ? (
              <div className="space-y-3 py-2" data-testid="tw-comments-loading">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-start gap-2.5 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-28 rounded bg-[var(--surface-2)]" />
                      <div className="h-3 w-full rounded bg-[var(--surface-2)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-[var(--text-muted)]">
                <span className="text-3xl mb-2">💬</span>
                <p className="text-sm font-semibold">لا توجد تعليقات بعد</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">كن أول من يشارك برأيه في هذا المنشور!</p>
              </div>
            ) : (
              comments.map((comm) => renderCommentNode(comm, 0))
            )}
          </div>

          {/* Input Composer fixed at bottom */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-[var(--border)] bg-[var(--surface)] flex flex-col gap-2 select-none"
          >
            {replyingTo && (
              <div className="flex items-center justify-between text-xs text-[var(--primary-text)] font-semibold px-2">
                <span>الرد على: {replyingTo.displayName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(null);
                    setCommentText('');
                  }}
                  className="text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  إلغاء
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Avatar src={currentUser.avatarUrl} name={currentUser.displayName} size={34} />
              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={replyingTo ? `اكتب ردك على ${replyingTo.displayName}...` : 'أضف تعليقك...'}
                  className="w-full h-10 px-3.5 pe-12 rounded-full bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-hidden focus:border-[var(--primary)] transition-colors"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="absolute end-1.5 w-7 h-7 rounded-full bg-[var(--primary)] text-[var(--primary-fg)] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-xs -scale-x-100"
                  aria-label="إرسال التعليق"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}
