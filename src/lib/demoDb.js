/**
 * demoDb.js — localStorage-backed Firestore API mock.
 *
 * Used when VITE_FIREBASE_API_KEY is not set (GitHub Pages / offline demo).
 * Mirrors every firebase/firestore export consumed by this app so no view
 * files need to change — Vite aliases firebase/firestore to this file.
 *
 * Storage format:
 *   localStorage['dkDemo_v1'] = JSON {
 *     [collectionPath]: { [docId]: serializedData }
 *   }
 *
 * Timestamps are tagged as { __ts: isoString } before storage so they
 * survive JSON serialization and are restored with a .toDate() shim on read.
 */

const STORE_KEY = 'dkDemo_v1';
let _seq = 0;

// ── Storage ──────────────────────────────────────────────────────────────────

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
  catch { return {}; }
}

function save(store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
  catch (e) { console.warn('[demoDb] localStorage write failed', e); }
}

// ── ID generation ─────────────────────────────────────────────────────────────

function genId() {
  return `${Date.now().toString(36)}${(++_seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ── Value serialization / deserialization ─────────────────────────────────────
// Timestamps → { __ts: isoString }  (survives JSON.stringify / JSON.parse)
// On read, { __ts } → Timestamp-like object with .toDate()

function makeTimestamp(iso) {
  const d = new Date(iso);
  return {
    __ts: iso,
    toDate:    () => d,
    toMillis:  () => d.getTime(),
    seconds:   Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
  };
}

function serializeValue(v) {
  if (v == null) return v;
  if (v instanceof Date) return { __ts: v.toISOString() };
  // Re-serialize already-tagged timestamps (e.g. read back then re-written)
  if (v && typeof v === 'object' && typeof v.__ts === 'string') return { __ts: v.__ts };
  return v;
}

function serializeData(data) {
  if (data == null || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(serializeValue);
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v == null) { out[k] = v; continue; }
    const isSpecial =
      typeof v === 'object' &&
      (v.__ts != null || v.__increment != null || v.__arrayUnion != null || v.__arrayRemove != null);
    if (!isSpecial && !(v instanceof Date) && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = serializeData(v);   // recurse into plain objects
    } else {
      out[k] = serializeValue(v);
    }
  }
  return out;
}

function deserializeValue(v) {
  if (v && typeof v === 'object' && typeof v.__ts === 'string') return makeTimestamp(v.__ts);
  return v;
}

function deserializeData(data) {
  if (data == null || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(deserializeValue);
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && v.__ts == null) {
      out[k] = deserializeData(v);
    } else {
      out[k] = deserializeValue(v);
    }
  }
  return out;
}

// ── Pub / Sub ─────────────────────────────────────────────────────────────────
// Each entry: { fn: callback, queryRef: ref | null }

const _subs = new Map(); // Map<colPath, Set<entry>>

function addSub(colPath, fn, queryRef) {
  if (!_subs.has(colPath)) _subs.set(colPath, new Set());
  const entry = { fn, queryRef };
  _subs.get(colPath).add(entry);
  return () => _subs.get(colPath)?.delete(entry);
}

function fireCol(colPath) {
  const subs = _subs.get(colPath);
  if (!subs?.size) return;
  const store = load();
  const raw = store[colPath] || {};
  const allDocs = Object.entries(raw).map(([id, d]) => makeDocSnap(id, deserializeData(d)));
  subs.forEach(({ fn, queryRef }) => {
    const docs = queryRef ? applyConstraints([...allDocs], queryRef) : allDocs;
    fn(makeCollSnap(docs));
  });
}

// ── Snapshot shape helpers ────────────────────────────────────────────────────

function makeDocSnap(id, data) {
  return { id, exists: () => true, data: () => data, get: f => data[f] };
}

function makeCollSnap(docs) {
  return { docs, empty: docs.length === 0, size: docs.length, forEach: fn => docs.forEach(fn) };
}

// ── Query constraint application ──────────────────────────────────────────────

function getFieldVal(data, field) {
  const v = data[field];
  return (v && typeof v.toDate === 'function') ? v.toDate() : v;
}

function cmpVals(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  return 0;
}

function applyConstraints(docs, ref) {
  const wheres = ref.__wheres || [];
  const orders = ref.__orders || [];

  if (wheres.length) {
    docs = docs.filter(d => {
      const data = d.data();
      return wheres.every(w => {
        const v = getFieldVal(data, w.field);
        switch (w.op) {
          case '==': return v === w.value;
          case '!=': return v !== w.value;
          case '>':  return cmpVals(v, w.value) > 0;
          case '>=': return cmpVals(v, w.value) >= 0;
          case '<':  return cmpVals(v, w.value) < 0;
          case '<=': return cmpVals(v, w.value) <= 0;
          case 'in': return Array.isArray(w.value) && w.value.includes(v);
          case 'array-contains': return Array.isArray(v) && v.includes(w.value);
          default: return true;
        }
      });
    });
  }

  if (orders.length) {
    docs.sort((a, b) => {
      for (const ob of orders) {
        const d = cmpVals(getFieldVal(a.data(), ob.field), getFieldVal(b.data(), ob.field));
        if (d !== 0) return ob.dir === 'desc' ? -d : d;
      }
      return 0;
    });
  }

  return docs;
}

// ── Special field-level write values ─────────────────────────────────────────
// increment() / arrayUnion() / arrayRemove() resolved before serialization

function applySpecials(existing, incoming) {
  const out = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (v?.__increment != null) {
      out[k] = (Number(out[k]) || 0) + v.__increment;
    } else if (v?.__arrayUnion) {
      out[k] = [...new Set([...(Array.isArray(out[k]) ? out[k] : []), ...v.__arrayUnion])];
    } else if (v?.__arrayRemove) {
      out[k] = (Array.isArray(out[k]) ? out[k] : []).filter(x => !v.__arrayRemove.includes(x));
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ── Exported API (mirrors firebase/firestore) ─────────────────────────────────

export const getFirestore = () => ({});

// Reference builders
export function collection(dbOrRef, ...args) {
  const base = dbOrRef?.__path ?? '';
  const rel  = args.join('/').split('/').filter(Boolean).join('/');
  const path = base ? `${base}/${rel}` : rel;
  return { __type: 'collection', __path: path, id: path.split('/').pop() };
}

export function doc(dbOrRef, ...args) {
  const base  = dbOrRef?.__path ?? '';
  const parts = args.join('/').split('/').filter(Boolean);
  if (!parts.length) parts.push(genId());
  const rel  = parts.join('/');
  const path = base ? `${base}/${rel}` : rel;
  const segs = path.split('/');
  return { __type: 'doc', __path: path, __colPath: segs.slice(0, -1).join('/'), id: segs.at(-1) };
}

export function query(collRef, ...constraints) {
  return {
    ...collRef,
    __type:   'query',
    __wheres: constraints.filter(c => c?.__type === 'where'),
    __orders: constraints.filter(c => c?.__type === 'orderBy'),
  };
}

export function where(field, op, value)     { return { __type: 'where',   field, op, value }; }
export function orderBy(field, dir = 'asc') { return { __type: 'orderBy', field, dir }; }

// Sentinel values
export function serverTimestamp() { return { __ts: new Date().toISOString() }; }
export function increment(n)      { return { __increment: n }; }
export function arrayUnion(...items)  { return { __arrayUnion: items }; }
export function arrayRemove(...items) { return { __arrayRemove: items }; }

export class Timestamp {
  constructor(seconds, nanoseconds = 0) {
    this.seconds     = seconds;
    this.nanoseconds = nanoseconds;
  }
  toDate()   { return new Date(this.seconds * 1000); }
  toMillis() { return this.seconds * 1000; }
  static now()                { return Timestamp.fromDate(new Date()); }
  static fromDate(d)          { return new Timestamp(Math.floor(d.getTime() / 1000)); }
  static fromMillis(ms)       { return new Timestamp(Math.floor(ms / 1000)); }
}

// CRUD operations
export async function addDoc(collRef, data) {
  const id      = genId();
  const store   = load();
  const colPath = collRef.__path;
  if (!store[colPath]) store[colPath] = {};
  store[colPath][id] = serializeData(data);
  save(store);
  setTimeout(() => fireCol(colPath), 0);
  return { id };
}

export async function setDoc(docRef, data, opts = {}) {
  const store            = load();
  const { __colPath: colPath, id } = docRef;
  if (!store[colPath]) store[colPath] = {};
  const base = opts.merge ? (store[colPath][id] || {}) : {};
  store[colPath][id] = serializeData({ ...base, ...data });
  save(store);
  setTimeout(() => fireCol(colPath), 0);
}

export async function updateDoc(docRef, data) {
  const store                      = load();
  const { __colPath: colPath, id } = docRef;
  if (!store[colPath]) store[colPath] = {};
  const existing = deserializeData(store[colPath][id] || {});
  store[colPath][id] = serializeData(applySpecials(existing, data));
  save(store);
  setTimeout(() => fireCol(colPath), 0);
}

export async function deleteDoc(docRef) {
  const store                      = load();
  const { __colPath: colPath, id } = docRef;
  if (store[colPath]) delete store[colPath][id];
  save(store);
  setTimeout(() => fireCol(colPath), 0);
}

export async function getDoc(docRef) {
  const store                      = load();
  const { __colPath: colPath, id } = docRef;
  const raw = store[colPath]?.[id];
  if (!raw) return { id, exists: () => false, data: () => undefined };
  return makeDocSnap(id, deserializeData(raw));
}

export async function getDocs(queryOrRef) {
  const store   = load();
  const colPath = queryOrRef.__path;
  const colData = store[colPath] || {};
  let docs = Object.entries(colData).map(([id, d]) => makeDocSnap(id, deserializeData(d)));
  docs = applyConstraints(docs, queryOrRef);
  return makeCollSnap(docs);
}

export function onSnapshot(ref, onNext, _onError) {
  const callback = typeof onNext === 'function' ? onNext : _onError;
  const colPath  = ref.__path;
  const hasConstraints = ref.__wheres?.length || ref.__orders?.length;
  const unsub = addSub(colPath, callback, hasConstraints ? ref : null);

  // Fire immediately with current data
  const store = load();
  const raw   = store[colPath] || {};
  let docs = Object.entries(raw).map(([id, d]) => makeDocSnap(id, deserializeData(d)));
  if (hasConstraints) docs = applyConstraints(docs, ref);
  callback(makeCollSnap(docs));

  return unsub;
}
