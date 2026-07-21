import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CSpinner } from '@coreui/react';
import { fetchProduct } from '../api/client';
import { getProductPurchaseLimit, isProductInStock } from '../utils/productStock';

function formatPrice(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue.toFixed(2) : '0.00';
}

export default function ProductDetailPage() {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    async function loadProduct() {
      try {
        const data = await fetchProduct(productId);
        setProduct(data);
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Unable to load product details.');
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [productId]);

  const images = useMemo(() => {
    if (!product) return [];
    if (Array.isArray(product.image_urls) && product.image_urls.length > 0) return product.image_urls;
    if (product.image_url) return [product.image_url];
    return [];
  }, [product]);

  function showPrev() {
    if (images.length === 0) return;
    setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }

  function showNext() {
    if (images.length === 0) return;
    setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }

  if (loading) return <CSpinner color="primary" />;
  if (error) return <CAlert color="danger">{error}</CAlert>;
  if (!product) return <CAlert color="warning">Product not found.</CAlert>;

  return (
    <CCard>
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>Product Details</strong>
        <CButton as={Link} to="/dashboard/products/list" color="secondary" variant="outline" size="sm">
          Back to products
        </CButton>
      </CCardHeader>
      <CCardBody>
        <div className="detail-grid">
          <div>
            {images.length > 0 ? (
              <>
                <div className="slider-box">
                  <img src={images[activeIndex]} alt={product.name} className="slider-main-image" />
                </div>
                {images.length > 1 && (
                  <div className="d-flex justify-content-between gap-2 mt-2">
                    <CButton type="button" color="dark" variant="outline" size="sm" onClick={showPrev}>
                      Prev
                    </CButton>
                    <CButton type="button" color="dark" variant="outline" size="sm" onClick={showNext}>
                      Next
                    </CButton>
                  </div>
                )}
                <div className="thumb-row mt-3">
                  {images.map((image, index) => (
                    <button
                      type="button"
                      key={`${image}-${index}`}
                      className={`thumb-button ${activeIndex === index ? 'thumb-button-active' : ''}`}
                      onClick={() => setActiveIndex(index)}
                    >
                      <img src={image} alt={`Thumb ${index + 1}`} className="product-thumb" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="slider-box">No images</div>
            )}
          </div>

          <div>
            <h3 className="mb-3">{product.name}</h3>
            <p className="mb-1"><strong>Category:</strong> {product.category?.name || '-'}</p>
            <p className="mb-1"><strong>Sub Category:</strong> {product.sub_category?.name || '-'}</p>
            <p className="mb-1"><strong>Brand:</strong> {product.brand?.name || '-'}</p>
            <p className="mb-1">
              <strong>Colors:</strong>{' '}
              {Array.isArray(product.colors) && product.colors.length > 0
                ? product.colors.map((color) => color.name).join(', ')
                : '-'}
            </p>
            <p className="mb-1">
              <strong>Measurements:</strong>{' '}
              {Array.isArray(product.measurements) && product.measurements.length > 0
                ? product.measurements.map((measurement) => measurement.name).join(', ')
                : '-'}
            </p>
            <p className="mb-1">
              <strong>Price:</strong>{' '}
              {Number(product.discount_price || 0) > 0 ? (
                <>
                  <span className="price-old">AED {formatPrice(product.price)}</span>{' '}
                  <span className="price-discount">AED {formatPrice(product.discount_price)}</span>
                </>
              ) : (
                <>AED {formatPrice(product.price)}</>
              )}
            </p>
            <p className="mb-1"><strong>Stock:</strong> {isProductInStock(product) ? `In stock (${getProductPurchaseLimit(product)})` : 'Out of stock'}</p>
            <p className="mb-2"><strong>Status:</strong> <CBadge color={product.is_active ? 'success' : 'secondary'}>{product.is_active ? 'Active' : 'Inactive'}</CBadge></p>
            <p className="mb-0"><strong>Description:</strong></p>
            <p className="text-body-secondary">{product.description || 'No description'}</p>
          </div>
        </div>
      </CCardBody>
    </CCard>
  );
}
