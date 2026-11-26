import { useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { AppActionGroup, AppButton, AppField, AppFormDialog } from '../../components/authenticated-ui/AuthenticatedUi';
import StatusState from '../../components/StatusState';
import { saveFigure, updateFigure } from '../../domains/clay_gallery/galleryApi';
import { isUnauthorizedError, UnauthorizedError } from '../../services/api';
import { getAuthToken } from '../../services/auth';

export default function UploadWorkspace({ figure, signedIn, persisted = false, onClose, onEdit, onSaved, onReauthenticate, onGenerateThumbnail }) {
  const [busy, setBusy] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState('');

  async function generateThumbnail() {
    setError('');
    setCapturing(true);
    try {
      await onGenerateThumbnail();
    } catch (err) {
      setError(err.message || 'Could not generate a thumbnail.');
    } finally {
      setCapturing(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get('character_name').trim();
    if (!name) {
      setError('Enter a figure name.');
      return;
    }
    const selectedPoster = form.get('poster');
    const poster = selectedPoster?.name ? selectedPoster : figure.poster;
    if ((poster?.size ?? 0) > 5 * 1024 * 1024) {
      setError('The photo can be up to 5 MB.');
      return;
    }
    if (!persisted && event.nativeEvent.submitter?.value !== 'publish') {
      onEdit({ name, madeOn: form.get('made_on'), description: form.get('description').trim(), poster });
      return;
    }
    if (!persisted) form.set('model', figure.file);
    form.set('character_name', name);
    if (poster) form.set('poster', poster);
    else form.delete('poster');
    persist(form);
  }

  async function persist(form, promptOnExpiry = true) {
    const token = getAuthToken();
    setError('');
    setBusy(true);
    let id = figure.id;
    try {
      if (!token) throw new UnauthorizedError();
      if (persisted) await updateFigure(id, form);
      else ({ id } = await saveFigure(form));
    } catch (err) {
      setBusy(false);
      if (isUnauthorizedError(err)) {
        setError('Sign in again to save your changes.');
        if (promptOnExpiry && !getAuthToken()) {
          onReauthenticate(() => persist(form, false));
        }
      } else {
        setError(err.message);
      }
      return;
    }
    onSaved(id);
  }

  return (
    <AppFormDialog title="Edit figure" appearance="charcoal" visible modal
      closable={!busy} closeOnEscape={!busy} onHide={onClose}>
      <form className="app-charcoal-form" onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy}>
            <AppField label="Name" htmlFor="figure-name">
              <InputText id="figure-name" name="character_name" required maxLength={150} defaultValue={figure.name} />
            </AppField>
            <AppField label="Date made" htmlFor="figure-date" optional>
              <InputText id="figure-date" name="made_on" type="date" defaultValue={figure.madeOn} />
            </AppField>
            <AppField label="Description" htmlFor="figure-description" optional>
              <InputTextarea id="figure-description" name="description" rows={3} maxLength={2000} defaultValue={figure.description} />
            </AppField>
            <AppField label="Gallery photo (PNG or JPEG, up to 5 MB)" htmlFor="figure-poster" optional>
              <input id="figure-poster" name="poster" type="file" accept="image/png,image/jpeg" />
              {figure.poster && <small>Current photo: {figure.poster.name}</small>}
            </AppField>
            {onGenerateThumbnail && <AppButton type="button" variant="text" label="Generate thumbnail"
              icon="pi pi-image" onClick={generateThumbnail} loading={capturing} disabled={capturing} />}
          </fieldset>
          {error && <div role="alert"><StatusState type="error" title="Figure could not be saved" message={error} /></div>}
          <AppActionGroup>
            <AppButton type="button" variant="text" label="Cancel" onClick={onClose} disabled={busy} />
            {!persisted && <AppButton type="submit" value="edit" size="standard" label="Save edits" disabled={busy} variant={signedIn ? 'text' : 'primary'} />}
            {persisted && <AppButton type="submit" size="standard" label="Save edits" loading={busy} disabled={busy} />}
            {signedIn && !persisted && <AppButton type="submit" value="publish" size="standard" label="Save to gallery"
              icon="pi pi-upload" loading={busy} disabled={busy} />}
          </AppActionGroup>
      </form>
    </AppFormDialog>
  );
}
