import { useEffect, useMemo, useState } from 'react';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CFormTextarea,
  CRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPen, cilTrash } from '@coreui/icons';
import AppDataTable from '../components/AppDataTable';
import {
  createAiKnowledgeEntry,
  deleteAiKnowledgeEntry,
  fetchAiKnowledgeEntries,
  updateAiKnowledgeEntry,
} from '../api/client';

const topics = [
  'company',
  'contact',
  'showrooms',
  'delivery',
  'services',
  'quotation',
  'policies',
  'product_advice',
  'other',
];
const initialForm = {
  title: '',
  topic: 'company',
  content: '',
  sort_order: 0,
  is_active: true,
};

export default function AiKnowledgePage() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadEntries() {
    try {
      const data = await fetchAiKnowledgeEntries();
      setEntries(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load AI knowledge.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
  }, []);

  function onInputChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setForm({
      title: entry.title,
      topic: entry.topic,
      content: entry.content,
      sort_order: entry.sort_order,
      is_active: entry.is_active,
    });
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm(initialForm);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (editingId) {
        await updateAiKnowledgeEntry(editingId, form);
        setMessage(`“${form.title}” was updated. New assistant conversations will use it.`);
      } else {
        await createAiKnowledgeEntry(form);
        setMessage(`“${form.title}” was added to the assistant knowledge.`);
      }
      resetForm();
      await loadEntries();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save AI knowledge.');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(entry) {
    if (!window.confirm(`Delete “${entry.title}” from the assistant knowledge?`)) return;
    setError('');
    setMessage('');

    try {
      await deleteAiKnowledgeEntry(entry.id);
      if (editingId === entry.id) resetForm();
      setMessage(`“${entry.title}” was removed.`);
      await loadEntries();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete AI knowledge.');
    }
  }

  const columns = useMemo(() => [
    { name: 'Order', selector: (row) => row.sort_order, sortable: true, width: '90px' },
    { name: 'Title', selector: (row) => row.title, sortable: true, grow: 1.2 },
    { name: 'Topic', selector: (row) => row.topic, sortable: true },
    {
      name: 'Knowledge',
      selector: (row) => row.content,
      cell: (row) => <span title={row.content}>{row.content}</span>,
      grow: 2.2,
    },
    { name: 'Status', selector: (row) => (row.is_active ? 'Active' : 'Inactive'), sortable: true },
    {
      name: 'Actions',
      cell: (row) => (
        <div className="d-flex gap-2">
          <CButton color="info" variant="outline" size="sm" title="Edit" onClick={() => startEdit(row)}>
            <CIcon icon={cilPen} />
          </CButton>
          <CButton color="danger" variant="outline" size="sm" title="Delete" onClick={() => onDelete(row)}>
            <CIcon icon={cilTrash} />
          </CButton>
        </div>
      ),
      width: '120px',
    },
  ], [editingId]);

  return (
    <>
      <div className="mb-4">
        <h1 className="h3 mb-2">AI Assistant Knowledge</h1>
        <p className="text-body-secondary mb-0">
          Add verified business facts here. Product prices, stock, colours, sizes, and measurements are read directly from the catalogue.
        </p>
      </div>

      <CRow>
        <CCol xl={4}>
          <CCard className="mb-4">
            <CCardHeader>{editingId ? 'Edit knowledge' : 'Add knowledge'}</CCardHeader>
            <CCardBody>
              <CForm onSubmit={onSubmit}>
                <CFormInput className="mb-3" label="Title" name="title" value={form.title} onChange={onInputChange} required />
                <CFormSelect className="mb-3" label="Topic" name="topic" value={form.topic} onChange={onInputChange}>
                  {topics.map((topic) => <option key={topic} value={topic}>{topic.replace('_', ' ')}</option>)}
                </CFormSelect>
                <CFormTextarea
                  className="mb-3"
                  label="Verified information"
                  name="content"
                  value={form.content}
                  onChange={onInputChange}
                  rows={9}
                  maxLength={10000}
                  required
                />
                <CFormInput
                  className="mb-3"
                  label="Display order"
                  type="number"
                  min="0"
                  max="65535"
                  name="sort_order"
                  value={form.sort_order}
                  onChange={onInputChange}
                />
                <CFormCheck className="mb-3" label="Active" name="is_active" checked={form.is_active} onChange={onInputChange} />
                <div className="d-flex gap-2">
                  <CButton type="submit" color="primary" disabled={saving}>
                    {saving ? 'Saving...' : editingId ? 'Update' : 'Add knowledge'}
                  </CButton>
                  {editingId && <CButton type="button" color="secondary" variant="outline" onClick={resetForm}>Cancel</CButton>}
                </div>
              </CForm>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={8}>
          <CCard className="mb-4">
            <CCardHeader>Verified business knowledge</CCardHeader>
            <CCardBody>
              {error && <CAlert color="danger">{error}</CAlert>}
              {message && <CAlert color="success">{message}</CAlert>}
              <AppDataTable columns={columns} data={entries} progressPending={loading} />
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  );
}
