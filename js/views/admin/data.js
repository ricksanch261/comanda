/**
 * Dati (schermata 14): export, import, archiviazione, dati di esempio, reset.
 */
import { h, icon } from '../../utils/dom.js';
import { app } from '../../app.js';
import { appBar, screen, field } from '../../components/layout.js';
import { openDialog, confirmDialog } from '../../components/dialog.js';
import { toast, toastError } from '../../components/toast.js';
import { parseBackup, serializeBackup, ImportError } from '../../state/repository.js';
import { createEmptyData } from '../../domain/models.js';
import { sessionsClosedBefore } from '../../domain/reports.js';
import { buildDemoData } from '../../state/demo.js';
import { lockAdmin } from '../../state/auth.js';
import { downloadText } from '../../utils/dom.js';
import { formatDate, formatTime, isoDay, plural } from '../../utils/format.js';

const DAY = 86400000;

export function exportBackup() {
  const at = new Date();
  app.act('markBackup', { at: at.toISOString() });
  downloadText(`gestione-tavoli-backup-${isoDay(at)}.json`, serializeBackup(app.data, at));
  toast('Backup esportato', { icon: 'download' });
}

/** Banner "Backup consigliato" (dashboard admin). */
export function backupBanner() {
  const d = app.data;
  if (!d.tables.length && !d.menuItems.length) return null;
  const last = d.settings.lastBackupAt ? new Date(d.settings.lastBackupAt) : null;
  const days = last ? Math.floor((Date.now() - last.getTime()) / DAY) : null;
  if (last && days < 7) return null;
  return h('div', { class: 'banner banner--warning' }, icon('backup'),
    h('div', { class: 'banner__body' }, h('b', {}, 'Backup consigliato. '),
      last ? `Ultimo export ${days} giorni fa.` : 'Non hai ancora esportato un backup.'),
    h('button', { type: 'button', class: 'btn btn--sm', onClick: exportBackup }, 'Esporta'));
}

/** Banner "Per iniziare" quando il locale è ancora vuoto. */
export function gettingStartedBanner() {
  const d = app.data;
  if (d.areas.length || d.menuItems.length) return null;
  return h('div', { class: 'banner banner--info' }, icon('info'),
    h('div', { class: 'banner__body' }, h('b', {}, 'Per iniziare: '), 'crea le aree e i tavoli, poi il menu. Oppure carica i dati di esempio per provare l’app.'),
    h('a', { class: 'btn btn--sm', href: '#/admin/dati' }, 'Esempio'));
}

function summarize(data) {
  return [
    plural(data.areas.length, 'area', 'aree'),
    plural(data.tables.length, 'tavolo', 'tavoli'),
    plural(data.menuItems.length, 'piatto', 'piatti'),
    plural(data.sessions.length, 'servizio', 'servizi'),
  ].join(' · ');
}

async function replaceAll(data, message) {
  app.store.replace(data, 'import');
  await app.store.flush();
  toast(message);
}

export default function dataView() {
  let fileInput;

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let data;
    try {
      data = parseBackup(await file.text());
    } catch (err) {
      if (err instanceof ImportError) {
        await openDialog({
          title: 'Backup non valido',
          headIcon: 'error',
          body: h('div', { class: 'stack' }, h('p', {}, err.message), err.details?.length ? h('ul', { class: 'text-sm muted' }, err.details.slice(0, 8).map((x) => h('li', {}, x))) : null),
          actions: [{ label: 'Chiudi', variant: 'primary' }],
        });
      } else toastError(err);
      return;
    }
    const ok = await confirmDialog({
      title: 'Sostituire i dati attuali?',
      message: h('div', { class: 'stack' },
        h('p', {}, `Il file “${file.name}” contiene: ${summarize(data)}.`),
        h('p', {}, h('b', {}, 'Tutti i dati attuali di questo dispositivo verranno sostituiti. '), 'Esporta prima un backup se vuoi conservarli.')),
      confirmLabel: 'Importa e sostituisci',
      danger: true,
    });
    if (ok) await replaceAll(data, 'Backup importato');
  }

  async function archive() {
    const before = new Date(Date.now() - 90 * DAY);
    const old = sessionsClosedBefore(app.data.sessions, before);
    if (!old.length) return toast('Nessun servizio chiuso da più di 90 giorni', { icon: 'info' });
    const ok = await confirmDialog({
      title: `Archiviare ${plural(old.length, 'servizio', 'servizi')}?`,
      message: `I servizi chiusi prima del ${formatDate(before.toISOString())} verranno esportati in un file e poi rimossi da questo dispositivo. Non compariranno più nei report.`,
      confirmLabel: 'Esporta e rimuovi',
    });
    if (!ok) return;
    downloadText(`gestione-tavoli-archivio-${isoDay()}.json`, JSON.stringify({ app: 'gestione-tavoli', kind: 'archivio-sessioni', exportedAt: new Date().toISOString(), sessions: old }, null, 2));
    const r = app.act('archiveSessions', { before: before.toISOString() });
    if (r.ok) toast(`Archiviati ${plural(r.result.length, 'servizio', 'servizi')}`, { icon: 'inventory_2' });
  }

  async function demo() {
    const d = app.data;
    const hasData = d.tables.length || d.menuItems.length || d.sessions.length;
    const ok = await confirmDialog({
      title: 'Caricare i dati di esempio?',
      message: hasData ? 'Aree, tavoli, menu e servizi attuali verranno sostituiti da un locale di esempio. Nome, PIN e camerieri restano.' : 'Verranno create due aree con 13 tavoli e un menu con allergeni e varianti.',
      confirmLabel: 'Carica esempio',
      danger: Boolean(hasData),
    });
    if (ok) await replaceAll(buildDemoData(d), 'Dati di esempio caricati');
  }

  async function reset() {
    const name = app.data.settings.restaurantName;
    const first = await confirmDialog({ title: 'Reset completo?', message: 'Verranno cancellati tutti i dati: configurazione, menu, servizi e storico. L’operazione non si può annullare.', confirmLabel: 'Continua', danger: true, icon: 'dangerous' });
    if (!first) return;
    let typed = '';
    const err = h('div', { class: 'field__error', role: 'alert' });
    const ok = await openDialog({
      title: 'Conferma il reset',
      headIcon: 'dangerous',
      body: h('div', { class: 'stack stack--3' },
        h('p', {}, 'Per confermare scrivi il nome del locale: ', h('b', {}, name)),
        field('Nome del locale', h('input', { class: 'input', autocomplete: 'off', autofocus: true, onInput: (e) => (typed = e.target.value) })),
        err),
      actions: [
        { label: 'Annulla', value: false, variant: 'ghost' },
        {
          label: 'Cancella tutto',
          variant: 'danger',
          onClick: () => {
            if (typed.trim() !== name) {
              err.textContent = 'Il nome non coincide.';
              return false;
            }
            return true;
          },
        },
      ],
    });
    if (!ok) return;
    lockAdmin();
    app.store.replace(createEmptyData(), 'reset');
    await app.store.flush();
    toast('Dati cancellati');
    app.navigate('/setup', { replace: true });
  }

  return {
    title: 'Dati',
    render() {
      const d = app.data;
      const last = d.settings.lastBackupAt;
      const old = sessionsClosedBefore(d.sessions, new Date(Date.now() - 90 * DAY)).length;
      fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onChange: onFile });
      const card = (iconName, title, text, action) =>
        h('section', { class: 'card data-card' },
          h('span', { class: 'admin-tile__icon' }, icon(iconName)),
          h('div', { class: 'grow' }, h('h2', { class: 'admin-tile__title' }, title), h('p', { class: 'text-sm muted' }, text)),
          action);
      return screen({
        bar: appBar({ title: 'Dati', back: '/admin' }),
        bodyClass: 'screen__body--narrow',
        body: [
          h('p', { class: 'text-sm muted' }, `Su questo dispositivo: ${summarize(d)}.`),
          card('download', 'Esporta backup', `File .json con configurazione, menu e storico. ${last ? `Ultimo: ${formatDate(last)}, ${formatTime(last)}.` : 'Nessun export finora.'}`,
            h('button', { type: 'button', class: 'btn btn--primary', onClick: exportBackup }, 'Esporta')),
          card('upload', 'Importa backup', 'Sostituisce i dati attuali dopo una conferma.',
            h('button', { type: 'button', class: 'btn', onClick: () => fileInput.click() }, 'Scegli file…')),
          fileInput,
          card('inventory_2', 'Archivia lo storico', `Esporta e rimuove i servizi chiusi da più di 90 giorni (${old}). Utile se lo spazio si esaurisce.`,
            h('button', { type: 'button', class: 'btn', disabled: !old, onClick: archive }, 'Archivia')),
          card('auto_awesome', 'Dati di esempio', 'Un locale di prova con sale, tavoli e menu per esplorare l’app.',
            h('button', { type: 'button', class: 'btn', onClick: demo }, 'Carica')),
          h('section', { class: 'danger-zone' },
            h('div', { class: 'row' }, icon('dangerous', 'danger'), h('h2', { class: 'danger' }, 'Zona pericolo')),
            h('div', { class: 'row row--between row--wrap' },
              h('div', {}, h('div', { class: 'bold' }, 'Reset completo'), h('div', { class: 'text-sm muted' }, 'Cancella tutto. Per confermare scrivi il nome del locale.')),
              h('button', { type: 'button', class: 'btn btn--danger-outline', onClick: reset }, 'Reset…'))),
        ],
      });
    },
  };
}
