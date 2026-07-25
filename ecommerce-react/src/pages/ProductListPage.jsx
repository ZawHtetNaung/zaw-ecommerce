import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPen, cilTrash } from '@coreui/icons';
import AppDataTable from '../components/AppDataTable';
import { deleteProduct, fetchProducts } from '../api/client';
import { getProductStockQuantity, isProductInStock } from '../utils/productStock';

function formatPrice(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue.toFixed(2) : '0.00';
}

export default function ProductListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmProduct, setConfirmProduct] = useState(null);

  async function loadProducts() {
    try {
      const data = await fetchProducts();
      setProducts(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load products.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!location.state?.successMessage) return;
    setMessage(location.state.successMessage);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  async function onDelete(productId) {
    setError('');
    setMessage('');

    try {
      await deleteProduct(productId);
      setMessage('Product deleted successfully.');
      await loadProducts();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete product.');
    }
  }

  function openDeleteConfirm(product) {
    setConfirmProduct(product);
  }

  async function confirmDelete() {
    if (!confirmProduct) return;
    const productId = confirmProduct.id;
    setConfirmProduct(null);
    await onDelete(productId);
  }

  const columns = useMemo(
    () => [
      { name: 'ID', selector: (row) => row.id, sortable: true, width: '80px' },
      {
        name: 'Name',
        sortable: true,
        selector: (row) => row.name,
      },
      {
        name: 'Images',
        cell: (row) =>
          Array.isArray(row.image_urls) && row.image_urls.length > 0 ? (
            <div className="d-flex align-items-center gap-2">
              <img src={row.image_urls[0]} alt={row.name} className="product-thumb" />
              <CBadge color="secondary">{row.image_urls.length}</CBadge>
            </div>
          ) : (
            '-'
          ),
      },
      { name: 'Category', selector: (row) => row.category?.name || '-', sortable: true },
      { name: 'Sub Category', selector: (row) => row.sub_category?.name || '-', sortable: true },
      { name: 'Brand', selector: (row) => row.brand?.name || '-', sortable: true },
      {
        name: 'Colors',
        cell: (row) =>
          Array.isArray(row.colors) && row.colors.length > 0 ? row.colors.map((color) => color.name).join(', ') : '-',
      },
      {
        name: 'Color Images',
        selector: (row) => {
          const colors = Array.isArray(row.colors) ? row.colors : [];
          const connected = colors.filter((color) => Number(color.pivot?.product_image_id || 0) > 0).length;
          if (colors.length === 0) return 'No colors';
          return connected === colors.length
            ? `Connected ${connected}/${colors.length}`
            : `Needs mapping ${connected}/${colors.length}`;
        },
        sortable: true,
        cell: (row) => {
          const colors = Array.isArray(row.colors) ? row.colors : [];
          const connected = colors.filter((color) => Number(color.pivot?.product_image_id || 0) > 0).length;
          if (colors.length === 0) return <CBadge color="secondary">No colors</CBadge>;

          return (
            <CBadge color={connected === colors.length ? 'success' : 'warning'}>
              {connected === colors.length ? 'Connected' : 'Needs mapping'} {connected}/{colors.length}
            </CBadge>
          );
        },
      },
      {
        name: 'Measurements',
        cell: (row) =>
          Array.isArray(row.measurements) && row.measurements.length > 0
            ? row.measurements.map((measurement) => measurement.name).join(', ')
            : '-',
      },
      {
        name: 'Price',
        sortable: true,
        cell: (row) => {
          const discount = Number(row.discount_price || 0);
          if (discount > 0) {
            return (
              <span className="event-product-price">
                <span className="price-old">AED {formatPrice(row.price)}</span>
                <span className="price-discount">AED {formatPrice(discount)}</span>
              </span>
            );
          }
          return `AED ${formatPrice(row.price)}`;
        },
      },
      {
        name: 'Stock',
        selector: (row) => (isProductInStock(row) ? getProductStockQuantity(row) : -1),
        sortable: true,
        cell: (row) => (
          <CBadge color={isProductInStock(row) ? 'success' : 'secondary'}>
            {isProductInStock(row) ? `In stock (${Math.max(1, getProductStockQuantity(row))})` : 'Out of stock'}
          </CBadge>
        ),
      },
      { name: 'Status', selector: (row) => (row.is_active ? 'Active' : 'Inactive'), sortable: true },
      {
        name: 'Actions',
        ignoreRowClick: true,
        allowOverflow: true,
        button: true,
        cell: (row) => (
          <div className="d-flex gap-2">
            <CButton
              size="sm"
              color="info"
              variant="outline"
              title="Edit"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/dashboard/products/${row.id}/edit`);
              }}
            >
              <CIcon icon={cilPen} />
            </CButton>
            <CButton
              size="sm"
              color="danger"
              variant="outline"
              title="Delete"
              onClick={(event) => {
                event.stopPropagation();
                openDeleteConfirm(row);
              }}
            >
              <CIcon icon={cilTrash} />
            </CButton>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <>
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <strong>Products List</strong>
          <CButton as={Link} to="/dashboard/products/create" color="primary" size="sm">
            Create Product
          </CButton>
        </CCardHeader>
        <CCardBody>
          {error && <CAlert color="danger">{error}</CAlert>}
          {message && <CAlert color="success">{message}</CAlert>}
          <AppDataTable
            columns={columns}
            data={products}
            progressPending={loading}
            onRowClicked={(row) => navigate(`/dashboard/products/${row.id}`)}
          />
        </CCardBody>
      </CCard>
      <CModal visible={Boolean(confirmProduct)} onClose={() => setConfirmProduct(null)} alignment="center">
        <CModalHeader>
          <CModalTitle>Delete Product?</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {confirmProduct && (
            <>
              <p>
                Are you sure you want to delete <strong>{confirmProduct.name}</strong>?
              </p>
              {confirmProduct.event ? (
                <p className="mb-0">
                  This product is under event <strong>{confirmProduct.event.name}</strong>
                  {Number(confirmProduct.discount_price || 0) > 0 ? ' with discount applied.' : '.'}
                </p>
              ) : (
                <p className="mb-0">This product has no event discount.</p>
              )}
            </>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setConfirmProduct(null)}>
            No
          </CButton>
          <CButton color="danger" onClick={confirmDelete}>
            Yes, Delete
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  );
}
