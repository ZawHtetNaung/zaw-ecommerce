import { useCallback, useEffect, useMemo, useState } from 'react';
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader } from '@coreui/react';
import AppDataTable from '../components/AppDataTable';
import { fetchAdminAccounts, updateAdminAccountStatus } from '../api/client';

const statusColors = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  suspended: 'secondary',
};

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadAccounts = useCallback(async () => {
    try {
      const data = await fetchAdminAccounts();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load administrator accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const changeStatus = useCallback(async (account, status) => {
    const action = status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'suspend';
    if (!window.confirm(`${action.charAt(0).toUpperCase()}${action.slice(1)} administrator access for ${account.name}?`)) return;

    setUpdatingId(account.id);
    setError('');
    setMessage('');
    try {
      const data = await updateAdminAccountStatus(account.id, status);
      setMessage(data.message);
      await loadAccounts();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update administrator access.');
    } finally {
      setUpdatingId(null);
    }
  }, [loadAccounts]);

  const columns = useMemo(() => [
    { name: 'Name', selector: (row) => row.name, sortable: true },
    { name: 'Email', selector: (row) => row.email, sortable: true, grow: 1.2 },
    { name: 'Phone', selector: (row) => row.phone || '—', sortable: true },
    { name: 'Job title', selector: (row) => row.job_title || '—', sortable: true },
    {
      name: 'Reason',
      selector: (row) => row.access_reason || '',
      cell: (row) => <span title={row.access_reason || ''}>{row.access_reason || '—'}</span>,
      grow: 1.5,
    },
    {
      name: 'Role',
      cell: (row) => <CBadge color={row.role === 'super_admin' ? 'dark' : 'info'}>{row.role.replace('_', ' ')}</CBadge>,
      sortable: true,
      selector: (row) => row.role,
    },
    {
      name: 'Status',
      cell: (row) => <CBadge color={statusColors[row.admin_status] || 'secondary'}>{row.admin_status}</CBadge>,
      sortable: true,
      selector: (row) => row.admin_status,
    },
    {
      name: 'Actions',
      cell: (row) => {
        if (row.role === 'super_admin') return <span className="text-body-secondary small">Protected</span>;
        const disabled = updatingId === row.id;
        return (
          <div className="d-flex flex-wrap gap-1">
            {row.admin_status !== 'approved' && (
              <CButton color="success" variant="outline" size="sm" disabled={disabled} onClick={() => changeStatus(row, 'approved')}>Approve</CButton>
            )}
            {row.admin_status !== 'rejected' && (
              <CButton color="danger" variant="outline" size="sm" disabled={disabled} onClick={() => changeStatus(row, 'rejected')}>Reject</CButton>
            )}
            {row.admin_status === 'approved' && (
              <CButton color="secondary" variant="outline" size="sm" disabled={disabled} onClick={() => changeStatus(row, 'suspended')}>Suspend</CButton>
            )}
          </div>
        );
      },
      minWidth: '220px',
    },
  ], [changeStatus, updatingId]);

  return (
    <CCard className="mb-4">
      <CCardHeader>
        <strong>Administrator approvals</strong>
        <div className="small text-body-secondary mt-1">Only the super administrator can approve, reject, or suspend dashboard access.</div>
      </CCardHeader>
      <CCardBody>
        {error && <CAlert color="danger">{error}</CAlert>}
        {message && <CAlert color="success">{message}</CAlert>}
        <AppDataTable columns={columns} data={accounts} progressPending={loading} />
      </CCardBody>
    </CCard>
  );
}
