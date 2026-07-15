import { useEffect, useMemo, useRef, useState } from 'react';
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
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilMove, cilPen, cilTrash } from '@coreui/icons';
import { createBanner, deleteBanner, fetchBanners, reorderBanners, updateBanner } from '../api/client';

const initialForm = {
  title: '',
  subtitle: '',
  button_text: '',
  button_link: '',
  button_pos_x: 50,
  button_pos_y: 80,
  button_style: 'solid',
  button_radius: 24,
  button_bg_color: '#e2211c',
  button_text_color: '#ffffff',
  button_width: 140,
  button_height: 40,
  button_text_size: 14,
  is_active: true,
};

const CROP_WIDTH = 960;
const MAX_BANNER_UPLOAD_BYTES = 1.8 * 1024 * 1024;

export default function BannersPage() {
  const fileInputRef = useRef(null);
  const editFormRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const buttonDraggingRef = useRef(false);
  const [banners, setBanners] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [currentImageUrl, setCurrentImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imageSrc, setImageSrc] = useState('');
  const [imageMeta, setImageMeta] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [cropAdjusted, setCropAdjusted] = useState(false);
  const [draggingCrop, setDraggingCrop] = useState(false);
  const [draggingButton, setDraggingButton] = useState(false);
  const [showButtonModal, setShowButtonModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const cropFrameHeight = useMemo(() => {
    if (!imageMeta.width || !imageMeta.height) return 320;
    return Math.round((CROP_WIDTH * imageMeta.height) / imageMeta.width);
  }, [imageMeta]);

  useEffect(() => {
    async function loadBanners() {
      try {
        const data = await fetchBanners();
        const list = Array.isArray(data) ? data : [];
        list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        setBanners(list);
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Unable to load banners.');
      } finally {
        setLoading(false);
      }
    }

    loadBanners();
  }, []);

  useEffect(() => {
    if (!imageSrc) return;
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      const newMinZoom = CROP_WIDTH / width;
      setImageMeta({ width, height });
      setMinZoom(newMinZoom);
      setZoom(newMinZoom);
      setPosition({ x: 0, y: 0 });
      setCropAdjusted(false);
    };
  }, [imageSrc]);

  useEffect(() => {
    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  function onInputChange(event) {
    const { name, value, type, checked } = event.target;
    if (name === 'button_radius') {
      const nextValue = Math.min(Math.max(Number(value) || 0, 0), 200);
      setForm((prev) => ({ ...prev, [name]: nextValue }));
      return;
    }
    if (name === 'button_width') {
      const nextValue = Math.min(Math.max(Number(value) || 0, 40), 400);
      setForm((prev) => ({ ...prev, [name]: nextValue }));
      return;
    }
    if (name === 'button_height') {
      const nextValue = Math.min(Math.max(Number(value) || 0, 24), 160);
      setForm((prev) => ({ ...prev, [name]: nextValue }));
      return;
    }
    if (name === 'button_text_size') {
      const nextValue = Math.min(Math.max(Number(value) || 0, 10), 64);
      setForm((prev) => ({ ...prev, [name]: nextValue }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  function onDrop(event) {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    setImageSrc(URL.createObjectURL(file));
    setCurrentImageUrl('');
    setCropAdjusted(false);
  }

  function onImageInputChange(event) {
    const file = event.target.files?.[0] || null;
    if (!file) return;
    setImageFile(file);
    setImageSrc(URL.createObjectURL(file));
    setCurrentImageUrl('');
    setCropAdjusted(false);
    event.target.value = '';
  }

  function startEdit(banner) {
    setEditingId(banner.id);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle || '',
      button_text: banner.button_text || '',
      button_link: banner.button_link || '',
      button_pos_x: banner.button_pos_x ?? 50,
      button_pos_y: banner.button_pos_y ?? 80,
      button_style: banner.button_style || 'solid',
      button_radius: banner.button_radius ?? 24,
      button_bg_color: banner.button_bg_color || '#e2211c',
      button_text_color: banner.button_text_color || '#ffffff',
      button_width: banner.button_width ?? 140,
      button_height: banner.button_height ?? 40,
      button_text_size: banner.button_text_size ?? 14,
      is_active: banner.is_active,
    });
    setCurrentImageUrl(banner.image_url || '');
    setImageFile(null);
    setImageSrc('');
    setCropAdjusted(false);
    setMessage('');
    setError('');
    requestAnimationFrame(() => {
      editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function resetForm(clearFeedback = true) {
    setEditingId(null);
    setForm(initialForm);
    setCurrentImageUrl('');
    setImageFile(null);
    setImageSrc('');
    setCropAdjusted(false);
    if (clearFeedback) {
      setMessage('');
      setError('');
    }
  }

  function centerButtonPosition() {
    setForm((prev) => ({ ...prev, button_pos_x: 50, button_pos_y: 80 }));
  }

  function clampPosition(nextPosition, nextZoom) {
    const scaledWidth = imageMeta.width * nextZoom;
    const scaledHeight = imageMeta.height * nextZoom;
    const minX = Math.min(0, CROP_WIDTH - scaledWidth);
    const maxX = Math.max(0, CROP_WIDTH - scaledWidth);
    const minY = Math.min(0, cropFrameHeight - scaledHeight);
    const maxY = Math.max(0, cropFrameHeight - scaledHeight);

    return {
      x: Math.min(Math.max(nextPosition.x, minX), maxX),
      y: Math.min(Math.max(nextPosition.y, minY), maxY),
    };
  }

  function handleCropStart(event) {
    event.preventDefault();
    setDraggingCrop(true);
    dragStartRef.current = {
      x: event.clientX ?? event.touches?.[0]?.clientX ?? 0,
      y: event.clientY ?? event.touches?.[0]?.clientY ?? 0,
      posX: position.x,
      posY: position.y,
    };
  }

  function handleCropMove(event) {
    if (!draggingCrop) return;
    const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
    const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    const nextPosition = clampPosition(
      {
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      },
      zoom
    );
    setPosition(nextPosition);
    if (dx !== 0 || dy !== 0) setCropAdjusted(true);
  }

  function handleCropEnd() {
    setDraggingCrop(false);
  }

  function handleButtonDragStart(event) {
    event.preventDefault();
    event.stopPropagation();
    buttonDraggingRef.current = true;
    setDraggingButton(true);
  }

  function handleButtonDragMove(event) {
    if (!buttonDraggingRef.current) return;
    const frame = event.currentTarget.getBoundingClientRect();
    const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
    const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;
    const nextX = Math.min(Math.max(((clientX - frame.left) / frame.width) * 100, 0), 100);
    const nextY = Math.min(Math.max(((clientY - frame.top) / frame.height) * 100, 0), 100);
    setForm((prev) => ({ ...prev, button_pos_x: nextX, button_pos_y: nextY }));
  }

  function handleButtonDragEnd() {
    buttonDraggingRef.current = false;
    setDraggingButton(false);
  }

  function handleZoomChange(event) {
    const nextZoom = Math.max(minZoom, Number(event.target.value) || minZoom);
    setZoom(nextZoom);
    setPosition((prev) => clampPosition(prev, nextZoom));
    setCropAdjusted(true);
  }

  function resetCrop() {
    setZoom(minZoom);
    setPosition({ x: 0, y: 0 });
    setCropAdjusted(false);
  }

  async function canvasToBannerFile(canvas) {
    const qualitySteps = [0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];
    let selectedBlob = null;

    for (const quality of qualitySteps) {
      selectedBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!selectedBlob || selectedBlob.size <= MAX_BANNER_UPLOAD_BYTES) break;
    }

    if (!selectedBlob) return null;
    return new File([selectedBlob], `banner-${Date.now()}.jpg`, { type: 'image/jpeg' });
  }

  async function getCroppedFile() {
    if (!imageSrc || !imageMeta.width || !imageMeta.height) return null;
    const image = new Image();
    image.src = imageSrc;
    await image.decode();

    if (!cropAdjusted && imageFile?.size <= MAX_BANNER_UPLOAD_BYTES) return imageFile;

    if (!cropAdjusted) {
      const originalCanvas = document.createElement('canvas');
      originalCanvas.width = imageMeta.width;
      originalCanvas.height = imageMeta.height;
      const originalContext = originalCanvas.getContext('2d');
      if (!originalContext) return null;
      originalContext.drawImage(image, 0, 0, imageMeta.width, imageMeta.height);
      return canvasToBannerFile(originalCanvas);
    }

    const sx = Math.max(0, -position.x / zoom);
    const sy = Math.max(0, -position.y / zoom);
    const sw = Math.min(imageMeta.width - sx, CROP_WIDTH / zoom);
    const sh = Math.min(imageMeta.height - sy, cropFrameHeight / zoom);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw));
    canvas.height = Math.max(1, Math.round(sh));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    return canvasToBannerFile(canvas);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const payload = new FormData();
    payload.append('title', form.title);
    payload.append('subtitle', form.subtitle || '');
    payload.append('button_text', form.button_text || '');
    payload.append('button_link', form.button_link || '');
    payload.append('button_pos_x', String(form.button_pos_x));
    payload.append('button_pos_y', String(form.button_pos_y));
    payload.append('button_style', form.button_style || 'solid');
    payload.append('button_radius', String(form.button_radius || 0));
    payload.append('button_bg_color', form.button_bg_color || '#e2211c');
    payload.append('button_text_color', form.button_text_color || '#ffffff');
    payload.append('button_width', String(form.button_width || 140));
    payload.append('button_height', String(form.button_height || 40));
    payload.append('button_text_size', String(form.button_text_size || 14));
    payload.append('is_active', form.is_active ? '1' : '0');

    if (imageFile && imageSrc) {
      const cropped = await getCroppedFile();
      if (cropped) {
        payload.append('image', cropped);
      }
    }

    try {
      if (editingId) {
        await updateBanner(editingId, payload);
        setMessage('Banner updated successfully.');
      } else {
        await createBanner(payload);
        setMessage('Banner created successfully.');
      }
      resetForm(false);
      setShowButtonModal(false);
      const data = await fetchBanners();
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      setBanners(list);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save banner.');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(bannerId) {
    setError('');
    setMessage('');

    try {
      await deleteBanner(bannerId);
      if (editingId === bannerId) {
        resetForm(false);
      }
      setBanners((prev) => prev.filter((banner) => banner.id !== bannerId));
      setMessage('Banner deleted successfully.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete banner.');
    }
  }

  const orderedBanners = useMemo(() => [...banners].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [banners]);

  function reorderList(list, dragId, targetId) {
    const next = [...list];
    const fromIndex = next.findIndex((item) => item.id === dragId);
    const toIndex = next.findIndex((item) => item.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return next;
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next.map((item, index) => ({ ...item, sort_order: index }));
  }

  async function handleDropBanner(targetId) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const nextList = reorderList(orderedBanners, draggingId, targetId);
    setBanners(nextList);
    setDraggingId(null);
    setDragOverId(null);

    try {
      await reorderBanners(nextList.map((item) => item.id));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to reorder banners.');
    }
  }

  return (
    <CRow>
      {(error || message) && (
        <CCol xs={12}>
          {error && (
            <CAlert color="danger" dismissible onClose={() => setError('')}>
              {error}
            </CAlert>
          )}
          {message && (
            <CAlert color="success" dismissible onClose={() => setMessage('')}>
              {message}
            </CAlert>
          )}
        </CCol>
      )}
      <CCol lg={4} ref={editFormRef} className="banner-edit-panel">
        <CCard className="mb-4">
          <CCardHeader>{editingId ? 'Edit Banner' : 'Create Banner'}</CCardHeader>
          <CCardBody>
            <CForm onSubmit={onSubmit}>
              <div className="mb-3">
                <CFormInput label="Title" name="title" value={form.title} onChange={onInputChange} required />
              </div>
              <div className="mb-3">
                <CFormTextarea
                  label="Subtitle"
                  name="subtitle"
                  rows={2}
                  value={form.subtitle}
                  onChange={onInputChange}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Banner Image</label>
                {editingId && (imageSrc || currentImageUrl) ? (
                  <div className="banner-form-preview">
                    <img src={imageSrc || currentImageUrl} alt={`${form.title || 'Banner'} preview`} />
                    <button
                      type="button"
                      className="banner-form-edit-button"
                      title="Edit banner image"
                      aria-label="Edit banner image"
                      onClick={() => setShowButtonModal(true)}
                    >
                      <CIcon icon={cilPen} />
                    </button>
                  </div>
                ) : (
                  <CButton type="button" color="dark" variant="outline" size="sm" onClick={() => setShowButtonModal(true)}>
                    Upload Banner
                  </CButton>
                )}
              </div>

              <div className="mb-3">
                <CFormCheck label="Active" name="is_active" checked={form.is_active} onChange={onInputChange} />
              </div>
              <div className="d-flex gap-2">
                <CButton type="submit" color="primary" disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </CButton>
                {editingId && (
                  <CButton type="button" color="secondary" variant="outline" onClick={() => resetForm()}>
                    Cancel
                  </CButton>
                )}
              </div>
            </CForm>
          </CCardBody>
        </CCard>
      </CCol>

      <CModal
        visible={showButtonModal}
        onClose={() => setShowButtonModal(false)}
        alignment="center"
        size="xl"
        className="banner-modal"
      >
        <CModalHeader>
          <CModalTitle>Banner Settings</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="mb-3">
            <label className="form-label">Banner Image (Drag & Drop)</label>
            <div
              className={`drop-zone ${isDragOver ? 'drop-zone-active' : ''} ${(imageSrc || currentImageUrl) ? 'drop-zone-has-image' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
            >
              {imageSrc ? (
                <img className="drop-zone-image" src={imageSrc} alt="Banner" />
              ) : currentImageUrl ? (
                <img className="drop-zone-image" src={currentImageUrl} alt="Banner" />
              ) : (
                <>
                  <p className="mb-1">Drag and drop one image here</p>
                  <small className="text-body-secondary">or click to choose</small>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="d-none" onChange={onImageInputChange} />
          </div>

          {imageSrc && (
            <div className="banner-cropper">
              <div
                className="banner-cropper-frame"
                style={{ height: `${cropFrameHeight}px` }}
                onMouseDown={handleCropStart}
                onMouseMove={(event) => {
                  handleCropMove(event);
                  handleButtonDragMove(event);
                }}
                onMouseUp={() => {
                  handleCropEnd();
                  handleButtonDragEnd();
                }}
                onMouseLeave={() => {
                  handleCropEnd();
                  handleButtonDragEnd();
                }}
                onTouchStart={handleCropStart}
                onTouchMove={(event) => {
                  handleCropMove(event);
                  handleButtonDragMove(event);
                }}
                onTouchEnd={() => {
                  handleCropEnd();
                  handleButtonDragEnd();
                }}
              >
                <img
                  className="banner-cropper-image"
                  src={imageSrc}
                  alt="Crop preview"
                  style={{
                    width: imageMeta.width * zoom,
                    height: imageMeta.height * zoom,
                    transform: `translate(${position.x}px, ${position.y}px)`,
                  }}
                />
                <div
                  className={`banner-button-preview ${draggingButton ? 'is-dragging' : ''}`}
                  style={{
                    left: `${form.button_pos_x}%`,
                    top: `${form.button_pos_y}%`,
                    borderRadius: `${form.button_radius || 0}px`,
                    width: `${form.button_width || 140}px`,
                    height: `${form.button_height || 40}px`,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: `${form.button_text_size || 14}px`,
                    '--banner-button-text-color': form.button_text_color || '#ffffff',
                    background:
                      form.button_style === 'ghost'
                        ? 'rgba(255,255,255,0.6)'
                        : form.button_style === 'outline'
                        ? 'transparent'
                        : form.button_bg_color,
                    color: form.button_text_color,
                    border:
                      form.button_style === 'outline'
                        ? `2px solid ${form.button_bg_color}`
                        : form.button_style === 'ghost'
                        ? `1px solid ${form.button_bg_color}`
                        : 'none',
                  }}
                  onMouseDown={handleButtonDragStart}
                  onTouchStart={handleButtonDragStart}
                  role="button"
                  tabIndex={0}
                >
                  {form.button_text || 'Button'}
                </div>
              </div>
              <div className="banner-cropper-controls">
                <label htmlFor="bannerZoom">Zoom</label>
                <input
                  id="bannerZoom"
                  type="range"
                  min={minZoom}
                  max={Math.max(minZoom * 4, minZoom + 1)}
                  step="0.01"
                  value={zoom}
                  onChange={handleZoomChange}
                />
                <button type="button" className="btn btn-light btn-sm" onClick={resetCrop}>
                  Reset
                </button>
              </div>
              <small className="text-body-secondary">
                {cropAdjusted ? 'Custom crop enabled.' : `Original image selected (${imageMeta.width} × ${imageMeta.height}).`}
              </small>
              <small className="text-body-secondary">Drag the image to crop it, or drag the button to set its position.</small>
            </div>
          )}

          {(imageSrc || currentImageUrl) && (
            <div
              className="banner-modal-preview"
              onMouseMove={handleButtonDragMove}
              onMouseUp={handleButtonDragEnd}
              onMouseLeave={handleButtonDragEnd}
              onTouchMove={handleButtonDragMove}
              onTouchEnd={handleButtonDragEnd}
            >
              <img src={imageSrc || currentImageUrl} alt="Banner preview" />
              <div
                className={`banner-modal-button ${draggingButton ? 'is-dragging' : ''}`}
                style={{
                  left: `${form.button_pos_x}%`,
                  top: `${form.button_pos_y}%`,
                  borderRadius: `${form.button_radius || 0}px`,
                  width: `${form.button_width || 140}px`,
                  height: `${form.button_height || 40}px`,
                  fontSize: `${form.button_text_size || 14}px`,
                  '--banner-button-text-color': form.button_text_color || '#ffffff',
                  background:
                    form.button_style === 'ghost'
                      ? 'rgba(255,255,255,0.6)'
                      : form.button_style === 'outline'
                      ? 'transparent'
                      : form.button_bg_color,
                  color: form.button_text_color,
                  border:
                    form.button_style === 'outline'
                      ? `2px solid ${form.button_bg_color}`
                      : form.button_style === 'ghost'
                      ? `1px solid ${form.button_bg_color}`
                      : 'none',
                }}
                onMouseDown={handleButtonDragStart}
                onTouchStart={handleButtonDragStart}
                role="button"
                tabIndex={0}
              >
                {form.button_text || 'Button'}
              </div>
            </div>
          )}
          <CRow className="mb-3">
            <CCol md={6}>
              <CFormInput
                label="Button Text"
                name="button_text"
                value={form.button_text}
                onChange={onInputChange}
                placeholder="Shop now"
              />
            </CCol>
            <CCol md={6}>
              <CFormInput
                label="Button Link"
                name="button_link"
                value={form.button_link}
                onChange={onInputChange}
                placeholder="https://example.com"
              />
            </CCol>
          </CRow>
          <CRow className="mb-3">
            <CCol md={6}>
              <label className="form-label">Button Style</label>
              <select
                className="form-select"
                name="button_style"
                value={form.button_style}
                onChange={onInputChange}
              >
                <option value="solid">Solid</option>
                <option value="outline">Outline</option>
                <option value="ghost">Ghost</option>
              </select>
            </CCol>
            <CCol md={6}>
              <CFormInput
                label="Button Radius"
                name="button_radius"
                type="number"
                min="0"
                max="200"
                value={form.button_radius}
                onChange={onInputChange}
              />
            </CCol>
          </CRow>
          <CRow className="mb-3">
            <CCol md={6}>
              <CFormInput
                label="Button BG"
                name="button_bg_color"
                type="color"
                value={form.button_bg_color}
                onChange={onInputChange}
              />
            </CCol>
            <CCol md={6}>
              <CFormInput
                label="Button Text Color"
                name="button_text_color"
                type="color"
                value={form.button_text_color}
                onChange={onInputChange}
                onInput={onInputChange}
              />
            </CCol>
          </CRow>
          <CRow className="mb-3">
            <CCol md={6}>
              <CFormInput
                label="Button Width"
                name="button_width"
                type="number"
                min="40"
                max="400"
                value={form.button_width}
                onChange={onInputChange}
              />
            </CCol>
            <CCol md={6}>
              <CFormInput
                label="Button Height"
                name="button_height"
                type="number"
                min="24"
                max="160"
                value={form.button_height}
                onChange={onInputChange}
              />
            </CCol>
          </CRow>
          <CRow>
            <CCol md={6}>
              <CFormInput
                label="Button Text Size"
                name="button_text_size"
                type="number"
                min="10"
                max="64"
                value={form.button_text_size}
                onChange={onInputChange}
              />
            </CCol>
            <CCol md={6} className="d-flex align-items-end">
              <CButton color="secondary" variant="outline" onClick={centerButtonPosition}>
                Center Button
              </CButton>
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={() => setShowButtonModal(false)}>
            Close
          </CButton>
          <CButton color="primary" onClick={() => setShowButtonModal(false)}>
            Done
          </CButton>
        </CModalFooter>
      </CModal>

      <CCol lg={8}>
        <CCard className="mb-4">
          <CCardHeader>Banners Priority (Drag to reorder)</CCardHeader>
          <CCardBody>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <div className="banner-list">
                {orderedBanners.map((banner) => (
                  <div
                    key={banner.id}
                    className={`banner-item ${draggingId === banner.id ? 'is-dragging' : ''} ${dragOverId === banner.id ? 'is-over' : ''}`}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', String(banner.id));
                      event.dataTransfer.effectAllowed = 'move';
                      setDraggingId(banner.id);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragOverId(banner.id);
                    }}
                    onDrop={() => handleDropBanner(banner.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverId(null);
                    }}
                  >
                    <div className="banner-drag-handle">
                      <CIcon icon={cilMove} />
                    </div>
                    <div className="banner-thumb">
                      {banner.image_url ? <img src={banner.image_url} alt={banner.title} /> : <div className="banner-thumb-placeholder" />}
                    </div>
                    <div className="banner-meta">
                      <strong>{banner.title}</strong>
                      <span>{banner.subtitle || '—'}</span>
                      <small>{banner.button_text ? `Button: ${banner.button_text}` : 'No button text'}</small>
                    </div>
                    <div className="banner-actions">
                      <CButton color="info" variant="outline" size="sm" title="Edit" onClick={() => startEdit(banner)}>
                        <CIcon icon={cilPen} />
                      </CButton>
                      <CButton color="danger" variant="outline" size="sm" title="Delete" onClick={() => onDelete(banner.id)}>
                        <CIcon icon={cilTrash} />
                      </CButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  );
}
