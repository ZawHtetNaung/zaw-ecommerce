import { useEffect, useMemo, useState } from 'react';
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CForm, CFormInput } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPen, cilTrash } from '@coreui/icons';
import AppDataTable from '../components/AppDataTable';
import { createSizeOption, deleteSizeOption, fetchSizeOptions, updateSizeOption } from '../api/client';

export default function SizeOptionsPage() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadItems() {
    try { setItems(await fetchSizeOptions()); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load size options.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadItems(); }, []);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      if (editingId) { await updateSizeOption(editingId, { name }); setMessage(`${name} updated successfully.`); }
      else { await createSizeOption({ name }); setMessage(`${name} created successfully.`); }
      setName(''); setEditingId(null); await loadItems();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to save size option.'); }
    finally { setSaving(false); }
  }

  async function remove(item) {
    if (!window.confirm(`Delete ${item.name}? It will be removed from assigned products.`)) return;
    try { await deleteSizeOption(item.id); setMessage(`${item.name} deleted successfully.`); await loadItems(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to delete size option.'); }
  }

  const columns = useMemo(() => [
    { name: 'ID', selector: (row) => row.id, sortable: true, width: '90px' },
    { name: 'Name', selector: (row) => row.name, sortable: true },
    { name: 'Slug', selector: (row) => row.slug, sortable: true },
    { name: 'Actions', width: '130px', cell: (row) => <div className="d-flex gap-2"><CButton size="sm" color="info" variant="outline" onClick={() => { setEditingId(row.id); setName(row.name); }}><CIcon icon={cilPen} /></CButton><CButton size="sm" color="danger" variant="outline" onClick={() => remove(row)}><CIcon icon={cilTrash} /></CButton></div> },
  ], []);

  return <CCard>
    <CCardHeader>Size Options</CCardHeader>
    <CCardBody>
      {message && <CAlert color="success" dismissible onClose={() => setMessage('')}>{message}</CAlert>}
      {error && <CAlert color="danger" dismissible onClose={() => setError('')}>{error}</CAlert>}
      <CForm className="d-flex gap-2 align-items-end mb-4" onSubmit={submit}>
        <div className="flex-grow-1"><CFormInput label="Size Name" placeholder="Example: Extra Large" value={name} onChange={(event) => setName(event.target.value)} required /></div>
        <CButton type="submit" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</CButton>
        {editingId && <CButton type="button" color="secondary" variant="outline" onClick={() => { setEditingId(null); setName(''); }}>Cancel</CButton>}
      </CForm>
      <AppDataTable columns={columns} data={items} progressPending={loading} searchPlaceholder="Search size options..." />
    </CCardBody>
  </CCard>;
}
