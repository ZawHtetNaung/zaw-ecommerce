import { useEffect, useMemo, useState } from 'react';
import { CAlert, CBadge, CCard, CCardBody, CCardHeader } from '@coreui/react';
import AppDataTable from '../components/AppDataTable';
import { fetchUsers } from '../api/client';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await fetchUsers();
        setUsers(Array.isArray(data) ? data : []);
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Unable to load users.');
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  const columns = useMemo(
    () => [
      { name: 'ID', selector: (row) => row.id, sortable: true, width: '90px' },
      { name: 'Name', selector: (row) => row.name, sortable: true },
      { name: 'Email', selector: (row) => row.email, sortable: true },
      { name: 'Phone', selector: (row) => row.phone || '—', sortable: true },
      {
        name: 'Account type',
        selector: (row) => row.role,
        sortable: true,
        cell: (row) => <CBadge color={row.role === 'customer' ? 'light' : 'info'}>{row.role.replace('_', ' ')}</CBadge>,
      },
      {
        name: 'Status',
        selector: (row) => row.admin_status,
        sortable: true,
        cell: (row) => <CBadge color={row.admin_status === 'approved' ? 'success' : 'warning'}>{row.admin_status}</CBadge>,
      },
    ],
    []
  );

  return (
    <CCard>
      <CCardHeader>Customer and staff accounts</CCardHeader>
      <CCardBody>
        {error && <CAlert color="danger">{error}</CAlert>}
        <AppDataTable columns={columns} data={users} progressPending={loading} />
      </CCardBody>
    </CCard>
  );
}
