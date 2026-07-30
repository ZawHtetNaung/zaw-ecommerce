import { useEffect, useMemo, useState } from 'react';
import {
  CAlert,
  CBadge,
  CCard,
  CCardBody,
  CCardHeader,
  CFormSelect,
} from '@coreui/react';
import AppDataTable from '../components/AppDataTable';
import { fetchOrders, updateOrder } from '../api/client';

const orderStatuses = [
  ['new', 'New'],
  ['confirmed', 'Confirmed'],
  ['processing', 'Processing'],
  ['ready', 'Ready'],
  ['dispatched', 'Dispatched'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

const paymentStatuses = [
  ['unpaid', 'Unpaid'],
  ['pending', 'Pending'],
  ['paid', 'Paid'],
  ['refunded', 'Refunded'],
];

function money(value, currency = 'AED') {
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-AE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusColor(status) {
  if (status === 'new') return 'danger';
  if (['confirmed', 'processing'].includes(status)) return 'warning';
  if (['ready', 'dispatched'].includes(status)) return 'info';
  if (status === 'completed') return 'success';
  return 'secondary';
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadOrders() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function saveOrder(order, changes) {
    setBusyId(order.id);
    setError('');
    setMessage('');

    try {
      const response = await updateOrder(order.id, {
        status: changes.status ?? order.status,
        payment_status: changes.payment_status ?? order.payment_status,
        staff_note: order.staff_note || null,
      });
      setOrders((current) => current.map((item) => (
        item.id === order.id ? response.order : item
      )));
      setMessage(response.message);
      window.dispatchEvent(new CustomEvent('admin:notifications-refresh'));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this order.');
    } finally {
      setBusyId(null);
    }
  }

  const columns = useMemo(() => [
    {
      name: 'Order',
      selector: (row) => row.reference,
      sortable: true,
      width: '205px',
      cell: (row) => (
        <div className="py-2">
          <strong className="d-block">{row.reference}</strong>
          <CBadge color={statusColor(row.status)}>{row.status}</CBadge>
        </div>
      ),
    },
    {
      name: 'Customer',
      selector: (row) => `${row.customer_name} ${row.email} ${row.phone}`,
      sortable: true,
      cell: (row) => (
        <div className="py-2">
          <strong className="d-block">{row.customer_name}</strong>
          <a className="d-block small" href={`mailto:${row.email}`}>{row.email}</a>
          <a className="d-block small" href={`tel:${row.phone}`}>{row.phone}</a>
        </div>
      ),
    },
    {
      name: 'Delivery',
      selector: (row) => `${row.emirate_code} ${row.city_area} ${row.address_line_1}`,
      cell: (row) => (
        <div className="py-2 order-admin-delivery">
          <strong>{row.city_area} · {row.emirate_code}</strong>
          <span>{row.address_line_1}{row.address_line_2 ? `, ${row.address_line_2}` : ''}</span>
          {row.delivery_notes && <small>{row.delivery_notes}</small>}
        </div>
      ),
      grow: 1.2,
    },
    {
      name: 'Products',
      selector: (row) => row.items?.length || 0,
      cell: (row) => (
        <details className="quotation-admin-items">
          <summary>{row.items?.length || 0} item{row.items?.length === 1 ? '' : 's'} · {money(row.total_amount, row.currency)}</summary>
          <div>
            {(row.items || []).map((item) => (
              <p key={item.id}>
                <strong>{item.product_name}</strong>
                <span>Qty {item.quantity} · {money(item.line_total, row.currency)}</span>
              </p>
            ))}
            <p>
              <strong>Delivery</strong>
              <span>{money(row.shipping_amount, row.currency)}</span>
            </p>
          </div>
        </details>
      ),
      grow: 1.35,
    },
    {
      name: 'Received',
      selector: (row) => row.created_at,
      format: (row) => formatDate(row.created_at),
      sortable: true,
      width: '155px',
    },
    {
      name: 'Order status',
      selector: (row) => row.status,
      sortable: true,
      width: '160px',
      cell: (row) => (
        <CFormSelect
          size="sm"
          value={row.status}
          disabled={busyId === row.id}
          onChange={(event) => saveOrder(row, { status: event.target.value })}
          aria-label={`Order status for ${row.reference}`}
        >
          {orderStatuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </CFormSelect>
      ),
    },
    {
      name: 'Payment',
      selector: (row) => row.payment_status,
      sortable: true,
      width: '145px',
      cell: (row) => (
        <CFormSelect
          size="sm"
          value={row.payment_status}
          disabled={busyId === row.id}
          onChange={(event) => saveOrder(row, { payment_status: event.target.value })}
          aria-label={`Payment status for ${row.reference}`}
        >
          {paymentStatuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </CFormSelect>
      ),
    },
  ], [busyId]);

  const newCount = orders.filter((order) => order.status === 'new').length;

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex align-items-center justify-content-between">
        <strong>Orders</strong>
        <span className="text-body-secondary small">{orders.length} total · {newCount} new</span>
      </CCardHeader>
      <CCardBody>
        {error && <CAlert color="danger">{error}</CAlert>}
        {message && <CAlert color="success">{message}</CAlert>}
        <AppDataTable
          columns={columns}
          data={orders}
          progressPending={loading}
          searchPlaceholder="Search orders..."
        />
      </CCardBody>
    </CCard>
  );
}
