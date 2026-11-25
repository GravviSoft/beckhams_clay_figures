import { useEffect, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import UploadWorkspace from '../../workspaces/upload/UploadWorkspace';
import PageLoader from '../../components/PageLoader';
import StatusState from '../../components/StatusState';
import { isUnauthorizedError, UnauthorizedError } from '../../services/api';
import { getAuthToken } from '../../services/auth';
import { featureFigure, figureAssetUrl, listFigures, saveFigure } from './galleryApi';
import ViewerControls from './ViewerControls';
import './ClayGalleryPage.css';

const localPreview = process.env.NODE_ENV === 'development';
const viewerModule = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.1.0/dist/model-viewer.min.js';
let viewerReady;

function loadViewer() {
  if (!viewerReady) {
    viewerReady = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = viewerModule;
      script.onload = () => {
        if (customElements.get('model-viewer')) resolve();
        else reject(new Error('3D viewer unavailable'));
      };
      script.onerror = () => {
        script.remove();
        reject(new Error('3D viewer unavailable'));
      };
      document.head.append(script);
    }).catch((error) => {
      viewerReady = undefined;
      throw error;
    });
  }
  return viewerReady;
}

function ModelPreview({ file, source, title, captureThumbnail }) {
  const [url, setUrl] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [orbit, setOrbit] = useState(null);
  const viewerRef = useRef(null);
  const originalView = useRef(null);

  useEffect(() => {
    const element = viewerRef.current;
    if (!loaded || !element) return undefined;
    const trackCamera = () => setOrbit(element.getCameraOrbit());
    element.addEventListener('camera-change', trackCamera);
    return () => element.removeEventListener('camera-change', trackCamera);
  }, [loaded]);

  useEffect(() => {
    let active = true;
    const objectUrl = file ? URL.createObjectURL(file) : source;
    loadViewer().then(() => {
      if (active) setUrl(objectUrl);
    }).catch(() => {
      if (active) setError('Check your connection and try opening the figure again.');
    });
    return () => {
      active = false;
      if (file) URL.revokeObjectURL(objectUrl);
    };
  }, [file, source]);

  function bindViewer(element) {
    viewerRef.current = element;
    if (!element) return;
    element.onload = () => {
      const initialOrbit = element.getCameraOrbit();
      const target = element.getCameraTarget();
      originalView.current = {
        'camera-orbit': initialOrbit.toString(),
        'camera-target': `${target.x}m ${target.y}m ${target.z}m`,
        'field-of-view': `${element.getFieldOfView()}deg`,
      };
      setOrbit(initialOrbit);
      setLoaded(true);
      if (captureThumbnail) {
        try {
          captureThumbnail(element.toDataURL('image/webp', 0.75));
        } catch {
          // Keep the filename visible if the renderer cannot capture an image.
        }
      }
    };
    element.onerror = () => setError('Try another GLB and check that your browser supports WebGL.');
  }

  function setCameraGoal(element, attribute, value) {
    // A distinct attribute string reapplies the same goal after manual orbit or zoom.
    element.setAttribute(attribute, element.getAttribute(attribute) === value ? `${value} ` : value);
  }

  function resetView() {
    const element = viewerRef.current;
    for (const [attribute, value] of Object.entries(originalView.current)) {
      setCameraGoal(element, attribute, value);
    }
  }

  function alignAxis(angles) {
    const element = viewerRef.current;
    setCameraGoal(element, 'camera-orbit', `${angles} ${element.getCameraOrbit().radius}m`);
  }

  if (error) return <StatusState type="error" title="The 3D preview could not load" message={error} />;
  return (
    <>
      <div className="clay-model-viewport">
        {url && (
          <model-viewer ref={bindViewer} src={url} alt={title || file?.name}
            camera-controls touch-action="pan-y" min-field-of-view="15deg" shadow-intensity="0.8" />
        )}
        {!loaded && <div className="clay-stage__loading"><PageLoader compact label="Loading 3D preview" /></div>}
      </div>
      {loaded && orbit && <ViewerControls orbit={orbit}
        onZoom={(step) => viewerRef.current.zoom(step)} onReset={resetView} onAxis={alignAxis} />}
    </>
  );
}

export default function ClayGalleryPage() {
  const { signedIn, canFeature, editableFigureIds, markEditable, requestSignIn } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const [figures, setFigures] = useState(null);
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState([]);
  const [previewId, setPreviewId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [savedEditId, setSavedEditId] = useState(null);
  const filePicker = useRef(null);
  const editing = previews.find(({ id }) => id === editId);
  const savedEditing = figures?.find(({ id }) => id === savedEditId);
  const [uploadedId, setUploadedId] = useState(null);
  const [featuredPreviewId, setFeaturedPreviewId] = useState(null);
  const [featurePending, setFeaturePending] = useState(false);
  const [featureError, setFeatureError] = useState('');
  const nextPreviewId = useRef(0);
  const activeUpload = useRef(null);
  const preview = previews.find(({ id }) => id === previewId);
  const [fileError, setFileError] = useState('');
  const figure = figures?.find(({ id }) => String(id) === (uploadedId ?? params.get('figure'))) ?? figures?.[0];
  const hasModel = figure?.assets?.some(({ asset_type }) => asset_type === 'display_model');
  const madeOn = preview ? preview.madeOn : figure?.made_on;

  useEffect(() => {
    let active = true;
    listFigures()
      .then((items) => {
        if (active) setFigures((current) => current
          ? [...current, ...items.filter((item) => !current.some(({ id }) => id === item.id))]
          : items);
      })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);

  function chooseFile(event) {
    const persist = event.currentTarget === filePicker.current;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.glb$/i.test(file.name) || !file.size) {
      setFileError('Choose a non-empty .glb file.');
      return;
    }
    setFileError('');
    const id = ++nextPreviewId.current;
    const name = file.name.replace(/\.glb$/i, '').replace(/_/g, ' ').trim().slice(0, 150) || 'Untitled figure';
    const draft = { id, file, name, madeOn: '', description: '', saving: persist };
    setPreviews((items) => [draft, ...items]);
    setPreviewId(id);
    setMenuId(null);
    activeUpload.current = persist ? id : null;
    if (persist) persistPreview(draft);
  }

  async function persistPreview(draft, promptOnExpiry = true) {
    setPreviews((items) => items.map((item) => item.id === draft.id
      ? { ...item, saving: true, saveError: '', needsSignIn: false } : item));
    const token = getAuthToken();
    const form = new FormData();
    form.set('character_name', draft.name);
    form.set('model', draft.file);
    if (draft.madeOn) form.set('made_on', draft.madeOn);
    if (draft.description) form.set('description', draft.description);
    if (draft.poster) form.set('poster', draft.poster);
    try {
      if (!token) throw new UnauthorizedError();
      const { id } = await saveFigure(form);
      markEditable(id, token);
      const saved = {
        id, character_name: draft.name, made_on: draft.madeOn, description: draft.description,
        assets: [{ asset_type: 'display_model' }, ...(draft.poster ? [{ asset_type: 'gallery_poster' }] : [])],
      };
      setFigures((items) => {
        const remaining = (items ?? []).filter((item) => item.id !== id);
        const featured = remaining.filter((item) => item.featured);
        return [...featured, saved, ...remaining.filter((item) => !item.featured)];
      });
      setPreviews((items) => items.filter(({ id: localId }) => localId !== draft.id));
      setFeaturedPreviewId((current) => current === draft.id ? null : current);
      if (activeUpload.current === draft.id) {
        setUploadedId(String(id));
        setPreviewId(null);
        activeUpload.current = null;
      }
    } catch (err) {
      const needsSignIn = isUnauthorizedError(err);
      setPreviews((items) => items.map((item) => item.id === draft.id
        ? { ...item, saving: false, needsSignIn, saveError: needsSignIn ? '' : err.message } : item));
      if (needsSignIn && promptOnExpiry && !getAuthToken()) {
        requestSignIn(() => persistPreview(draft, false));
      }
    }
  }

  function deletePreview(id) {
    const remaining = previews.filter((item) => item.id !== id);
    setPreviews(remaining);
    if (previewId === id) setPreviewId(remaining[0]?.id ?? null);
    if (featuredPreviewId === id) setFeaturedPreviewId(null);
    setMenuId(null);
  }

  async function featureSaved(item) {
    activeUpload.current = null;
    setFeaturePending(true);
    setFeatureError('');
    try {
      await featureFigure(item.id);
      setFigures((items) => [
        { ...item, featured: true },
        ...items.filter(({ id }) => id !== item.id).map((entry) => ({ ...entry, featured: false })),
      ]);
      setPreviewId(null);
      setUploadedId(null);
      setFeaturedPreviewId(null);
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        next.delete('figure');
        return next;
      }, { replace: true });
    } catch (err) {
      setFeatureError(err.message);
    } finally {
      setFeaturePending(false);
    }
  }

  async function figureSaved(id) {
    markEditable(id);
    if (editId !== null) deletePreview(editId);
    setEditId(null);
    setSavedEditId(null);
    setPreviewId(null);
    setUploadedId(String(id));
    setError('');
    try {
      setFigures(await listFigures());
    } catch {
      setError('Figure saved. Refresh the gallery to load it.');
    }
  }

  function saveEdit(details) {
    setPreviews((items) => items.map((item) => item.id === editId ? { ...item, ...details } : item));
    setEditId(null);
  }

  return (
    <section className="clay-studio" aria-label="Clay figure gallery">
      <div className="clay-stage">
        <header className="clay-stage__heading">
          <h1>{preview?.name || figure?.character_name || 'Beck’s clay collection'}</h1>
          {madeOn && <p><time dateTime={madeOn}>{madeOn}</time></p>}
          {(preview || hasModel) && <p>Drag to rotate · Scroll or pinch to zoom</p>}
        </header>
        <div className="clay-stage__view">
          {preview ? <ModelPreview key={preview.id} file={preview.file}
            captureThumbnail={preview.thumbnail ? undefined : (thumbnail) => {
              setPreviews((items) => items.map((item) => item.id === preview.id
                ? { ...item, thumbnail } : item));
            }} /> : hasModel ? (
              <ModelPreview key={`saved-${figure.id}`} title={figure.character_name}
                source={figureAssetUrl(figure.id, 'display_model')} />
            ) : (
            <p>{figure ? '3D preview unavailable for this figure.' : 'Select a figure to explore it.'}</p>
          )}
        </div>
        {(preview ? preview.description : figure?.description) && (
          <p className="clay-stage__caption">{preview ? preview.description : figure.description}</p>
        )}
      </div>
      <aside className="clay-rail" aria-label="Collection">
        <div className="clay-rail__heading">
          <h2>Collection</h2>
          {signedIn && (
            <button type="button" className="clay-upload" aria-label="Upload a figure" title="Upload a figure"
              onClick={() => filePicker.current?.click()}>
              <i className="pi pi-upload" aria-hidden="true" />
            </button>
          )}
          {signedIn && <input hidden ref={filePicker} type="file" aria-label="Choose a GLB model"
            accept=".glb,model/gltf-binary" onChange={chooseFile} />}
        </div>
        {localPreview && params.get('preview') === 'local' && (
          <div className="clay-rail__preview">
            <label className="clay-file">
              <i className="pi pi-upload" aria-hidden="true" />
              <span>Preview a local GLB</span>
              <input type="file" accept=".glb,model/gltf-binary" onChange={chooseFile} />
            </label>
          </div>
        )}
        {fileError && <p role="alert">{fileError}</p>}
        {error && <StatusState type="error" title="The gallery could not load" message={error} />}
        {featureError && <p role="alert">{featureError}</p>}
        {!error && figures === null && <PageLoader compact label="Loading clay figure gallery" />}
        <div className="clay-rail__grid">
          {previews.map((draft) => {
            const { id, name, thumbnail, saving, saveError, needsSignIn } = draft;
            return (
            <article className={`clay-preview-card${featuredPreviewId === id ? ' clay-preview-card--featured' : ''}`} key={id}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setMenuId(null);
                  event.currentTarget.querySelector('.clay-preview-card__more').focus();
                }
              }}>
              <div className="clay-preview-card__body">
              <button className="clay-preview-card__select" type="button" aria-pressed={previewId === id}
                onClick={() => { activeUpload.current = saving ? id : null; setPreviewId(id); setMenuId(null); }}>
                <span className="clay-preview-card__image">
                  {thumbnail ? <img src={thumbnail} alt="" /> : <i className="pi pi-box" aria-hidden="true" />}
                </span>
                <span className="clay-preview-card__name" title={name}>{name}</span>
              </button>
              {signedIn && <button className="clay-preview-card__star" type="button" title="Feature model"
                aria-label={`Feature model: ${name}`} aria-pressed={featuredPreviewId === id}
                onClick={() => { setFeaturedPreviewId(id); setPreviewId(id); }}>
                <i className={`pi ${featuredPreviewId === id ? 'pi-star-fill' : 'pi-star'}`} aria-hidden="true" />
              </button>}
              <button className="clay-preview-card__more" type="button" aria-label={`Options for ${name}`}
                disabled={saving}
                aria-expanded={menuId === id} onClick={() => setMenuId(menuId === id ? null : id)}>
                <i className="pi pi-ellipsis-h" aria-hidden="true" />
              </button>
              </div>
              {saving && <p className="clay-card-save-status" role="status">Saving…</p>}
              {saveError && <p className="clay-card-save-status" role="alert">Not saved. {saveError} Use Edit to retry.</p>}
              {needsSignIn && <div className="clay-card-save-status">
                <span>Upload paused. </span>
                <button type="button" onClick={() => persistPreview(draft)}>
                  {signedIn ? 'Retry upload' : 'Sign in to resume'}
                </button>
              </div>}
              {menuId === id && <div className="clay-preview-card__actions">
                <button type="button" onClick={() => { setEditId(id); setMenuId(null); }}>
                  <i className="pi pi-pencil" aria-hidden="true" /> Edit
                </button>
                <button type="button" onClick={() => deletePreview(id)}>
                  <i className="pi pi-trash" aria-hidden="true" /> Delete
                </button>
              </div>}
            </article>
          );
          })}
          {figures?.map((item) => (
            <article className={`clay-preview-card${item.featured && !featuredPreviewId ? ' clay-preview-card--featured' : ''}`} key={item.id}>
            <button className="clay-preview-card__select" type="button" aria-pressed={!preview && figure?.id === item.id}
              onClick={() => {
                activeUpload.current = null;
                setParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.set('figure', item.id);
                  return next;
                }, { replace: true });
                setPreviewId(null);
                setUploadedId(null);
                setMenuId(null);
              }}>
              <span className="clay-preview-card__image">
                {item.assets?.some(({ asset_type }) => asset_type === 'gallery_poster')
                  ? <img className="clay-saved-poster" src={`${figureAssetUrl(item.id, 'gallery_poster')}?v=${encodeURIComponent(item.updated_at ?? '')}`} alt="" loading="lazy" />
                  : <i className="pi pi-box" aria-hidden="true" />}
              </span>
              <span className="clay-preview-card__name" title={item.character_name}>{item.character_name}</span>
            </button>
            {editableFigureIds.includes(item.id) && <button className="clay-preview-card__more" type="button"
              title="Edit figure" aria-label={`Edit ${item.character_name}`} onClick={() => setSavedEditId(item.id)}>
              <i className="pi pi-pencil" aria-hidden="true" />
            </button>}
            {((canFeature && editableFigureIds.includes(item.id)) || item.featured) && <button className="clay-preview-card__star" type="button" title="Feature model"
              aria-label={`Feature model: ${item.character_name}`} aria-pressed={Boolean(item.featured && !featuredPreviewId)}
              disabled={!canFeature || featurePending || item.featured}
              onClick={() => featureSaved(item)}>
              <i className={`pi ${item.featured && !featuredPreviewId ? 'pi-star-fill' : 'pi-star'}`} aria-hidden="true" />
            </button>}
            </article>
          ))}
        </div>
      </aside>
      {editing && <UploadWorkspace figure={editing} signedIn={signedIn}
        onClose={() => setEditId(null)} onEdit={saveEdit} onSaved={figureSaved} onReauthenticate={requestSignIn} />}
      {savedEditing && <UploadWorkspace persisted figure={{
        id: savedEditing.id, name: savedEditing.character_name, madeOn: savedEditing.made_on ?? '',
        description: savedEditing.description ?? '',
      }} onClose={() => setSavedEditId(null)} onSaved={figureSaved} onReauthenticate={requestSignIn} />}
    </section>
  );
}
