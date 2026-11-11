/**
 * Contesto applicativo condiviso dalle view (popolato da main.js all'avvio).
 */
import { toastError } from './components/toast.js';

export const app = {
  /** @type {ReturnType<import('./state/store.js').createStore>} */
  store: null,
  router: null,
  repository: null,
  rerender: () => {},

  get data() {
    return this.store.getState();
  },

  navigate(path, opts) {
    this.router.navigate(path, opts);
  },

  /**
   * Esegue un'azione dello store mostrando un toast in caso di errore.
   * @returns {{ ok: boolean, result?: any, error?: Error }}
   */
  act(name, payload) {
    try {
      return { ok: true, result: this.store.dispatch(name, payload) };
    } catch (error) {
      toastError(error);
      return { ok: false, error };
    }
  },
};
