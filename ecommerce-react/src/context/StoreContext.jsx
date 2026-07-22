import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  addCartItem as addCartItemRequest,
  addFavorite as addFavoriteRequest,
  clearCart as clearCartRequest,
  fetchCart,
  fetchFavorites,
  mergeGuestCart as mergeGuestCartRequest,
  removeCartItem as removeCartItemRequest,
  removeFavorite as removeFavoriteRequest,
  updateCartItem as updateCartItemRequest,
} from '../api/client';
import { getProductPurchaseLimit, isCartItemAvailable, isProductInStock } from '../utils/productStock';
import { useAuth } from './AuthContext';

export const GUEST_CART_STORAGE_KEY = 'messara_guest_cart_v1';
export const GUEST_CART_STORAGE_VERSION = 1;

const emptyCart = { items: [], count: 0, subtotal: '0.00' };
const emptyFavorites = { favorites: [], count: 0 };
const StoreContext = createContext(null);

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}

function cartUnitPrice(product) {
  const discountPrice = Number(product?.discount_price || 0);
  return discountPrice > 0 ? discountPrice : Math.max(0, Number(product?.price || 0));
}

function relationSnapshot(relation) {
  if (!relation || typeof relation !== 'object') return null;

  return {
    id: relation.id ?? null,
    name: String(relation.name || ''),
    slug: String(relation.slug || ''),
    image_url: relation.image_url || null,
  };
}

function productSnapshot(product) {
  if (!product || typeof product !== 'object' || !Number.isFinite(Number(product.id))) return null;

  return {
    id: Number(product.id),
    name: String(product.name || ''),
    slug: String(product.slug || ''),
    price: money(product.price),
    discount_price: Number(product.discount_price || 0) > 0 ? money(product.discount_price) : null,
    image_url: product.image_url || null,
    image_path: product.image_path || null,
    image_alt_text: product.image_alt_text || null,
    stock: Math.max(0, Math.floor(Number(product.stock || 0))),
    is_in_stock: isProductInStock(product),
    is_active: product.is_active !== false && Number(product.is_active) !== 0,
    requires_paid_shipping: Boolean(product.requires_paid_shipping),
    product_type: product.product_type || null,
    selling_method: product.selling_method || null,
    brand: relationSnapshot(product.brand),
    category: relationSnapshot(product.category),
    sub_category: relationSnapshot(product.sub_category),
  };
}

function guestCartItem(product, quantity) {
  const snapshot = productSnapshot(product);
  if (!snapshot) return null;

  const unitPrice = cartUnitPrice(snapshot);
  const normalizedQuantity = Math.max(1, Math.floor(Number(quantity || 1)));

  return {
    id: `guest:${snapshot.id}`,
    product_id: snapshot.id,
    quantity: normalizedQuantity,
    is_available: isProductInStock(snapshot) && normalizedQuantity <= getProductPurchaseLimit(snapshot),
    unit_price: money(unitPrice),
    line_total: money(unitPrice * normalizedQuantity),
    product: snapshot,
  };
}

function buildGuestCart(items) {
  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((item) => guestCartItem(item?.product, item?.quantity))
    .filter(Boolean);
  const availableItems = normalizedItems.filter(isCartItemAvailable);

  return {
    items: normalizedItems,
    count: availableItems.reduce((total, item) => total + item.quantity, 0),
    subtotal: money(availableItems.reduce((total, item) => total + Number(item.line_total), 0)),
  };
}

function readGuestCart() {
  if (typeof window === 'undefined') return emptyCart;

  try {
    const stored = JSON.parse(window.localStorage.getItem(GUEST_CART_STORAGE_KEY));
    if (stored?.version !== GUEST_CART_STORAGE_VERSION) return emptyCart;
    return buildGuestCart(stored.items);
  } catch {
    return emptyCart;
  }
}

function writeGuestCart(cart) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify({
      version: GUEST_CART_STORAGE_VERSION,
      items: cart.items,
    }));
  } catch {
    // A full or disabled localStorage must not stop the customer from shopping.
  }
}

function productIdFrom(productOrId) {
  const id = Number(typeof productOrId === 'object' ? productOrId?.id : productOrId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function StoreProvider({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const initialGuestCart = useMemo(readGuestCart, []);
  const [serverCart, setServerCart] = useState(emptyCart);
  const [guestCart, setGuestCart] = useState(initialGuestCart);
  const guestCartRef = useRef(initialGuestCart);
  const refreshPromiseRef = useRef(null);
  const [favorites, setFavorites] = useState(emptyFavorites);
  const [loading, setLoading] = useState(false);

  const replaceGuestCart = useCallback((nextCart) => {
    guestCartRef.current = nextCart;
    setGuestCart(nextCart);
    writeGuestCart(nextCart);
    return nextCart;
  }, []);

  const refreshStore = useCallback(async () => {
    if (!isAuthenticated) {
      setServerCart(emptyCart);
      setFavorites(emptyFavorites);
      setLoading(false);
      return;
    }

    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    setLoading(true);
    const refreshPromise = (async () => {
      const guestItems = (guestCartRef.current.items || []).map((item) => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
      }));

      let cartData;
      if (guestItems.length > 0) {
        cartData = await mergeGuestCartRequest(guestItems);
        setServerCart(cartData);
        replaceGuestCart(emptyCart);
      } else {
        cartData = await fetchCart();
        setServerCart(cartData);
      }

      const favoriteData = await fetchFavorites();
      setFavorites(favoriteData);
      return { cart: cartData, favorites: favoriteData };
    })();

    refreshPromiseRef.current = refreshPromise;

    try {
      return await refreshPromise;
    } finally {
      if (refreshPromiseRef.current === refreshPromise) refreshPromiseRef.current = null;
      setLoading(false);
    }
  }, [isAuthenticated, replaceGuestCart]);

  useEffect(() => {
    if (!authLoading) refreshStore().catch(() => {});
  }, [authLoading, refreshStore]);

  useEffect(() => {
    function syncGuestCart(event) {
      if (event.key !== GUEST_CART_STORAGE_KEY) return;
      const nextCart = readGuestCart();
      guestCartRef.current = nextCart;
      setGuestCart(nextCart);
    }

    window.addEventListener('storage', syncGuestCart);
    return () => window.removeEventListener('storage', syncGuestCart);
  }, []);

  const addToCart = useCallback(async (productOrId, quantity = 1) => {
    const productId = productIdFrom(productOrId);
    if (!productId) throw new Error('This product cannot be added to the cart.');

    if (isAuthenticated) {
      const data = await addCartItemRequest(productId, quantity);
      setServerCart(data);
      return data;
    }

    if (!productOrId || typeof productOrId !== 'object') {
      throw new Error('Product details are required for a guest cart.');
    }

    const requestedQuantity = Math.floor(Number(quantity));
    const purchaseLimit = getProductPurchaseLimit(productOrId);
    if (!Number.isFinite(requestedQuantity) || requestedQuantity < 1) {
      throw new Error('Choose a valid quantity.');
    }
    if (!isProductInStock(productOrId) || purchaseLimit < 1) {
      throw new Error('This product is currently out of stock.');
    }

    const currentItems = guestCartRef.current.items || [];
    const existingItem = currentItems.find((item) => Number(item.product_id) === productId);
    const nextQuantity = Number(existingItem?.quantity || 0) + requestedQuantity;
    if (nextQuantity > purchaseLimit) {
      throw new Error(`Only ${purchaseLimit} item${purchaseLimit === 1 ? '' : 's'} available.`);
    }

    const nextItem = guestCartItem(productOrId, nextQuantity);
    const nextItems = existingItem
      ? currentItems.map((item) => Number(item.product_id) === productId ? nextItem : item)
      : [nextItem, ...currentItems];

    return replaceGuestCart(buildGuestCart(nextItems));
  }, [isAuthenticated, replaceGuestCart]);

  const changeCartQuantity = useCallback(async (cartItemId, quantity) => {
    if (isAuthenticated) {
      const data = await updateCartItemRequest(cartItemId, quantity);
      setServerCart(data);
      return data;
    }

    const requestedQuantity = Math.floor(Number(quantity));
    const item = guestCartRef.current.items.find((candidate) => String(candidate.id) === String(cartItemId));
    if (!item) throw new Error('This cart item no longer exists.');
    if (!Number.isFinite(requestedQuantity) || requestedQuantity < 1) throw new Error('Choose a valid quantity.');

    const purchaseLimit = getProductPurchaseLimit(item.product);
    if (requestedQuantity > purchaseLimit) {
      throw new Error(`Only ${purchaseLimit} item${purchaseLimit === 1 ? '' : 's'} available.`);
    }

    const nextItems = guestCartRef.current.items.map((candidate) => (
      String(candidate.id) === String(cartItemId)
        ? guestCartItem(candidate.product, requestedQuantity)
        : candidate
    ));
    return replaceGuestCart(buildGuestCart(nextItems));
  }, [isAuthenticated, replaceGuestCart]);

  const removeFromCart = useCallback(async (cartItemId) => {
    if (isAuthenticated) {
      const data = await removeCartItemRequest(cartItemId);
      setServerCart(data);
      return data;
    }

    const nextItems = guestCartRef.current.items.filter((item) => String(item.id) !== String(cartItemId));
    return replaceGuestCart(buildGuestCart(nextItems));
  }, [isAuthenticated, replaceGuestCart]);

  const clearCart = useCallback(async () => {
    if (isAuthenticated) {
      const data = await clearCartRequest();
      setServerCart(data);
      return data;
    }

    return replaceGuestCart(emptyCart);
  }, [isAuthenticated, replaceGuestCart]);

  const clearGuestCart = useCallback(() => replaceGuestCart(emptyCart), [replaceGuestCart]);

  const addToFavorites = useCallback(async (productId) => {
    if (!isAuthenticated) throw new Error('Please log in to save favourites.');
    const data = await addFavoriteRequest(productId);
    setFavorites(data);
    return data;
  }, [isAuthenticated]);

  const removeFromFavorites = useCallback(async (productId) => {
    if (!isAuthenticated) throw new Error('Please log in to update favourites.');
    const data = await removeFavoriteRequest(productId);
    setFavorites(data);
    return data;
  }, [isAuthenticated]);

  const cart = isAuthenticated ? serverCart : guestCart;
  const favoriteIds = useMemo(
    () => new Set((favorites.favorites || []).map((product) => Number(product.id))),
    [favorites.favorites]
  );

  const value = useMemo(() => ({
    cart,
    cartCount: Number(cart.count || 0),
    guestCart,
    guestCartItems: guestCart.items || [],
    hasGuestCart: Number(guestCart.count || 0) > 0,
    clearGuestCart,
    favorites: favorites.favorites || [],
    favoriteCount: Number(favorites.count || 0),
    isFavorite: (productId) => favoriteIds.has(Number(productId)),
    loading,
    refreshStore,
    addToCart,
    changeCartQuantity,
    removeFromCart,
    clearCart,
    addToFavorites,
    removeFromFavorites,
  }), [addToCart, addToFavorites, cart, changeCartQuantity, clearCart, clearGuestCart, favoriteIds, favorites, guestCart, loading, refreshStore, removeFromFavorites, removeFromCart]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used inside a StoreProvider');
  return context;
}
