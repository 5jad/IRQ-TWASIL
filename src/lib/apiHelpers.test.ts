import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDigits,
  normalizeOtpDigits,
  isValidIraqiPhoneInput,
  validateClientHandle,
  normalizeMediaMime,
  inferMimeFromExtension,
  sniffMimeFromBytes,
  isVideoSource,
  inferChatMediaKind,
  mergeIncomingMessage,
  applyDeltaConversationUnreads,
} from './apiHelpers.ts';
import type { ChatConversation, ChatMessage } from '../types/index.ts';

test('normalizeDigits converts Arabic-Indic and Extended Arabic-Indic numerals', () => {
  assert.equal(normalizeDigits('٠٧٧٠١٢٣٤٥٦٧'), '07701234567');
  assert.equal(normalizeDigits('۰۷۸۰۹۹۸۸۷۷۶'), '07809988776');
  assert.equal(normalizeDigits('+964 770-123-4567'), '+964 770-123-4567');
});

test('normalizeOtpDigits strips non-digits and clamps to 6 digits', () => {
  assert.equal(normalizeOtpDigits('١٢-٣٤ ٥٦٧٨'), '123456');
  assert.equal(normalizeOtpDigits('09ab87'), '0987');
});

test('isValidIraqiPhoneInput validates 07x / +9647x / 7x numbers only', () => {
  assert.equal(isValidIraqiPhoneInput('07701234567'), true);
  assert.equal(isValidIraqiPhoneInput('٠٧٨٠ ١٢٣ ٤٥٦٧'), true);
  assert.equal(isValidIraqiPhoneInput('+9647901234567'), true);
  assert.equal(isValidIraqiPhoneInput('7712345678'), true);
  assert.equal(isValidIraqiPhoneInput('07101234567'), false);
  assert.equal(isValidIraqiPhoneInput('12345'), false);
  assert.equal(isValidIraqiPhoneInput('+15551234567'), false);
});

test('validateClientHandle enforces length, charset, dot rules, and reserved names', () => {
  assert.deepEqual(validateClientHandle('  @Baghdad_01 '), { ok: true, handle: 'baghdad_01' });
  assert.equal(validateClientHandle('ab').ok, false);
  assert.equal(validateClientHandle('a'.repeat(21)).ok, false);
  assert.equal(validateClientHandle('.baghdad').ok, false);
  assert.equal(validateClientHandle('baghdad.').ok, false);
  assert.equal(validateClientHandle('bagh..dad').ok, false);
  assert.equal(validateClientHandle('admin').ok, false);
  assert.equal(validateClientHandle('news_bot').ok, false);
  assert.equal(validateClientHandle('ali$baghdad').ok, false);
});

test('normalizeMediaMime, sniffMimeFromBytes, inferMimeFromExtension, and isVideoSource detect real media types', () => {
  assert.equal(normalizeMediaMime('image/jpg; charset=utf-8'), 'image/jpeg');
  assert.equal(normalizeMediaMime('audio/mp3'), 'audio/mpeg');
  assert.equal(normalizeMediaMime('video/x-m4v'), 'video/mp4');
  assert.equal(normalizeMediaMime('video/x-matroska'), 'video/webm');
  assert.equal(normalizeMediaMime(''), 'application/octet-stream');
  assert.equal(inferChatMediaKind('image/jpg'), 'image');
  assert.equal(inferChatMediaKind('image/webp'), 'image');
  assert.equal(inferChatMediaKind('application/pdf'), 'file');

  assert.equal(inferMimeFromExtension('photo.HEIC'), null);
  assert.equal(inferMimeFromExtension('clip.MOV'), 'video/quicktime');
  assert.equal(inferMimeFromExtension('clip.webm'), 'video/webm');
  assert.equal(inferMimeFromExtension('pic.jfif'), 'image/jpeg');

  assert.equal(sniffMimeFromBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(
    sniffMimeFromBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/png'
  );
  assert.equal(sniffMimeFromBytes(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f])), 'video/webm');
  assert.equal(
    sniffMimeFromBytes(new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d])),
    'video/mp4'
  );

  assert.equal(isVideoSource(new File([new Uint8Array([1, 2])], 'clip.mp4', { type: '' })), true);
  assert.equal(isVideoSource(new File([new Uint8Array([1, 2])], 'pic.png', { type: 'image/png' })), false);
  assert.equal(isVideoSource('data:video/webm;base64,GkXf'), true);
});

test('mergeIncomingMessage appends new messages and updates existing IDs without duplication', () => {
  const initial: ChatMessage[] = [
    { id: 'm-1', senderId: 'u-1', text: 'مرحبا', timestamp: '10:00', isOwn: false, kind: 'text', status: 'read' },
  ];
  const appended = mergeIncomingMessage(initial, {
    id: 'm-2',
    senderId: 'u-me',
    text: 'أهلاً',
    timestamp: '10:01',
    isOwn: true,
    kind: 'text',
    status: 'sent',
  });
  assert.equal(appended.length, 2);

  const edited = mergeIncomingMessage(appended, {
    id: 'm-2',
    senderId: 'u-me',
    text: 'أهلاً وسهلاً',
    timestamp: '10:01',
    isOwn: true,
    kind: 'text',
    status: 'read',
  });
  assert.equal(edited.length, 2);
  assert.equal(edited[1]?.text, 'أهلاً وسهلاً');
  assert.equal(edited[1]?.status, 'read');
});

test('applyDeltaConversationUnreads updates only modified unread counts and preserves identity when unchanged', () => {
  const base: ChatConversation[] = [
    {
      id: 'c-1',
      title: 'نور',
      avatarUrl: '/seed/avatar-1.svg',
      lastMessage: 'مرحبا',
      lastMessageTime: '2026-11-15T00:00:00Z',
      unreadCount: 1,
    },
    {
      id: 'c-2',
      title: 'أحمد',
      avatarUrl: '/seed/avatar-2.svg',
      lastMessage: 'تمام',
      lastMessageTime: '2026-11-15T00:00:00Z',
      unreadCount: 0,
    },
  ];
  assert.equal(applyDeltaConversationUnreads(base, { 'c-1': 1 }), base);
  const updated = applyDeltaConversationUnreads(base, { 'c-1': 3 });
  assert.notEqual(updated, base);
  assert.equal(updated[0]?.unreadCount, 3);
  assert.equal(updated[1]?.unreadCount, 0);
});
