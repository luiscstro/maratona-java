// Armazenamento local (IndexedDB). Tudo fica no aparelho, nada é enviado para fora.
const DB_NAME = 'fotos-pwa';
const DB_VERSION = 1;
const STORES = ['items', 'thumbs', 'files'];
let dbp;

const wrap = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: 'id' });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbp;
}

export const db = {
  async allItems() {
    const d = await open();
    return wrap(d.transaction('items').objectStore('items').getAll());
  },
  async putItem(item) {
    const d = await open();
    const tx = d.transaction('items', 'readwrite');
    tx.objectStore('items').put(item);
    return done(tx);
  },
  async putItems(items) {
    const d = await open();
    const tx = d.transaction('items', 'readwrite');
    items.forEach((i) => tx.objectStore('items').put(i));
    return done(tx);
  },
  async addNew(item, thumb, file) {
    const d = await open();
    const tx = d.transaction(STORES, 'readwrite');
    tx.objectStore('items').put(item);
    tx.objectStore('thumbs').put({ id: item.id, blob: thumb });
    tx.objectStore('files').put({ id: item.id, blob: file });
    return done(tx);
  },
  async getThumb(id) {
    const d = await open();
    const r = await wrap(d.transaction('thumbs').objectStore('thumbs').get(id));
    return r && r.blob;
  },
  async getFile(id) {
    const d = await open();
    const r = await wrap(d.transaction('files').objectStore('files').get(id));
    return r && r.blob;
  },
  async remove(id) {
    const d = await open();
    const tx = d.transaction(STORES, 'readwrite');
    STORES.forEach((s) => tx.objectStore(s).delete(id));
    return done(tx);
  },
};
