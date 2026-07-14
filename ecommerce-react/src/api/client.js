import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  headers: {
    Accept: 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
  const { data } = await api.get('/api/user');
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
  const { data } = await api.get('/api/public/categories');
  return data;
}

export async function fetchPublicEvents() {
  const { data } = await api.get('/api/public/events');
  return data;
}

export async function fetchPublicBanners() {
  const { data } = await api.get('/api/public/banners');
  return data;
}

export async function fetchPublicProducts(page = 1, perPage = 8) {
  const { data } = await api.get('/api/public/products', {
    params: { page, per_page: perPage },
  });
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
