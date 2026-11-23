import { test } from 'node:test';
import assert from 'node:assert/strict';

test('19 Iraqi governorates list covers all authentic provinces', () => {
  const provinces = [
    'بغداد', 'البصرة', 'نينوى', 'أربيل', 'النجف الأشرف', 'كربلاء المقدسة',
    'السليمانية', 'كركوك', 'بابل', 'ذي قار', 'ميسان', 'ديالى',
    'الأنبار', 'واسط', 'القادسية', 'دهوك', 'صلاح الدين', 'المثنى', 'حلبجة'
  ];
  assert.equal(provinces.length, 19, 'Must strictly include all 19 Iraqi governorates');
  assert.ok(provinces.includes('بغداد'));
  assert.ok(provinces.includes('البصرة'));
  assert.ok(provinces.includes('حلبجة'));
  assert.ok(provinces.includes('النجف الأشرف'));
});

test('T-Coins virtual gift deductions', () => {
  let balance = 450;
  const spend = (cost: number) => {
    if (balance < cost) return false;
    balance -= cost;
    return true;
  };

  assert.equal(spend(50), true);
  assert.equal(balance, 400);

  assert.equal(spend(500), false); // Insufficient
  assert.equal(balance, 400); // Unchanged
});

test('Comment replies nesting structure', () => {
  const comment = {
    id: 'comm-1',
    authorId: 'u-1',
    text: 'رائع جداً',
    likesCount: 5,
    replies: [
      { id: 'rep-1', authorId: 'u-2', text: 'شكراً جزيلاً' },
    ],
  };

  assert.equal(comment.replies.length, 1);
  assert.equal(comment.replies[0]?.authorId, 'u-2');
});
