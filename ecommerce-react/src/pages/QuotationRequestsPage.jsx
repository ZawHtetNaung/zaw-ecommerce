import { useEffect, useMemo, useState } from 'react';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormSelect,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilTrash } from '@coreui/icons';
import AppDataTable from '../components/AppDataTable';
import {
  deleteQuotationRequest,
  fetchQuotationRequests,
  updateQuotationRequest,
} from '../api/client';

const statuses = [
  ['new', 'New'],
  ['contacted', 'Contacted'],
  ['quoted', 'Quoted'],
  ['closed', 'Closed'],
];

function money(value) {
  return `AED ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-AE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function QuotationRequestsPage() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadQuotations() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchQuotationRequests();
      setQuotations(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load quotation requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuotations();
  }, []);

  async function changeStatus(quotation, status) {
    setBusyId(quotation.id);
    setError('');
    setMessage('');
    try {
      const response = await updateQuotationRequest(quotation.id, {
        status,
        staff_note: quotation.staff_note || null,
      });
      setQuotations((current) => current.map((item) => (
        item.id === quotation.id ? response.quotation : item
      )));
      setMessage(response.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this quotation.');
    } finally {
      setBusyId(null);
    }
  }

  async function removeQuotation(quotation) {
    if (!window.confirm(`Delete ${quotation.reference}? This cannot be undone.`)) return;
    setBusyId(quotation.id);
    setError('');
    setMessage('');
    try {
      const response = await deleteQuotationRequest(quotation.id);
      setQuotations((current) => current.filter((item) => item.id !== quotation.id));
      setMessage(response.message);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete this quotation.');
    } finally {
      setBusyId(null);
    }
  }

  const columns = useMemo(() => [
    {
      name: 'Reference',
      selector: (row) => row.reference,
      sortable: true,
      width: '190px',
    },
    {
      name: 'Customer',
      selector: (row) => row.customer_name,
      sortable: true,
      cell: (row) => (
        <div className="py-2">
          <strong className="d-block">{row.customer_name}</strong>
          <span className="small text-body-secondary">{row.company || row.project_type || 'Private customer'}</span>
        </div>
      ),
    },
    {
      name: 'Contact',
      selector: (row) => `${row.email} ${row.phone}`,
      cell: (row) => (
        <div className="py-2">
          <a className="d-block" href={`mailto:${row.email}`}>{row.email}</a>
          <a className="d-block" href={`tel:${row.phone}`}>{row.phone}</a>
        </div>
      ),
    },
    {
      name: 'Products',
      selector: (row) => row.items?.length || 0,
      cell: (row) => (
        <details className="quotation-admin-items">
          <summary>{row.items?.length || 0} item{row.items?.length === 1 ? '' : 's'} · {money(row.total_amount)}</summary>
          <div>
            {(row.items || []).map((item) => (
              <p key={item.id}>
                <strong>{item.product_name}</strong>
                <span>Qty {item.quantity}{item.selected_color_name ? ` · ${item.selected_color_name}` : ''}{item.selected_size_name ? ` · ${item.selected_size_name}` : ''}</span>
              </p>
            ))}
            {(row.project_type || row.emirate || row.required_by) && (
              <p>
                <strong>Project</strong>
                <span>
                  {[row.project_type, row.emirate, row.required_by ? `Required ${row.required_by}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </p>
            )}
            {row.message && <p><strong>Customer note</strong><span>{row.message}</span></p>}
          </div>
        </details>
      ),
      grow: 1.5,
    },
    {
      name: 'Received',
      selector: (row) => row.created_at,
      format: (row) => formatDate(row.created_at),
      sortable: true,
    },
    {
      name: 'Status',
      selector: (row) => row.status,
      sortable: true,
      cell: (row) => (
        <CFormSelect
          size="sm"
          value={row.status}
          disabled={busyId === row.id}
          onChange={(event) => changeStatus(row, event.target.value)}
          aria-label={`Status for ${row.reference}`}
        >
          {statuses.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </CFormSelect>
      ),
      width: '150px',
    },
    {
      name: 'Actions',
      cell: (row) => (
        <CButton
          color="danger"
          variant="outline"
          size="sm"
          title={`Delete ${row.reference}`}
          disabled={busyId === row.id}
          onClick={() => removeQuotation(row)}
        >
          <CIcon icon={cilTrash} />
        </CButton>
      ),
      width: '90px',
    },
  ], [busyId]);

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex align-items-center justify-content-between">
        <strong>Quotation Requests</strong>
        <span className="text-body-secondary small">{quotations.length} total</span>
      </CCardHeader>
      <CCardBody>
        {error && <CAlert color="danger">{error}</CAlert>}
        {message && <CAlert color="success">{message}</CAlert>}
        <AppDataTable
          columns={columns}
          data={quotations}
          progressPending={loading}
          searchPlaceholder="Search quotations..."
        />
      </CCardBody>
    </CCard>
  );
}
