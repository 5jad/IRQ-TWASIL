import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../index.ts';
import { ensureSeeded } from '../seed.ts';
import {
  communitiesTable,
  communityMembersTable,
  communityMessagesTable,
  ordersTable,
  productsTable,
  reactionsTable,
  usersTable,
  walletTransactionsTable,
} from '../schema.ts';
import { toPublicUser } from '../../server/dto.ts';
import { deleteMediaByIdOrUrl } from '../../server/media.ts';
import {
  DomainError,
  claimReadyMediaForUse,
  createAndEmitNotification,
} from './shared.ts';
import type {
  CommunityItem,
  CommunityMessage,
  MarketOrder,
  Product,
  WalletTransaction,
} from '../../types/index.ts';

export async function createProductInDb(
  actorId: string,
  input: {
    title: string;
    priceIqd: number;
    compareAtPriceIqd?: number;
    category: string;
    condition: 'new' | 'used';
    city: string;
    province: string;
    mediaId?: string;
  }
): Promise<Product> {
  await ensureSeeded();
  const db = getDb();
  const [seller] = await db.select().from(usersTable).where(eq(usersTable.id, actorId)).limit(1);
  if (!seller) {
    throw new DomainError(404, 'not_found', 'المستخدم غير موجود');
  }

  const id = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let imageUrl = '';
  if (input.mediaId) {
    const claimed = await claimReadyMediaForUse(input.mediaId, actorId, 'product', id);
    imageUrl = claimed.publicUrl;
  }

  const sortOrder = -Math.floor(Date.now() / 1000);
  await db.insert(productsTable).values({
    id,
    sellerId: actorId,
    title: input.title,
    priceIqd: input.priceIqd,
    compareAtPriceIqd: input.compareAtPriceIqd ?? null,
    shopName: seller.displayName,
    shopVerified: seller.isVerified,
    city: input.city,
    province: input.province,
    category: input.category,
    condition: input.condition,
    imageUrl,
    inStock: true,
    ratingAvg: 5,
    reviewCount: 0,
    isWishlisted: false,
    sortOrder,
  });

  return {
    id,
    sellerId: actorId,
    title: input.title,
    priceIqd: input.priceIqd,
    compareAtPriceIqd: input.compareAtPriceIqd,
    shopName: seller.displayName,
    shopVerified: seller.isVerified,
    city: input.city,
    province: input.province,
    category: input.category,
    condition: input.condition,
    imageUrl,
    inStock: true,
    ratingAvg: 5,
    reviewCount: 0,
    isWishlisted: false,
  };
}

export async function deleteProductInDb(actorId: string, productId: string, actorRole?: string) {
  const db = getDb();
  const [prod] = await db
    .select({ id: productsTable.id, sellerId: productsTable.sellerId, imageUrl: productsTable.imageUrl })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);
  if (!prod) return null;
  if (prod.sellerId !== actorId && actorRole !== 'admin' && actorRole !== 'moderator') {
    throw new DomainError(403, 'forbidden', 'لا يمكنك حذف منتج لا تملكه');
  }
  await db.delete(productsTable).where(eq(productsTable.id, productId));
  if (prod.imageUrl) {
    await deleteMediaByIdOrUrl(null, prod.imageUrl).catch(() => undefined);
  }
  return { deleted: true };
}

export async function createOrderInDb(
  buyerId: string,
  input: { productId: string; note?: string }
): Promise<MarketOrder> {
  await ensureSeeded();
  const db = getDb();
  const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, input.productId)).limit(1);
  if (!prod) {
    throw new DomainError(404, 'not_found', 'المنتج غير موجود');
  }

  const id = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date();
  await db.insert(ordersTable).values({
    id,
    buyerId,
    sellerId: prod.sellerId ?? null,
    productId: prod.id,
    priceIqd: prod.priceIqd,
    status: 'pending',
    note: input.note ?? '',
    createdAt: now,
    updatedAt: now,
  });

  if (prod.sellerId && prod.sellerId !== buyerId) {
    await createAndEmitNotification({
      actorId: buyerId,
      recipientId: prod.sellerId,
      kind: 'order',
      targetText: `طلب جديد على: ${prod.title}`,
      mediaThumbnailUrl: prod.imageUrl || undefined,
    }).catch(() => undefined);
  }

  return {
    id,
    buyerId,
    sellerId: prod.sellerId ?? undefined,
    productId: prod.id,
    productTitle: prod.title,
    productImageUrl: prod.imageUrl,
    priceIqd: prod.priceIqd,
    status: 'pending',
    note: input.note ?? '',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export async function updateOrderStatusInDb(
  actorId: string,
  orderId: string,
  status: MarketOrder['status']
): Promise<MarketOrder | null> {
  await ensureSeeded();
  const db = getDb();
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) return null;

  const isBuyer = order.buyerId === actorId;
  const isSeller = order.sellerId === actorId;
  if (!isBuyer && !isSeller) {
    throw new DomainError(403, 'forbidden', 'لا تملك صلاحية تعديل هذا الطلب');
  }
  if (isBuyer && !isSeller && status !== 'cancelled') {
    throw new DomainError(403, 'forbidden', 'يمكن للمشتري إلغاء الطلب فقط');
  }

  const updatedAt = new Date();
  await db.update(ordersTable).set({ status, updatedAt }).where(eq(ordersTable.id, orderId));

  const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, order.productId)).limit(1);

  const notifyRecipient = isSeller ? order.buyerId : order.sellerId;
  if (notifyRecipient && notifyRecipient !== actorId) {
    const statusLabel =
      status === 'confirmed'
        ? 'تم تأكيد طلبك'
        : status === 'completed'
        ? 'تم إكمال طلبك'
        : status === 'cancelled'
        ? 'تم إلغاء الطلب'
        : 'تم تحديث حالة الطلب';
    await createAndEmitNotification({
      actorId,
      recipientId: notifyRecipient,
      kind: 'order',
      targetText: `${statusLabel}: ${prod?.title ?? 'منتج'}`,
      mediaThumbnailUrl: prod?.imageUrl || undefined,
    }).catch(() => undefined);
  }

  return {
    id: order.id,
    buyerId: order.buyerId,
    sellerId: order.sellerId ?? undefined,
    productId: order.productId,
    productTitle: prod?.title ?? 'منتج',
    productImageUrl: prod?.imageUrl ?? '',
    priceIqd: order.priceIqd,
    status,
    note: order.note,
    createdAt: order.createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export async function topupWalletInDb(
  targetUserId: string,
  amountCoins: number,
  adminActorId?: string
): Promise<{ walletBalance: number; transaction: WalletTransaction }> {
  await ensureSeeded();
  const db = getDb();
  const txId = `wtx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date();
  const description = adminActorId
    ? `منح رصيد تجريبي من الإدارة (+${amountCoins} نقطة)`
    : `شحن رصيد تجريبي (+${amountCoins} نقطة)`;

  const updatedUser = await db.transaction(async (tx) => {
    const [u] = await tx
      .update(usersTable)
      .set({ walletBalance: sql`${usersTable.walletBalance} + ${amountCoins}` })
      .where(eq(usersTable.id, targetUserId))
      .returning({ walletBalance: usersTable.walletBalance });

    if (!u) {
      throw new DomainError(404, 'not_found', 'المستخدم غير موجود');
    }

    await tx.insert(walletTransactionsTable).values({
      id: txId,
      userId: targetUserId,
      kind: 'topup',
      amountCoins,
      description,
      relatedUserId: adminActorId ?? null,
      createdAt: now,
    });
    return u;
  });

  return {
    walletBalance: updatedUser.walletBalance,
    transaction: {
      id: txId,
      userId: targetUserId,
      kind: 'topup',
      amountCoins,
      description,
      relatedUserId: adminActorId,
      createdAt: now.toISOString(),
    },
  };
}

export async function spendCoinsForGiftInDb(
  senderId: string,
  input: { recipientId: string; amountCoins: number; giftLabel: string }
): Promise<{ walletBalance: number; transaction: WalletTransaction }> {
  await ensureSeeded();
  const db = getDb();

  const [recipient] = await db
    .select({ id: usersTable.id, displayName: usersTable.displayName, status: usersTable.status })
    .from(usersTable)
    .where(and(eq(usersTable.id, input.recipientId), eq(usersTable.status, 'active')))
    .limit(1);

  if (!recipient) {
    throw new DomainError(404, 'not_found', 'المستلم غير موجود');
  }

  const now = new Date();
  const txSendId = `wtx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const descSend = `إرسال هدية "${input.giftLabel}" إلى ${recipient.displayName}`;

  const nextBalance = await db.transaction(async (tx) => {
    const [senderRow] = await tx
      .select({ walletBalance: usersTable.walletBalance })
      .from(usersTable)
      .where(eq(usersTable.id, senderId))
      .limit(1);
    if (!senderRow) {
      throw new DomainError(404, 'not_found', 'المستخدم غير موجود');
    }
    if (senderRow.walletBalance < input.amountCoins) {
      throw new DomainError(400, 'insufficient_balance', 'رصيد المحفظة غير كافٍ لإرسال هذه الهدية');
    }

    const [updatedSender] = await tx
      .update(usersTable)
      .set({ walletBalance: sql`${usersTable.walletBalance} - ${input.amountCoins}` })
      .where(eq(usersTable.id, senderId))
      .returning({ walletBalance: usersTable.walletBalance });

    await tx.insert(walletTransactionsTable).values({
      id: txSendId,
      userId: senderId,
      kind: 'gift_sent',
      amountCoins: -input.amountCoins,
      description: descSend,
      relatedUserId: input.recipientId,
      createdAt: now,
    });

    if (input.recipientId !== senderId) {
      await tx
        .update(usersTable)
        .set({ walletBalance: sql`${usersTable.walletBalance} + ${input.amountCoins}` })
        .where(eq(usersTable.id, input.recipientId));
      await tx.insert(walletTransactionsTable).values({
        id: `wtx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: input.recipientId,
        kind: 'gift_received',
        amountCoins: input.amountCoins,
        description: `استلام هدية "${input.giftLabel}"`,
        relatedUserId: senderId,
        createdAt: now,
      });
    }

    return updatedSender.walletBalance;
  });

  if (input.recipientId !== senderId) {
    await createAndEmitNotification({
      actorId: senderId,
      recipientId: input.recipientId,
      kind: 'system',
      targetText: `أرسل لك هدية ${input.giftLabel} (${input.amountCoins} نقطة)`,
    }).catch(() => undefined);
  }

  return {
    walletBalance: nextBalance,
    transaction: {
      id: txSendId,
      userId: senderId,
      kind: 'gift_sent',
      amountCoins: -input.amountCoins,
      description: descSend,
      relatedUserId: input.recipientId,
      createdAt: now.toISOString(),
    },
  };
}

export async function toggleWishlistProductInDb(actorId: string, productId: string) {
  await ensureSeeded();
  const db = getDb();
  const [prod] = await db
    .select({ id: productsTable.id })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  if (!prod) return null;

  const [existing] = await db
    .select()
    .from(reactionsTable)
    .where(
      and(
        eq(reactionsTable.userId, actorId),
        eq(reactionsTable.targetType, 'product_wishlist'),
        eq(reactionsTable.targetId, productId)
      )
    )
    .limit(1);

  const nextWishlisted = !existing;
  if (nextWishlisted) {
    await db.insert(reactionsTable).values({
      userId: actorId,
      targetType: 'product_wishlist',
      targetId: productId,
      value: '1',
    });
  } else {
    await db
      .delete(reactionsTable)
      .where(
        and(
          eq(reactionsTable.userId, actorId),
          eq(reactionsTable.targetType, 'product_wishlist'),
          eq(reactionsTable.targetId, productId)
        )
      );
  }

  return { isWishlisted: nextWishlisted };
}

export async function addCommunityInDb(
  actorId: string,
  input: {
    id: string;
    name: string;
    province: string;
    category?: string;
    isPrivate?: boolean;
    description: string;
    icon?: string;
  }
): Promise<CommunityItem> {
  await ensureSeeded();
  const db = getDb();
  const category = input.category ?? 'عام';
  const isPrivate = Boolean(input.isPrivate);
  const icon = input.icon ?? '';

  await db.transaction(async (tx) => {
    await tx.insert(communitiesTable).values({
      id: input.id,
      creatorId: actorId,
      name: input.name,
      membersCount: 1,
      province: input.province,
      category,
      isPrivate,
      description: input.description,
      icon,
      sortTs: Date.now(),
    });
    await tx
      .insert(communityMembersTable)
      .values({ communityId: input.id, userId: actorId, role: 'admin' })
      .onConflictDoNothing();
  });

  return {
    id: input.id,
    creatorId: actorId,
    name: input.name,
    membersCount: 1,
    province: input.province,
    category,
    isPrivate,
    isJoined: true,
    description: input.description,
    icon,
  };
}

export async function joinCommunityInDb(actorId: string, communityId: string) {
  await ensureSeeded();
  const db = getDb();
  const [comm] = await db
    .select()
    .from(communitiesTable)
    .where(eq(communitiesTable.id, communityId))
    .limit(1);
  if (!comm) return null;

  return db.transaction(async (tx) => {
    await tx
      .insert(communityMembersTable)
      .values({ communityId, userId: actorId, role: 'member' })
      .onConflictDoNothing();

    const [{ cnt }] = await tx
      .select({ cnt: sql<number>`count(*)::int` })
      .from(communityMembersTable)
      .where(eq(communityMembersTable.communityId, communityId));
    const membersCount = Math.max(1, Number(cnt ?? 1));
    await tx.update(communitiesTable).set({ membersCount }).where(eq(communitiesTable.id, communityId));
    return { isJoined: true, membersCount };
  });
}

export async function leaveCommunityInDb(actorId: string, communityId: string) {
  await ensureSeeded();
  const db = getDb();
  const [comm] = await db
    .select()
    .from(communitiesTable)
    .where(eq(communitiesTable.id, communityId))
    .limit(1);
  if (!comm) return null;

  return db.transaction(async (tx) => {
    await tx
      .delete(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.userId, actorId)));

    const [{ cnt }] = await tx
      .select({ cnt: sql<number>`count(*)::int` })
      .from(communityMembersTable)
      .where(eq(communityMembersTable.communityId, communityId));
    const membersCount = Math.max(0, Number(cnt ?? 0));
    await tx.update(communitiesTable).set({ membersCount }).where(eq(communitiesTable.id, communityId));
    return { isJoined: false, membersCount };
  });
}

export async function sendCommunityMessageInDb(
  actorId: string,
  communityId: string,
  input: { channel: 'general' | 'announcements'; text: string }
): Promise<CommunityMessage> {
  await ensureSeeded();
  const db = getDb();

  const [comm] = await db
    .select()
    .from(communitiesTable)
    .where(eq(communitiesTable.id, communityId))
    .limit(1);
  if (!comm) {
    throw new DomainError(404, 'not_found', 'المجتمع غير موجود');
  }

  const [memberRow] = await db
    .select({ role: communityMembersTable.role })
    .from(communityMembersTable)
    .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.userId, actorId)))
    .limit(1);

  if (!memberRow) {
    if (comm.isPrivate) {
      throw new DomainError(403, 'forbidden', 'هذا المجتمع خاص ويتطلب العضوية أولاً');
    }
    await joinCommunityInDb(actorId, communityId);
  }

  if (input.channel === 'announcements') {
    const isAdminOrCreator =
      comm.creatorId === actorId ||
      memberRow?.role === 'admin' ||
      memberRow?.role === 'moderator';
    if (!isAdminOrCreator) {
      throw new DomainError(403, 'forbidden', 'النشر في الإعلانات متاح لمشرفي المجتمع فقط');
    }
  }

  const [senderRow] = await db.select().from(usersTable).where(eq(usersTable.id, actorId)).limit(1);
  if (!senderRow) {
    throw new DomainError(404, 'not_found', 'المستخدم غير موجود');
  }

  const id = `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date();
  const sortTs = now.getTime();
  await db.insert(communityMessagesTable).values({
    id,
    communityId,
    senderId: actorId,
    channel: input.channel,
    text: input.text,
    createdAt: now,
    sortTs,
  });

  return {
    id,
    communityId,
    senderId: actorId,
    sender: toPublicUser(senderRow),
    channel: input.channel,
    text: input.text,
    createdAt: now.toISOString(),
  };
}
