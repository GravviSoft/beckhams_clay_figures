import { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import UploadWorkspace from '../../workspaces/upload/UploadWorkspace';
import PageLoader from '../../components/PageLoader';
import StatusState from '../../components/StatusState';
import { isUnauthorizedError, UnauthorizedError } from '../../services/api';
import { getAuthToken } from '../../services/auth';
import { featureFigure, figureAssetUrl, listFigures, saveFigure, saveModelThumbnail } from './galleryApi';
import { modelThumbnail } from './modelThumbnail';
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

function ModelPreview({ file, source, title, poster, captureThumbnail, onReady }) {
  const [url, setUrl] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [orbit, setOrbit] = useState(null);
  const viewerRef = useRef(null);
  const originalView = useRef(null);

  useEffect(() => {
    if (loaded || error) return undefined;
    const timeout = window.setTimeout(() => {
      setError('The model stopped loading. You can retry the download.');
    }, 90000);
    return () => window.clearTimeout(timeout);
  }, [attempt, error, loaded, progress]);

  useEffect(() => {
    const element = viewerRef.current;
    if (!url || !element) return undefined;
    const reportProgress = ({ detail }) => {
      if (Number.isFinite(detail?.totalProgress)) {
        setProgress(Math.min(100, Math.max(0, Math.floor(detail.totalProgress * 100))));
      }
    };
    element.addEventListener('progress', reportProgress);
    return () => element.removeEventListener('progress', reportProgress);
  }, [url]);

  useEffect(() => {
    const element = viewerRef.current;
    if (!loaded || !element) return undefined;
    const trackCamera = () => setOrbit(element.getCameraOrbit());
    element.addEventListener('camera-change', trackCamera);
    return () => element.removeEventListener('camera-change', trackCamera);
  }, [loaded]);

  useEffect(() => {
    let active = true;
    let objectUrl = file ? URL.createObjectURL(file) : source;
    if (!file && attempt) {
      const retryUrl = new URL(source, window.location.href);
      retryUrl.searchParams.set('retry', String(attempt));
      objectUrl = retryUrl.href;
    }
    loadViewer().then(() => {
      if (active) setUrl(objectUrl);
    }).catch(() => {
      if (active) setError('Check your connection and try opening the figure again.');
    });
    return () => {
      active = false;
      if (file) URL.revokeObjectURL(objectUrl);
    };
  }, [file, source, attempt]);

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
      onReady?.(element);
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

  if (error) return (
    <div className="clay-stage__load-error">
      {poster && <img className="clay-stage__fallback" src={poster} alt={title} />}
      <StatusState type="error" title="The 3D preview could not load" message={error} />
      <button type="button" onClick={() => {
        setUrl('');
        setProgress(null);
        setLoaded(false);
        setOrbit(null);
        setError('');
        setAttempt((value) => value + 1);
      }}>Retry model</button>
    </div>
  );
  return (
    <>
      <div className="clay-model-viewport">
        {!loaded && poster && <img className="clay-stage__poster" src={poster} alt={title} />}
        {url && (
          <model-viewer ref={bindViewer} src={url} alt={title || file?.name}
            loading="eager" camera-controls touch-action="pan-y" min-field-of-view="15deg" shadow-intensity="0.8" />
        )}
        {!loaded && (
          <div className={poster ? 'clay-stage__loading clay-stage__loading--with-poster' : 'clay-stage__loading'}>
            {progress > 0 && progress < 100 ? (
              <>
                <p>Loading model… {progress}%</p>
                <progress aria-label="Loading 3D preview" max="100" value={progress} />
              </>
            ) : (
              <>
                <PageLoader compact label="Loading 3D preview" />
                <p>{progress === 100 ? 'Preparing model…' : 'Loading model…'}</p>
              </>
            )}
          </div>
        )}
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
  const [thumbnailViewer, setThumbnailViewer] = useState(null);
  const thumbnailAttempts = useRef(new Set());
  const thumbnailInFlight = useRef(new Set());
  const localThumbnails = useRef(new Map());
  const [featuredPreviewId, setFeaturedPreviewId] = useState(null);
  const [featurePending, setFeaturePending] = useState(false);
  const [featureError, setFeatureError] = useState('');
  const nextPreviewId = useRef(0);
  const activeUpload = useRef(null);
  const preview = previews.find(({ id }) => id === previewId);
  const [fileError, setFileError] = useState('');
  const figure = figures?.find(({ id }) => String(id) === (uploadedId ?? params.get('figure'))) ?? figures?.[0];
  const webAsset = figure?.assets?.find(({ asset_type }) => asset_type === 'web_model');
  const modelAsset = webAsset ?? figure?.assets?.find(({ asset_type }) => asset_type === 'display_model');
  const hasModel = Boolean(modelAsset);
  const posterAsset = figure?.assets?.find(({ asset_type }) => asset_type === 'gallery_poster')
    ?? figure?.assets?.find(({ asset_type }) => asset_type === 'model_thumbnail');
  const stagePoster = posterAsset
    ? `${figureAssetUrl(figure.id, posterAsset.asset_type)}?v=${encodeURIComponent(figure.updated_at ?? '')}` : undefined;
  const madeOn = preview ? preview.madeOn : figure?.made_on;
  const visibleFigureId = !preview && hasModel ? figure.id : null;
  const canGenerateThumbnail = editableFigureIds.includes(visibleFigureId)
    && !figure?.assets?.some(({ asset_type }) => ['gallery_poster', 'model_thumbnail'].includes(asset_type));

  const persistThumbnail = useCallback(async (id, capture) => {
    if (thumbnailInFlight.current.has(id)) return;
    thumbnailInFlight.current.add(id);
    try {
      const image = await capture();
      if (!image) return;
      await saveModelThumbnail(id, image);
      setFigures((items) => items?.map((item) => item.id === id
        && !item.assets.some(({ asset_type }) => asset_type === 'model_thumbnail')
        ? { ...item, assets: [...item.assets, { asset_type: 'model_thumbnail' }] } : item));
    } finally {
      thumbnailInFlight.current.delete(id);
    }
  }, []);

  const generateThumbnail = useCallback((id, viewer) => {
    if (!viewer?.isConnected) return Promise.resolve();
    return persistThumbnail(id, () => modelThumbnail(viewer));
  }, [persistThumbnail]);

  function rememberLocalThumbnail(id, viewer) {
    if (signedIn && !localThumbnails.current.has(id)) {
      localThumbnails.current.set(id, modelThumbnail(viewer).catch(() => null));
    }
  }

  function attachLocalThumbnail(draftId, figureId) {
    const image = localThumbnails.current.get(draftId);
    localThumbnails.current.delete(draftId);
    if (image) persistThumbnail(figureId, () => image).catch(() => {
      // The owner can retry from the saved model.
    });
  }

  useEffect(() => {
    if (!canGenerateThumbnail || thumbnailViewer?.id !== visibleFigureId || !thumbnailViewer.element.isConnected
        || thumbnailAttempts.current.has(visibleFigureId)) return;
    thumbnailAttempts.current.add(visibleFigureId);
    generateThumbnail(visibleFigureId, thumbnailViewer.element).catch(() => {
      // Edit exposes a retry if capture or storage is unavailable.
    });
  }, [canGenerateThumbnail, generateThumbnail, thumbnailViewer, visibleFigureId]);

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
      const { id } = await saveFigure(form, (progress) => {
        setPreviews((items) => items.map((item) => item.id === draft.id ? { ...item, progress } : item));
      });
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
      if (draft.poster) localThumbnails.current.delete(draft.id);
      else attachLocalThumbnail(draft.id, id);
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
    localThumbnails.current.delete(id);
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
    const capture = localThumbnails.current.get(editId);
    if (editId !== null) deletePreview(editId);
    setEditId(null);
    setSavedEditId(null);
    setPreviewId(null);
    setUploadedId(String(id));
    setError('');
    try {
      setFigures(await listFigures());
      if (capture) await persistThumbnail(id, () => capture).catch(() => {});
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
          <div className="clay-stage__title">
            <h1>{preview?.name || figure?.character_name || 'Beck’s clay collection'}</h1>
            {madeOn && <time className="clay-stage__date" dateTime={madeOn}>{madeOn}</time>}
          </div>
        </header>
        <div className="clay-stage__view">
          {preview ? <ModelPreview key={preview.id} file={preview.file}
            onReady={(element) => rememberLocalThumbnail(preview.id, element)}
            captureThumbnail={preview.thumbnail ? undefined : (thumbnail) => {
              setPreviews((items) => items.map((item) => item.id === preview.id
                ? { ...item, thumbnail } : item));
            }} /> : hasModel ? (
              <ModelPreview key={`saved-${figure.id}-${modelAsset.asset_type}`} title={figure.character_name}
                source={figureAssetUrl(figure.id, modelAsset.asset_type)} poster={stagePoster}
                onReady={(element) => setThumbnailViewer({ id: figure.id, element })} />
            ) : stagePoster ? (
              <img className="clay-stage__fallback" src={stagePoster} alt={figure.character_name} />
            ) : (
            <p>{figure ? '3D preview unavailable for this figure.' : 'Select a figure to explore it.'}</p>
          )}
        </div>
        <div>
          {(preview || hasModel) && (
            <p className="clay-stage__gesture-hint">Drag to rotate · Scroll or pinch to zoom</p>
          )}
          {(preview ? preview.description : figure?.description) && (
            <p className="clay-stage__caption">{preview ? preview.description : figure.description}</p>
          )}
        </div>
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
            const { id, name, thumbnail, saving, saveError, needsSignIn, progress } = draft;
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
              {saving && <div className="clay-card-save-status">
                <p role="status">{typeof progress === 'number'
                  ? progress < 100 ? `Uploading… ${progress}%` : 'Verifying upload…'
                  : 'Saving…'}</p>
                {typeof progress === 'number' && <progress aria-label={`Upload progress for ${name}`} value={progress} max="100" />}
              </div>}
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
          {figures?.map((item) => {
            const canEdit = editableFigureIds.includes(item.id);
            const savedMenuId = `saved-${item.id}`;
            const menuOpen = menuId === savedMenuId;
            const thumbnailType = item.assets?.some(({ asset_type }) => asset_type === 'gallery_poster')
              ? 'gallery_poster'
              : item.assets?.some(({ asset_type }) => asset_type === 'model_thumbnail') ? 'model_thumbnail' : null;
            return (
            <article className={`clay-preview-card${item.featured && !featuredPreviewId ? ' clay-preview-card--featured' : ''}`} key={item.id}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && menuOpen) {
                  setMenuId(null);
                  event.currentTarget.querySelector('.clay-preview-card__more')?.focus();
                }
              }}>
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
                {thumbnailType
                  ? <img className="clay-saved-poster" src={`${figureAssetUrl(item.id, thumbnailType)}?v=${encodeURIComponent(item.updated_at ?? '')}`} alt="" loading="lazy" />
                  : <i className="pi pi-box" aria-hidden="true" />}
              </span>
              <span className="clay-preview-card__name" title={item.character_name}>{item.character_name}</span>
            </button>
            {canEdit && (
              <>
                <button className="clay-preview-card__more" type="button" title="Figure options"
                  aria-label={`Options for ${item.character_name}`} aria-expanded={menuOpen}
                  onClick={() => setMenuId(menuOpen ? null : savedMenuId)}>
                  <i className="pi pi-ellipsis-h" aria-hidden="true" />
                </button>
                {menuOpen && <div className="clay-preview-card__actions">
                  <button type="button" aria-label={`Edit ${item.character_name}`} onClick={() => {
                    activeUpload.current = null;
                    setPreviewId(null);
                    setUploadedId(String(item.id));
                    setSavedEditId(item.id);
                    setMenuId(null);
                  }}>
                    <i className="pi pi-pencil" aria-hidden="true" /> Edit
                  </button>
                </div>}
              </>
            )}
            {(canEdit || item.featured) && <button className="clay-preview-card__star" type="button" title="Feature model"
              aria-label={`Feature model: ${item.character_name}`} aria-pressed={Boolean(item.featured && !featuredPreviewId)}
              disabled={!canFeature || !canEdit || featurePending || item.featured}
              onClick={() => featureSaved(item)}>
              <i className={`pi ${item.featured && !featuredPreviewId ? 'pi-star-fill' : 'pi-star'}`} aria-hidden="true" />
            </button>}
            </article>
          );
          })}
        </div>
      </aside>
      {editing && <UploadWorkspace figure={editing} signedIn={signedIn}
        onClose={() => setEditId(null)} onEdit={saveEdit} onSaved={figureSaved} onReauthenticate={requestSignIn} />}
      {savedEditing && <UploadWorkspace persisted figure={{
        id: savedEditing.id, name: savedEditing.character_name, madeOn: savedEditing.made_on ?? '',
        description: savedEditing.description ?? '',
      }} onClose={() => setSavedEditId(null)} onSaved={figureSaved} onReauthenticate={requestSignIn}
        onGenerateThumbnail={canGenerateThumbnail && savedEditing.id === thumbnailViewer?.id
          ? () => generateThumbnail(savedEditing.id, thumbnailViewer.element) : undefined} />}
    </section>
  );
}
