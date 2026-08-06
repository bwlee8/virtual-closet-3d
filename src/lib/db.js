// IndexedDB, not localStorage. A closet of 40 garments with front and back
// photos blows past localStorage's ~5MB ceiling immediately. Photos are stored
// as Blobs; nothing leaves the browser.

const DB_NAME = 'virtual-closet'
const VERSION = 1

export const STORES = { garments: 'garments', outfits: 'outfits', settings: 'settings' }

let dbPromise = null

function open() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
  return dbPromise
}

async function tx(store, mode, fn) {
  const db = await open()
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode)
    const req = fn(t.objectStore(store))
    t.oncomplete = () => res(req?.result)
    t.onerror = () => rej(t.error)
    t.onabort = () => rej(t.error)
  })
}

export const getAll = (store) => tx(store, 'readonly', (s) => s.getAll())
export const get = (store, id) => tx(store, 'readonly', (s) => s.get(id))
export const put = (store, value) => tx(store, 'readwrite', (s) => s.put(value))
export const del = (store, id) => tx(store, 'readwrite', (s) => s.delete(id))

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** Export the whole closet as a JSON-friendly object (photos as data URLs). */
export async function exportAll() {
  const [garments, outfits, settings] = await Promise.all([
    getAll(STORES.garments), getAll(STORES.outfits), getAll(STORES.settings),
  ])
  const toDataUrl = (blob) =>
    blob ? new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob) }) : null
  const g = await Promise.all(garments.map(async (x) => ({
    ...x,
    frontBlob: undefined,
    backBlob: undefined,
    front: await toDataUrl(x.frontBlob),
    back: await toDataUrl(x.backBlob),
  })))
  return { version: 1, exportedAt: Date.now(), garments: g, outfits, settings }
}
