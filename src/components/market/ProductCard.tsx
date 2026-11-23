import React from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { Heart, Star } from 'lucide-react';
import { VerifiedBadge } from '../ui/Avatar';
import { SmartImage } from '../ui/SmartImage';
import { formatPriceIQD } from '../../lib/formatters';

export function ProductCard({
  product,
  onClick,
}: {
  product: Product;
  onClick?: () => void;
}) {
  const { toggleWishlistProduct, numeralSystem } = useApp();

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col p-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-all cursor-pointer shadow-2xs select-none"
    >
      {/* Square Image Container */}
      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-[var(--surface-2)] mb-2">
        <SmartImage
          src={product.imageUrl}
          alt={product.title}
          containerClassName="w-full h-full"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Condition / Stock Badge */}
        <span className="absolute top-2 start-2 px-2 py-0.5 rounded-md bg-[var(--overlay)] backdrop-blur-md text-white text-[11px] font-bold">
          {product.condition === 'new' ? 'جديد' : 'مستعمل'}
        </span>

        {/* Wishlist Heart Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlistProduct(product.id);
          }}
          className="absolute top-2 end-2 w-9 h-9 rounded-full bg-[var(--surface)]/95 border border-[var(--border)] backdrop-blur-md flex items-center justify-center text-[var(--text)] shadow-sm active:scale-90 transition-transform"
          aria-label={product.isWishlisted ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              product.isWishlisted ? 'text-[var(--danger)] fill-[var(--danger)]' : ''
            }`}
          />
        </button>
      </div>

      {/* Product Info */}
      <div className="flex flex-col flex-1 justify-between gap-1">
        <h3 className="font-sans text-sm font-bold text-[var(--text)] line-clamp-2 leading-snug group-hover:text-[var(--accent)] transition-colors">
          {product.title}
        </h3>

        {/* Price Row */}
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-sm font-bold text-[var(--accent-text)]">
            {formatPriceIQD(product.priceIqd, numeralSystem)}
          </span>
          {product.compareAtPriceIqd && (
            <span className="text-xs text-[var(--text-muted)] line-through">
              {formatPriceIQD(product.compareAtPriceIqd, numeralSystem)}
            </span>
          )}
        </div>

        {/* Shop & City Line */}
        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-1 border-t border-[var(--border)] mt-1">
          <div className="flex items-center gap-1 truncate max-w-[120px]">
            <span className="truncate">{product.shopName}</span>
            {product.shopVerified && <VerifiedBadge kind="merchant" size={12} />}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Star className="w-3 h-3 text-[var(--gold)] fill-[var(--gold)]" />
            <span className="font-semibold text-[var(--text)]">{product.ratingAvg}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
