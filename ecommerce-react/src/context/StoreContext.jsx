import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  addCartItem as addCartItemRequest,
  addFavorite as addFavoriteRequest,
  clearCart as clearCartRequest,
  fetchCart,
  fetchFavorites,
  removeCartItem as removeCartItemRequest,
  removeFavorite as removeFavoriteRequest,
  updateCartItem as updateCartItemRequest,
} from '../api/client';
import { useAuth } from './AuthContext';

const emptyCart = { items: [], count: 0, subtotal: '0.00' };
const emptyFavorites = { favorites: [], count: 0 };
const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [cart, setCart] = useState(emptyCart);
  const [favorites, setFavorites] = useState(emptyFavorites);
  const [loading, setLoading] = useState(false);

  const refreshStore = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(emptyCart);
      setFavorites(emptyFavorites);
      return;
    }

    setLoading(true);
    try {
      const [cartData, favoriteData] = await Promise.all([fetchCart(), fetchFavorites()]);
      setCart(cartData);
      setFavorites(favoriteData);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading) refreshStore();
  }, [authLoading, refreshStore]);

  async function addToCart(productId, quantity = 1) {
    const data = await addCartItemRequest(productId, quantity);
    setCart(data);
    return data;
  }

  async function changeCartQuantity(cartItemId, quantity) {
    const data = await updateCartItemRequest(cartItemId, quantity);
    setCart(data);
    return data;
  }

  async function removeFromCart(cartItemId) {
    const data = await removeCartItemRequest(cartItemId);
    setCart(data);
    return data;
  }

  async function clearCart() {
    const data = await clearCartRequest();
    setCart(data);
    return data;
  }

  async function addToFavorites(productId) {
    const data = await addFavoriteRequest(productId);
    setFavorites(data);
    return data;
  }

  async function removeFromFavorites(productId) {
    const data = await removeFavoriteRequest(productId);
    setFavorites(data);
    return data;
  }

  const favoriteIds = useMemo(
    () => new Set((favorites.favorites || []).map((product) => Number(product.id))),
    [favorites.favorites]
  );

  const value = useMemo(() => ({
    cart,
    cartCount: Number(cart.count || 0),
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
  }), [cart, favoriteIds, favorites, loading, refreshStore]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used inside a StoreProvider');
  return context;
}
