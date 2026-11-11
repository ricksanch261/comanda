/**
 * Store: unica fonte di verità, in memoria, con pub/sub.
 * Le mutazioni passano solo da azioni nominate (vedi actions.js), che
 * lavorano su una copia dei dati: se un'azione lancia un errore lo stato
 * resta invariato.
 */
export function createStore({ data, repository, actions, debounceMs = 300, onSaveError } = {}) {
  let state = data;
  const listeners = new Set();
  let saveTimer = null;
  let pendingSave = false;

  function notify(action) {
    for (const fn of [...listeners]) {
      try {
        fn(state, action);
      } catch (e) {
        console.error('Errore in un listener dello store', e);
      }
    }
  }

  async function flush() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    if (!pendingSave || !repository) return;
    pendingSave = false;
    try {
      await repository.save(state);
    } catch (e) {
      if (onSaveError) onSaveError(e);
      else console.error(e);
    }
  }

  function scheduleSave() {
    pendingSave = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, debounceMs);
  }

  function dispatch(name, payload) {
    const action = actions?.[name];
    if (typeof action !== 'function') throw new Error(`Azione sconosciuta: ${name}`);
    const draft = structuredClone(state);
    const result = action(draft, payload);
    state = draft;
    scheduleSave();
    notify(name);
    return result;
  }

  const boundActions = new Proxy(
    {},
    { get: (_, name) => (payload) => dispatch(name, payload) },
  );

  return {
    getState: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    dispatch,
    actions: boundActions,
    /** Sostituisce l'intero stato (import, reset). */
    replace(next, name = 'replace') {
      state = next;
      scheduleSave();
      notify(name);
    },
    flush,
  };
}
