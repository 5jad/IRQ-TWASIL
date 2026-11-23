import { useCallback, useState } from 'react';
import type {
  CommunityItem,
  CommunityMessage,
  MarketOrder,
  Product,
  User,
  WalletTransaction,
} from '../types';
import { apiFetch, uploadMediaSource } from '../lib/api';
import { makeClientId } from './contextHelpers';

interface UseMarketWalletAndCommunitiesDeps {
  serverOnlineRef: React.MutableRefObject<boolean>;
  currentUserRef: React.MutableRefObject<User>;
  setCurrentUser: React.Dispatch<React.SetStateAction<User>>;
  requireAuthForWrite: () => boolean;
  handleApiError: (err: unknown, fallbackMessage?: string) => void;
  showAppToast: (message: string, tone?: 'info' | 'error' | 'success') => void;
}

export function useMarketWalletAndCommunitiesState({
  serverOnlineRef,
  currentUserRef,
  setCurrentUser,
  requireAuthForWrite,
  handleApiError,
  showAppToast,
}: UseMarketWalletAndCommunitiesDeps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<MarketOrder[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [communityMessagesById, setCommunityMessagesById] = useState<Record<string, CommunityMessage[]>>({});

  const toggleWishlistProduct = useCallback(
    (productId: string) => {
      if (!requireAuthForWrite()) return;
      let prevProdSnapshot: Product | undefined;
      setProducts((prev) =>
        prev.map((prod) => {
          if (prod.id !== productId) return prod;
          prevProdSnapshot = prod;
          return { ...prod, isWishlisted: !prod.isWishlisted };
        })
      );
      if (!serverOnlineRef.current) return;
      void apiFetch(`/api/products/${encodeURIComponent(productId)}/wishlist`, {
        method: 'POST',
        body: JSON.stringify({}),
      }).catch((err) => {
        if (prevProdSnapshot) {
          const snap = prevProdSnapshot;
          setProducts((prev) => prev.map((prod) => (prod.id === productId ? snap : prod)));
        }
        handleApiError(err, 'تعذّر تحديث المفضلة');
      });
    },
    [handleApiError, requireAuthForWrite, serverOnlineRef]
  );

  const createProduct = useCallback(
    async (
      input: {
        title: string;
        priceIqd: number;
        compareAtPriceIqd?: number;
        category: string;
        condition: 'new' | 'used';
        city: string;
        province: string;
      },
      mediaFile?: File | Blob | string
    ): Promise<boolean> => {
      if (!requireAuthForWrite()) return false;
      try {
        let mediaId: string | undefined;
        if (mediaFile) {
          const uploaded = await uploadMediaSource(mediaFile, 'post-image');
          mediaId = uploaded.mediaId;
        }
        const created = await apiFetch<Product>('/api/products', {
          method: 'POST',
          body: JSON.stringify({
            ...input,
            ...(mediaId ? { mediaId } : {}),
          }),
        });
        setProducts((prev) => [created, ...prev]);
        showAppToast('تم نشر المنتج في السوق', 'success');
        return true;
      } catch (err) {
        handleApiError(err, 'تعذّر إضافة المنتج');
        return false;
      }
    },
    [handleApiError, requireAuthForWrite, showAppToast]
  );

  const deleteProduct = useCallback(
    async (productId: string): Promise<boolean> => {
      if (!requireAuthForWrite()) return false;
      const prev = products;
      setProducts((list) => list.filter((p) => p.id !== productId));
      try {
        await apiFetch(`/api/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });
        showAppToast('تم حذف المنتج', 'success');
        return true;
      } catch (err) {
        setProducts(prev);
        handleApiError(err, 'تعذّر حذف المنتج');
        return false;
      }
    },
    [handleApiError, products, requireAuthForWrite, showAppToast]
  );

  const createOrder = useCallback(
    async (productId: string, note = ''): Promise<boolean> => {
      if (!requireAuthForWrite()) return false;
      try {
        const order = await apiFetch<MarketOrder>('/api/orders', {
          method: 'POST',
          body: JSON.stringify({ productId, note }),
        });
        setOrders((prev) => [order, ...prev]);
        showAppToast('تم إرسال طلبك بنجاح', 'success');
        return true;
      } catch (err) {
        handleApiError(err, 'تعذّر إرسال الطلب');
        return false;
      }
    },
    [handleApiError, requireAuthForWrite, showAppToast]
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: MarketOrder['status']): Promise<boolean> => {
      if (!requireAuthForWrite()) return false;
      const prev = orders;
      setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, status } : o)));
      try {
        const updated = await apiFetch<MarketOrder>(`/api/orders/${encodeURIComponent(orderId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        setOrders((list) => list.map((o) => (o.id === orderId ? updated : o)));
        showAppToast('تم تحديث حالة الطلب', 'success');
        return true;
      } catch (err) {
        setOrders(prev);
        handleApiError(err, 'تعذّر تحديث حالة الطلب');
        return false;
      }
    },
    [handleApiError, orders, requireAuthForWrite, showAppToast]
  );

  const topupWallet = useCallback(
    async (amountCoins: number, targetUserId?: string): Promise<boolean> => {
      if (!requireAuthForWrite()) return false;
      try {
        const res = await apiFetch<{ walletBalance: number; transaction: WalletTransaction }>(
          '/api/wallet/topup',
          {
            method: 'POST',
            body: JSON.stringify({
              amountCoins,
              ...(targetUserId ? { targetUserId } : {}),
            }),
          }
        );
        if (!targetUserId || targetUserId === currentUserRef.current.id) {
          setWalletBalance(res.walletBalance);
          setWalletTransactions((prev) => [res.transaction, ...prev]);
          setCurrentUser((prev) => ({ ...prev, walletBalance: res.walletBalance }));
        }
        showAppToast(`تم شحن ${amountCoins} عملة تجريبية بنجاح`, 'success');
        return true;
      } catch (err) {
        handleApiError(err, 'تعذّر شحن المحفظة');
        return false;
      }
    },
    [currentUserRef, handleApiError, requireAuthForWrite, setCurrentUser, showAppToast]
  );

  const spendCoinsForGift = useCallback(
    async (giftName: string, coinsCost: number, recipientId?: string): Promise<boolean> => {
      if (!requireAuthForWrite()) return false;
      if (walletBalance < coinsCost) {
        showAppToast('رصيدك من النقاط غير كافٍ', 'error');
        return false;
      }
      if (!serverOnlineRef.current) {
        setWalletBalance((prev) => prev - coinsCost);
        return true;
      }
      try {
        const res = await apiFetch<{ walletBalance: number; transaction: WalletTransaction }>(
          '/api/wallet/gift',
          {
            method: 'POST',
            body: JSON.stringify({
              recipientId: recipientId || currentUserRef.current.id,
              amountCoins: coinsCost,
              giftLabel: giftName,
            }),
          }
        );
        setWalletBalance(res.walletBalance);
        setWalletTransactions((prev) => [res.transaction, ...prev]);
        setCurrentUser((prev) => ({ ...prev, walletBalance: res.walletBalance }));
        return true;
      } catch (err) {
        handleApiError(err, 'تعذّر إرسال الهدية');
        return false;
      }
    },
    [currentUserRef, handleApiError, requireAuthForWrite, serverOnlineRef, setCurrentUser, showAppToast, walletBalance]
  );

  const addCommunity = useCallback(
    (comm: {
      name: string;
      province: string;
      category?: string;
      isPrivate?: boolean;
      description: string;
      icon?: string;
    }) => {
      if (!requireAuthForWrite()) return;
      const id = makeClientId('comm');
      const newComm: CommunityItem = {
        id,
        creatorId: currentUserRef.current.id,
        name: comm.name,
        province: comm.province,
        category: comm.category ?? 'عام',
        isPrivate: Boolean(comm.isPrivate),
        isJoined: true,
        description: comm.description,
        membersCount: 1,
        icon: comm.icon ?? '',
      };
      setCommunities((prev) => [newComm, ...prev]);
      if (!serverOnlineRef.current) return;
      void apiFetch<CommunityItem>('/api/communities', {
        method: 'POST',
        body: JSON.stringify({ id, ...comm }),
      })
        .then((created) => {
          if (created?.id) {
            setCommunities((prev) => prev.map((c) => (c.id === id ? { ...c, ...created } : c)));
          }
        })
        .catch((err) => {
          setCommunities((prev) => prev.filter((c) => c.id !== id));
          handleApiError(err, 'تعذّر إنشاء المجتمع');
        });
    },
    [currentUserRef, handleApiError, requireAuthForWrite, serverOnlineRef]
  );

  const joinCommunity = useCallback(
    async (communityId: string): Promise<boolean> => {
      if (!requireAuthForWrite()) return false;
      const prev = communities;
      setCommunities((list) =>
        list.map((c) =>
          c.id === communityId
            ? { ...c, isJoined: true, membersCount: c.isJoined ? c.membersCount : c.membersCount + 1 }
            : c
        )
      );
      if (!serverOnlineRef.current) return true;
      try {
        const res = await apiFetch<{ isJoined: boolean; membersCount: number }>(
          `/api/communities/${encodeURIComponent(communityId)}/join`,
          { method: 'POST', body: JSON.stringify({}) }
        );
        setCommunities((list) =>
          list.map((c) =>
            c.id === communityId ? { ...c, isJoined: res.isJoined, membersCount: res.membersCount } : c
          )
        );
        return true;
      } catch (err) {
        setCommunities(prev);
        handleApiError(err, 'تعذّر الانضمام إلى المجتمع');
        return false;
      }
    },
    [communities, handleApiError, requireAuthForWrite, serverOnlineRef]
  );

  const leaveCommunity = useCallback(
    async (communityId: string): Promise<boolean> => {
      if (!requireAuthForWrite()) return false;
      const prev = communities;
      setCommunities((list) =>
        list.map((c) =>
          c.id === communityId
            ? { ...c, isJoined: false, membersCount: Math.max(0, c.membersCount - 1) }
            : c
        )
      );
      if (!serverOnlineRef.current) return true;
      try {
        const res = await apiFetch<{ isJoined: boolean; membersCount: number }>(
          `/api/communities/${encodeURIComponent(communityId)}/join`,
          { method: 'DELETE' }
        );
        setCommunities((list) =>
          list.map((c) =>
            c.id === communityId ? { ...c, isJoined: res.isJoined, membersCount: res.membersCount } : c
          )
        );
        return true;
      } catch (err) {
        setCommunities(prev);
        handleApiError(err, 'تعذّر مغادرة المجتمع');
        return false;
      }
    },
    [communities, handleApiError, requireAuthForWrite, serverOnlineRef]
  );

  const sendCommunityMessage = useCallback(
    async (communityId: string, channel: 'general' | 'announcements', text: string): Promise<boolean> => {
      if (!requireAuthForWrite()) return false;
      const trimmed = text.trim();
      if (!trimmed) return false;
      if (!serverOnlineRef.current) {
        const localMsg: CommunityMessage = {
          id: makeClientId('cmsg'),
          communityId,
          senderId: currentUserRef.current.id,
          sender: currentUserRef.current,
          channel,
          text: trimmed,
          createdAt: new Date().toISOString(),
        };
        setCommunityMessagesById((prev) => ({
          ...prev,
          [communityId]: [...(prev[communityId] ?? []), localMsg],
        }));
        return true;
      }
      try {
        const msg = await apiFetch<CommunityMessage>(
          `/api/communities/${encodeURIComponent(communityId)}/messages`,
          {
            method: 'POST',
            body: JSON.stringify({ channel, text: trimmed }),
          }
        );
        setCommunityMessagesById((prev) => ({
          ...prev,
          [communityId]: [...(prev[communityId] ?? []), msg],
        }));
        return true;
      } catch (err) {
        handleApiError(err, 'تعذّر إرسال الرسالة في المجتمع');
        return false;
      }
    },
    [currentUserRef, handleApiError, requireAuthForWrite, serverOnlineRef]
  );

  return {
    products,
    setProducts,
    orders,
    setOrders,
    walletBalance,
    setWalletBalance,
    walletTransactions,
    setWalletTransactions,
    communities,
    setCommunities,
    communityMessagesById,
    setCommunityMessagesById,
    toggleWishlistProduct,
    createProduct,
    deleteProduct,
    createOrder,
    updateOrderStatus,
    topupWallet,
    spendCoinsForGift,
    addCommunity,
    joinCommunity,
    leaveCommunity,
    sendCommunityMessage,
  };
}
