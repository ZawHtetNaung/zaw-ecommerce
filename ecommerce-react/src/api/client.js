import axios from 'axios';

export const API_LOADING_EVENT = 'messara:api-loading';
export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

let pendingApiRequestCount = 0;
const inFlightRequests = new Map();

function shareInFlightRequest(key, requestFactory) {
  const existingRequest = inFlightRequests.get(key);
  if (existingRequest) return existingRequest;

  const request = requestFactory();
  inFlightRequests.set(key, request);

  const clearRequest = () => {
    if (inFlightRequests.get(key) === request) inFlightRequests.delete(key);
  };
  request.then(clearRequest, clearRequest);

  return request;
}

export function getPendingApiRequestCount() {
  return pendingApiRequestCount;
}

function announceApiLoading() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(API_LOADING_EVENT, {
      detail: { pending: pendingApiRequestCount },
    }));
  }
}

function beginApiLoading(config) {
  if (config.globalLoading === false) return;
  config.__tracksGlobalLoading = true;
  pendingApiRequestCount += 1;
  announceApiLoading();
}

function finishApiLoading(config) {
  if (!config?.__tracksGlobalLoading) return;
  config.__tracksGlobalLoading = false;
  pendingApiRequestCount = Math.max(0, pendingApiRequestCount - 1);
  announceApiLoading();
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'application/json'
  }
});

api.interceptors.request.use((config) => {
  beginApiLoading(config);
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    finishApiLoading(response.config);
    return response;
  },
  (error) => {
    finishApiLoading(error.config);
    return Promise.reject(error);
  }
);

export async function register(payload) {
  const { data } = await api.post('/api/register', payload);
  return data;
}

export async function login(payload) {
  const { data } = await api.post('/api/login', payload);
  return data;
}

export async function forgotPassword(payload) {
  const { data } = await api.post('/api/forgot-password', payload);
  return data;
}

export async function resetPassword(payload) {
  const { data } = await api.post('/api/reset-password', payload);
  return data;
}

export async function fetchCurrentUser() {
  const { data } = await shareInFlightRequest('current-user', () => (
    api.get('/api/user', { globalLoading: false })
  ));
  return data;
}

export async function fetchUsers() {
  const { data } = await api.get('/api/users');
  return data;
}

export async function logout() {
  await api.post('/api/logout');
}

export async function fetchCategories() {
  const { data } = await api.get('/api/categories');
  return data;
}

export async function fetchPublicCategories() {
  const { data } = await shareInFlightRequest('public-categories', () => (
    api.get('/api/public/categories')
  ));
  return data;
}

export async function fetchPublicSubCategories() {
  const { data } = await shareInFlightRequest('public-sub-categories', () => (
    api.get('/api/public/sub-categories')
  ));
  return data;
}

export async function fetchPublicEvents() {
  const { data } = await shareInFlightRequest('public-events', () => (
    api.get('/api/public/events')
  ));
  return data;
}

export async function fetchPublicBanners() {
  const { data } = await shareInFlightRequest('public-banners', () => (
    api.get('/api/public/banners')
  ));
  return data;
}

export async function fetchPublicBrands() {
  const { data } = await shareInFlightRequest('public-brands', () => (
    api.get('/api/public/brands')
  ));
  return data;
}

export async function fetchPublicGoogleReviews() {
  const { data } = await shareInFlightRequest('public-google-reviews', () => (
    api.get('/api/public/google-reviews', { globalLoading: false })
  ));
  return data;
}

export async function fetchPublicSeo(path) {
  const { data } = await shareInFlightRequest(`public-seo:${path}`, () => (
    api.get('/api/public/seo', { params: { path }, globalLoading: false })
  ));
  return data;
}

export async function fetchSeoSettings() {
  const { data } = await api.get('/api/seo');
  return data;
}

export async function updateSeoPage(pageId, payload) {
  const { data } = await api.put(`/api/seo/${pageId}`, payload);
  return data;
}

export async function updateRobotsTxt(robotsTxt) {
  const { data } = await api.put('/api/seo-robots', { robots_txt: robotsTxt });
  return data;
}

export async function fetchPublicProducts(page = 1, perPage = 8, filters = {}) {
  const params = { page, per_page: perPage, ...filters };
  const requestKey = `public-products:${JSON.stringify(params)}`;
  const { data } = await shareInFlightRequest(requestKey, () => (
    api.get('/api/public/products', {
      params,
      globalLoading: Number(page) <= 1 && Number(filters.offset || 0) === 0,
    })
  ));
  return data;
}

export async function fetchPublicProductFilters() {
  const { data } = await api.get('/api/public/product-filters');
  return data;
}

export async function fetchPublicCategory(categorySlug) {
  const { data } = await api.get(`/api/public/categories/${categorySlug}`);
  return data;
}

export async function fetchPublicSubCategoryProducts(categorySlug, subCategorySlug) {
  const { data } = await api.get(`/api/public/categories/${categorySlug}/sub-categories/${subCategorySlug}/products`);
  return data;
}

export async function fetchPublicProduct(categorySlug, subCategorySlug, productSlug) {
  if (!categorySlug || !subCategorySlug) {
    const { data } = await api.get(`/api/public/products/${productSlug}`);
    return data;
  }
  const { data } = await api.get(`/api/public/categories/${categorySlug}/sub-categories/${subCategorySlug}/products/${productSlug}`);
  return data;
}

export async function fetchProfile() {
  const { data } = await api.get('/api/profile');
  return data;
}

export async function updateProfile(payload) {
  const { data } = await api.put('/api/profile', payload);
  return data;
}

export async function fetchCart() {
  const { data } = await shareInFlightRequest('cart', () => (
    api.get('/api/cart', { globalLoading: false })
  ));
  return data;
}

export async function addCartItem(productId, quantity = 1) {
  const { data } = await api.post('/api/cart', { product_id: productId, quantity });
  return data;
}

export async function updateCartItem(cartItemId, quantity) {
  const { data } = await api.patch(`/api/cart/${cartItemId}`, { quantity });
  return data;
}

export async function removeCartItem(cartItemId) {
  const { data } = await api.delete(`/api/cart/${cartItemId}`);
  return data;
}

export async function clearCart() {
  const { data } = await api.delete('/api/cart');
  return data;
}

export async function mergeGuestCart(items) {
  const { data } = await api.post('/api/cart/merge', { items }, {
    globalLoading: false,
  });
  return data;
}

export async function fetchCheckoutQuote(emirateCode, guestItems = null) {
  const isGuestQuote = Array.isArray(guestItems);
  const payload = {
    emirate_code: emirateCode,
    ...(isGuestQuote ? { items: guestItems } : {}),
  };
  const { data } = await api.post(isGuestQuote ? '/api/public/checkout/quote' : '/api/checkout/quote', payload, {
    globalLoading: false,
  });
  return data;
}

export async function fetchFavorites() {
  const { data } = await shareInFlightRequest('favorites', () => (
    api.get('/api/favorites', { globalLoading: false })
  ));
  return data;
}

export async function addFavorite(productId) {
  const { data } = await api.post('/api/favorites', { product_id: productId });
  return data;
}

export async function removeFavorite(productId) {
  const { data } = await api.delete(`/api/favorites/${productId}`);
  return data;
}

export async function createCategory(payload) {
  const config = payload instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
  const { data } = await api.post('/api/categories', payload, config);
  return data;
}

export async function updateCategory(categoryId, payload) {
  if (payload instanceof FormData) {
    payload.append('_method', 'PUT');
    const { data } = await api.post(`/api/categories/${categoryId}`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  const { data } = await api.put(`/api/categories/${categoryId}`, payload);
  return data;
}

export async function deleteCategory(categoryId) {
  const { data } = await api.delete(`/api/categories/${categoryId}`);
  return data;
}

export async function fetchSubCategories() {
  const { data } = await api.get('/api/sub-categories');
  return data;
}

export async function fetchBrands() {
  const { data } = await api.get('/api/brands');
  return data;
}

export async function createBrand(payload) {
  const { data } = await api.post('/api/brands', payload);
  return data;
}

export async function updateBrand(brandId, payload) {
  const { data } = await api.put(`/api/brands/${brandId}`, payload);
  return data;
}

export async function deleteBrand(brandId) {
  const { data } = await api.delete(`/api/brands/${brandId}`);
  return data;
}

export async function createSubCategory(payload) {
  const config = payload instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
  const { data } = await api.post('/api/sub-categories', payload, config);
  return data;
}

export async function updateSubCategory(subCategoryId, payload) {
  if (payload instanceof FormData) {
    payload.append('_method', 'PUT');
    const { data } = await api.post(`/api/sub-categories/${subCategoryId}`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  const { data } = await api.put(`/api/sub-categories/${subCategoryId}`, payload);
  return data;
}

export async function deleteSubCategory(subCategoryId) {
  const { data } = await api.delete(`/api/sub-categories/${subCategoryId}`);
  return data;
}

export async function fetchColors() {
  const { data } = await api.get('/api/colors');
  return data;
}

export async function createColor(payload) {
  const config = payload instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
  const { data } = await api.post('/api/colors', payload, config);
  return data;
}

export async function updateColor(colorId, payload) {
  if (payload instanceof FormData) {
    payload.append('_method', 'PUT');
    const { data } = await api.post(`/api/colors/${colorId}`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  const { data } = await api.put(`/api/colors/${colorId}`, payload);
  return data;
}

export async function deleteColor(colorId) {
  const { data } = await api.delete(`/api/colors/${colorId}`);
  return data;
}

export async function fetchMeasurements() {
  const { data } = await api.get('/api/measurements');
  return data;
}

export async function fetchSizeOptions() {
  const { data } = await api.get('/api/size-options');
  return data;
}

export async function createSizeOption(payload) {
  const { data } = await api.post('/api/size-options', payload);
  return data;
}

export async function updateSizeOption(sizeOptionId, payload) {
  const { data } = await api.put(`/api/size-options/${sizeOptionId}`, payload);
  return data;
}

export async function deleteSizeOption(sizeOptionId) {
  const { data } = await api.delete(`/api/size-options/${sizeOptionId}`);
  return data;
}

export async function createMeasurement(payload) {
  const { data } = await api.post('/api/measurements', payload);
  return data;
}

export async function updateMeasurement(measurementId, payload) {
  const { data } = await api.put(`/api/measurements/${measurementId}`, payload);
  return data;
}

export async function deleteMeasurement(measurementId) {
  const { data } = await api.delete(`/api/measurements/${measurementId}`);
  return data;
}

export async function fetchProducts() {
  const { data } = await api.get('/api/products');
  return data;
}

export async function fetchProduct(productId) {
  const { data } = await api.get(`/api/products/${productId}`);
  return data;
}

export async function fetchEvents() {
  const { data } = await api.get('/api/events');
  return data;
}

export async function fetchEvent(eventId) {
  const { data } = await api.get(`/api/events/${eventId}`);
  return data;
}

export async function createEvent(payload) {
  const { data } = await api.post('/api/events', payload);
  return data;
}

export async function updateEvent(eventId, payload) {
  const { data } = await api.put(`/api/events/${eventId}`, payload);
  return data;
}

export async function deleteEvent(eventId) {
  const { data } = await api.delete(`/api/events/${eventId}`);
  return data;
}

export async function fetchBanners() {
  const { data } = await api.get('/api/banners');
  return data;
}

export async function createBanner(payload) {
  const config = payload instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
  const { data } = await api.post('/api/banners', payload, config);
  return data;
}

export async function updateBanner(bannerId, payload) {
  if (payload instanceof FormData) {
    payload.append('_method', 'PUT');
    const { data } = await api.post(`/api/banners/${bannerId}`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  const { data } = await api.put(`/api/banners/${bannerId}`, payload);
  return data;
}

export async function deleteBanner(bannerId) {
  const { data } = await api.delete(`/api/banners/${bannerId}`);
  return data;
}

export async function reorderBanners(items) {
  const { data } = await api.post('/api/banners/reorder', { items });
  return data;
}

export async function createProduct(payload) {
  const config = payload instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
  const { data } = await api.post('/api/products', payload, config);
  return data;
}

export async function updateProduct(productId, payload) {
  if (payload instanceof FormData) {
    payload.append('_method', 'PUT');
    const { data } = await api.post(`/api/products/${productId}`, payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  const { data } = await api.put(`/api/products/${productId}`, payload);
  return data;
}

export async function deleteProduct(productId) {
  const { data } = await api.delete(`/api/products/${productId}`);
  return data;
}

export default api;
