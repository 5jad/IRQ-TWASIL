import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canViewerSeePost,
  canViewerSeeStory,
  canViewerSeeMoment,
  shouldRequireTwoFactorLogin,
  findDirectConversation,
  type VisibilityContext,
} from './visibility';
import type { ChatConversation } from '../types';

const baseCtx = (overrides?: Partial<VisibilityContext>): VisibilityContext => ({
  viewerId: 'u-viewer',
  followingSet: new Set(['u-followed']),
  closeFriendOfSet: new Set(['u-close']),
  blockedIds: new Set(['u-blocked']),
  ...overrides,
});

test('canViewerSeePost enforces everyone, followers, friends, and guest visibility', () => {
  const ctx = baseCtx();
  assert.equal(canViewerSeePost('u-other', 'everyone', ctx), true);
  assert.equal(canViewerSeePost('u-other', 'everyone', baseCtx({ viewerId: null })), true);

  assert.equal(canViewerSeePost('u-followed', 'followers', ctx), true);
  assert.equal(canViewerSeePost('u-other', 'followers', ctx), false);
  assert.equal(canViewerSeePost('u-viewer', 'followers', ctx), true);
  assert.equal(canViewerSeePost('u-followed', 'followers', baseCtx({ viewerId: null })), false);

  assert.equal(canViewerSeePost('u-close', 'friends', ctx), true);
  assert.equal(canViewerSeePost('u-followed', 'friends', ctx), false);
  assert.equal(canViewerSeePost('u-viewer', 'friends', ctx), true);

  assert.equal(canViewerSeePost('u-blocked', 'everyone', ctx), false);
});

test('canViewerSeeStory enforces custom recipientIds and fails closed', () => {
  const ctx = baseCtx();
  assert.equal(canViewerSeeStory('u-other', 'custom', ['u-viewer', 'u-2'], ctx), true);
  assert.equal(canViewerSeeStory('u-other', 'custom', ['u-2'], ctx), false);
  assert.equal(canViewerSeeStory('u-viewer', 'custom', ['u-2'], ctx), true);
  assert.equal(canViewerSeeStory('u-other', 'custom', undefined, baseCtx({ viewerId: null })), false);
  // Missing recipientIds fails closed to author + close friends
  assert.equal(canViewerSeeStory('u-other', 'custom', undefined, ctx), false);
  assert.equal(canViewerSeeStory('u-close', 'custom', undefined, ctx), true);
});

test('canViewerSeeMoment restricts followers and custom moments from public/guests', () => {
  const guest = baseCtx({ viewerId: null });
  const ctx = baseCtx();

  assert.equal(canViewerSeeMoment('u-followed', 'followers', guest), false);
  assert.equal(canViewerSeeMoment('u-followed', 'followers', ctx), true);
  assert.equal(canViewerSeeMoment('u-other', 'followers', ctx), false);

  assert.equal(canViewerSeeMoment('u-other', 'custom', guest), false);
  assert.equal(canViewerSeeMoment('u-other', 'custom', ctx), false);
  assert.equal(canViewerSeeMoment('u-close', 'custom', ctx), true);
  assert.equal(canViewerSeeMoment('u-viewer', 'custom', ctx), true);
});

test('shouldRequireTwoFactorLogin requires both flag and verified encrypted phone', () => {
  assert.equal(
    shouldRequireTwoFactorLogin({ twoFactorEnabled: true, phoneHmac: 'hmac', phoneEnc: 'enc' }),
    true
  );
  assert.equal(
    shouldRequireTwoFactorLogin({ twoFactorEnabled: true, phoneHmac: null, phoneEnc: null }),
    false
  );
  assert.equal(
    shouldRequireTwoFactorLogin({ twoFactorEnabled: false, phoneHmac: 'hmac', phoneEnc: 'enc' }),
    false
  );
});

test('findDirectConversation matches strictly by peerId or 1:1 memberIds, never mutable title', () => {
  const convs: ChatConversation[] = [
    {
      id: 'c1',
      peerId: 'u-other',
      title: 'سجاد',
      avatarUrl: '',
      lastMessage: 'hi',
      lastMessageTime: '2026-01-01T00:00:00Z',
      unreadCount: 0,
    },
    {
      id: 'c2',
      memberIds: ['u-viewer', 'u-real-sajjad'],
      title: 'اسم مختلف',
      avatarUrl: '',
      lastMessage: 'hello',
      lastMessageTime: '2026-01-01T00:00:00Z',
      unreadCount: 0,
      isGroup: false,
    },
  ];

  // Even though c1 has title 'سجاد', it belongs to u-other, NOT u-new-sajjad
  assert.equal(findDirectConversation(convs, 'u-new-sajjad'), undefined);
  assert.equal(findDirectConversation(convs, 'u-other')?.id, 'c1');
  assert.equal(findDirectConversation(convs, 'u-real-sajjad')?.id, 'c2');
});
