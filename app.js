/* =========================================================
   STOCK DIARIO DE DULCE JAZMÍN
   App offline (PWA) – datos en IndexedDB del dispositivo.
   ========================================================= */
'use strict';

const APP_VERSION = '1.0.0';

/* ---------- Estructura fija de la planilla ---------- */

// Columnas numéricas (índice 0..5) en el orden de la planilla en papel.
const COLUMNS = [
  { key: 'si',   pdf: 'STOCK INICIAL TURNO MAÑANA',          app: 'Stock inicial turno mañana',      turno: 'm' },
  { key: 'rm',   pdf: 'REPOSICIÓN (SI HUBO)',                app: 'Reposición (si hubo)',            turno: 'm' },
  { key: 'fm',   pdf: 'STOCK AL FINALIZAR EL TURNO MAÑANA',  app: 'Stock al finalizar turno mañana', turno: 'm' },
  { key: 'pd',   pdf: 'PEDIDO DIARIO',                       app: 'Pedido diario',                   turno: 't' },
  { key: 'rt',   pdf: 'REPOSICIÓN (SI HUBO)',                app: 'Reposición (si hubo)',            turno: 't' },
  { key: 'ft',   pdf: 'STOCK AL FINALIZAR TURNO TARDE',      app: 'Stock al finalizar turno tarde',  turno: 't' }
];
const COL_SI = 0;
const COL_FT = 5;
const MODE_COLS = { full: [0, 1, 2, 3, 4, 5], manana: [0, 1, 2], tarde: [3, 4, 5] };

// Secciones en orden. "totalOf": después de esta sección va una fila TOTAL que suma esas secciones.
const SECTIONS = [
  { id: 'cookies', title: '',                label: 'Cookies' },
  { id: 'flat',    title: 'FLAT',            label: 'Flat',            totalOf: ['cookies', 'flat'] },
  { id: 'cuch',    title: 'CUCHAREABLES',    label: 'Cuchareables',    totalOf: ['cuch'] },
  { id: 'otros',   title: 'OTROS PRODUCTOS', label: 'Otros productos' }
];

const DEFAULT_PRODUCTS = {
  cookies: ['Red Velvet', 'Franui', 'Kitkat', 'Kinder White', 'Kinder Clásico', 'Costa Atlántica',
    'Cheesecake', 'Limón (Lemon Pie del mes)', 'Oreo', 'Crumble de Manzana', 'Ferrero',
    'Pistacho y Frambuesa', 'Dubai', 'Cofler', 'Choco Pistacho'],
  flat: ['Americana', 'Flat Vainilla', 'Flat Red', 'Flat Oreo', 'Flat Chocolate', 'Flat Toffee',
    'Flat Carrot Cake', 'Thin Vainilla'],
  cuch: ['Base de Vainilla', 'Base de Chocolate', 'Base de Red Velvet'],
  otros: ['Brownie', 'Chipa Chico', 'Chipa Grande', 'Cofler C/F']
};

/* ---------- IndexedDB ---------- */

const DB_NAME = 'universo-cookies';
const DB_VERSION = 1;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sheets')) db.createObjectStore('sheets', { keyPath: 'date' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idb(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const os = tx.objectStore(store);
    let result;
    const r = fn(os);
    if (r && 'onsuccess' in r) r.onsuccess = () => { result = r.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const DB = {
  getSheet: (date) => idb('sheets', 'readonly', (os) => os.get(date)),
  putSheet: (sheet) => idb('sheets', 'readwrite', (os) => os.put(sheet)),
  deleteSheet: (date) => idb('sheets', 'readwrite', (os) => os.delete(date)),
  allSheets: () => idb('sheets', 'readonly', (os) => os.getAll()),
  getMeta: async (key) => { const r = await idb('meta', 'readonly', (os) => os.get(key)); return r ? r.value : undefined; },
  putMeta: (key, value) => idb('meta', 'readwrite', (os) => os.put({ key, value }))
};

/* ---------- Utilidades ---------- */

const $ = (sel) => document.querySelector(sel);
const pad = (n) => String(n).padStart(2, '0');

function uid() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function shiftISO(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDate(iso) {           // dd/mm/aaaa
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtWeekday(iso) {
  return parseISO(iso).toLocaleDateString('es-AR', { weekday: 'long' });
}
function dash(n) {                // vacío o 0 -> "–"
  return n ? String(n) : '–';
}
function num(v) {
  return typeof v === 'number' && isFinite(v) ? v : 0;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- Estado ---------- */

const state = {
  products: [],        // [{id, name, section, hidden}] en orden
  date: todayISO(),
  sheet: null,         // planilla abierta o null
  mode: 'full'
};

function defaultProducts() {
  const list = [];
  for (const s of SECTIONS) {
    for (const name of DEFAULT_PRODUCTS[s.id]) list.push({ id: uid(), name, section: s.id, hidden: false });
  }
  return list;
}

async function saveProducts() {
  await DB.putMeta('products', state.products);
}

// Filas que lleva una planilla nueva: los productos visibles de la configuración.
function rowsFromConfig() {
  return state.products.filter((p) => !p.hidden).map((p) => ({ id: p.id, name: p.name, section: p.section }));
}

function rowsSignature(rows) {
  return rows.map((r) => `${r.id}|${r.name}|${r.section}`).join('\n');
}

/* ---------- Cálculo de la planilla ---------- */

// Devuelve la lista de "líneas" a mostrar: secciones, productos y totales, en el orden de la planilla.
function buildLayout(rows) {
  const lines = [];
  for (const s of SECTIONS) {
    if (s.title) lines.push({ type: 'section', title: s.title });
    for (const r of rows.filter((x) => x.section === s.id)) lines.push({ type: 'product', row: r });
    if (s.totalOf) lines.push({ type: 'total', of: s.totalOf });
  }
  return lines;
}

function computeTotal(sheet, sections, col) {
  let t = 0;
  for (const r of sheet.rows) {
    if (!sections.includes(r.section)) continue;
    const v = sheet.values[r.id];
    if (v) t += num(v[col]);
  }
  return t;
}

function getVal(sheet, id, col) {
  const v = sheet.values[id];
  return v && typeof v[col] === 'number' ? v[col] : null;
}

/* ---------- Guardado ---------- */

let saveTimer = null;
function scheduleSave() {
  setSaveStatus('Guardando…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 350);
}
async function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!state.sheet) return;
  state.sheet.updatedAt = Date.now();
  try {
    await DB.putSheet(state.sheet);
    setSaveStatus('✓ Guardado');
  } catch (e) {
    console.error(e);
    setSaveStatus('⚠ Error al guardar');
    toast('No se pudo guardar. Revisá el espacio del dispositivo.');
  }
}
function setSaveStatus(t) { $('#saveStatus').textContent = t; }

/* ---------- Vista: Planilla ---------- */

async function openDate(iso) {
  if (saveTimer) await flushSave();
  state.date = iso;
  $('#dateInput').value = iso;
  $('#headerSub').textContent = `Stock diario · ${fmtDate(iso)}`;
  state.sheet = (await DB.getSheet(iso)) || null;
  setSaveStatus('');
  await renderSheetView();
}

async function renderSheetView() {
  const has = !!state.sheet;
  $('#createCard').hidden = has;
  $('#tableWrap').hidden = !has;
  $('#modeRow').style.display = has ? '' : 'none';

  if (!has) {
    $('#syncBanner').hidden = true;
    $('#createDate').textContent = fmtDate(state.date);
    const prev = await findPreviousSheet(state.date);
    const btn = $('#createPrefill');
    if (prev) {
      btn.hidden = false;
      btn.textContent = `Crear con stock inicial del ${fmtDate(prev.date)}`;
      btn.dataset.prev = prev.date;
      $('#createHint').textContent = `Se puede precargar "Stock inicial turno mañana" con el "Stock al finalizar turno tarde" del ${fmtWeekday(prev.date)} ${fmtDate(prev.date)}.`;
    } else {
      btn.hidden = true;
      $('#createHint').textContent = 'Todavía no hay días anteriores cargados.';
    }
    return;
  }

  $('#syncBanner').hidden = rowsSignature(state.sheet.rows) === rowsSignature(rowsFromConfig());
  renderTable();
}

async function findPreviousSheet(iso) {
  const all = await DB.allSheets();
  const prev = all.filter((s) => s.date < iso).sort((a, b) => (a.date < b.date ? 1 : -1));
  return prev[0] || null;
}

async function createSheet(prefillFrom) {
  const sheet = { date: state.date, rows: rowsFromConfig(), values: {}, createdAt: Date.now(), updatedAt: Date.now() };
  if (prefillFrom) {
    const prev = await DB.getSheet(prefillFrom);
    if (prev) {
      for (const r of sheet.rows) {
        const v = prev.values[r.id];
        if (v && typeof v[COL_FT] === 'number') {
          sheet.values[r.id] = [null, null, null, null, null, null];
          sheet.values[r.id][COL_SI] = v[COL_FT];
        }
      }
    }
  }
  state.sheet = sheet;
  await DB.putSheet(sheet);
  setSaveStatus('✓ Guardado');
  renderSheetView();
  if (prefillFrom) toast(`Stock inicial precargado del ${fmtDate(prefillFrom)}`);
}

// Actualiza las filas de una planilla a la configuración actual, sin perder datos:
// los productos que ya no están (o están ocultos) pero tienen valores se conservan en su sección.
function syncSheetRows() {
  const sheet = state.sheet;
  const fresh = rowsFromConfig();
  const freshIds = new Set(fresh.map((r) => r.id));
  const kept = sheet.rows.filter((r) => !freshIds.has(r.id) && hasValues(sheet, r.id));
  const merged = [];
  for (const s of SECTIONS) {
    merged.push(...fresh.filter((r) => r.section === s.id));
    merged.push(...kept.filter((r) => r.section === s.id));
  }
  sheet.rows = merged;
  scheduleSave();
  renderSheetView();
  toast('Planilla actualizada');
}

function hasValues(sheet, id) {
  const v = sheet.values[id];
  return !!v && v.some((x) => typeof x === 'number');
}

function renderTable() {
  const sheet = state.sheet;
  const cols = MODE_COLS[state.mode];
  const configIds = new Set(rowsFromConfig().map((r) => r.id));
  document.body.classList.remove('mode-full', 'mode-manana', 'mode-tarde');
  document.body.classList.add('mode-' + state.mode);

  let html = '<thead><tr><th class="col-prod">Sabores de cookies – Productos</th>';
  for (const c of cols) html += `<th class="num turno-${COLUMNS[c].turno}">${esc(COLUMNS[c].app)}</th>`;
  html += '</tr></thead><tbody>';

  for (const line of buildLayout(sheet.rows)) {
    if (line.type === 'section') {
      html += `<tr class="section"><td class="col-prod">${esc(line.title)}</td>${cols.map(() => '<td></td>').join('')}</tr>`;
    } else if (line.type === 'total') {
      html += `<tr class="total" data-of="${line.of.join(',')}"><td class="col-prod">TOTAL</td>`;
      for (const c of cols) html += `<td data-col="${c}">${dash(computeTotal(sheet, line.of, c))}</td>`;
      html += '</tr>';
    } else {
      const r = line.row;
      const orphan = !configIds.has(r.id) ? ' orphan' : '';
      html += `<tr class="prod${orphan}"><td class="col-prod">${esc(r.name)}</td>`;
      for (const c of cols) {
        const v = getVal(sheet, r.id, c);
        html += `<td class="cell"><div class="stepper">
          <button type="button" class="step minus" data-step="-1" tabindex="-1" aria-label="Restar uno">−</button>
          <input class="num-in" type="text" inputmode="numeric" pattern="[0-9]*" enterkeyhint="next"
          autocomplete="off" placeholder="–" aria-label="${esc(r.name)} – ${esc(COLUMNS[c].app)}"
          data-id="${r.id}" data-col="${c}" value="${v === null ? '' : v}">
          <button type="button" class="step plus" data-step="1" tabindex="-1" aria-label="Sumar uno">+</button>
        </div></td>`;
      }
      html += '</tr>';
    }
  }
  html += '</tbody>';
  $('#sheetTable').innerHTML = html;
}

function updateTotals() {
  const sheet = state.sheet;
  document.querySelectorAll('#sheetTable tr.total').forEach((tr) => {
    const of = tr.dataset.of.split(',');
    tr.querySelectorAll('td[data-col]').forEach((td) => {
      td.textContent = dash(computeTotal(sheet, of, Number(td.dataset.col)));
    });
  });
}

function onCellInput(e) {
  const input = e.target;
  if (!input.classList.contains('num-in')) return;
  const clean = input.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '').slice(0, 6);
  if (clean !== input.value) input.value = clean;
  setCell(input, clean);
}

// Botones + / −: suman o restan 1 (nunca menos de 0).
function onStepClick(e) {
  const btn = e.target.closest('.step');
  if (!btn) return;
  const input = btn.parentElement.querySelector('.num-in');
  const current = input.value === '' ? null : Number(input.value);
  const step = Number(btn.dataset.step);
  if (step < 0 && !current) return;
  const next = String((current || 0) + step);
  input.value = next;
  setCell(input, next);
}

function setCell(input, clean) {
  const id = input.dataset.id;
  const col = Number(input.dataset.col);
  const sheet = state.sheet;
  if (!sheet.values[id]) sheet.values[id] = [null, null, null, null, null, null];
  sheet.values[id][col] = clean === '' ? null : Number(clean);
  updateTotals();
  scheduleSave();
}

// Enter pasa a la celda de abajo (misma columna), cómodo para cargar por columna.
function onCellKey(e) {
  if (e.key !== 'Enter' || !e.target.classList.contains('num-in')) return;
  e.preventDefault();
  const col = e.target.dataset.col;
  const inputs = [...document.querySelectorAll(`#sheetTable input[data-col="${col}"]`)];
  const next = inputs[inputs.indexOf(e.target) + 1];
  if (next) next.focus(); else e.target.blur();
}

/* ---------- Vista: Historial ---------- */

async function renderHistory() {
  const all = (await DB.allSheets()).sort((a, b) => (a.date < b.date ? 1 : -1));
  const ul = $('#historyList');
  if (!all.length) {
    ul.innerHTML = '<li class="empty">Todavía no hay planillas cargadas.</li>';
    return;
  }
  ul.innerHTML = all.map((s) => {
    const loaded = s.rows.filter((r) => hasValues(s, r.id)).length;
    const tFm = computeTotal(s, ['cookies', 'flat'], 2);
    const tFt = computeTotal(s, ['cookies', 'flat'], COL_FT);
    return `<li class="history-item${s.date === state.date ? ' current' : ''}">
      <div class="history-main" data-open="${s.date}">
        <div class="history-date">${fmtDate(s.date)} <span class="wd">· ${fmtWeekday(s.date)}</span></div>
        <div class="history-meta">${loaded} productos con datos · Total cookies+flat: mañana ${dash(tFm)} / tarde ${dash(tFt)}</div>
      </div>
      <button class="btn btn-small" data-open="${s.date}">Abrir</button>
      <button class="mini del" data-del="${s.date}" aria-label="Borrar ${fmtDate(s.date)}">🗑</button>
    </li>`;
  }).join('');
}

async function onHistoryClick(e) {
  const open = e.target.closest('[data-open]');
  const del = e.target.closest('[data-del]');
  if (del) {
    const d = del.dataset.del;
    if (!confirm(`¿Borrar la planilla del ${fmtDate(d)}? No se puede deshacer.`)) return;
    await DB.deleteSheet(d);
    if (state.date === d) { state.sheet = null; }
    toast(`Planilla del ${fmtDate(d)} borrada`);
    renderHistory();
  } else if (open) {
    await openDate(open.dataset.open);
    showView('sheet');
  }
}

/* ---------- Vista: Productos ---------- */

function renderProducts() {
  const box = $('#productsEditor');
  box.innerHTML = SECTIONS.map((s) => {
    const items = state.products.filter((p) => p.section === s.id);
    const note = s.totalOf
      ? `<div class="total-note">Debajo lleva fila TOTAL (${s.totalOf.map((id) => SECTIONS.find((x) => x.id === id).label).join(' + ')}).</div>`
      : '';
    return `<div class="card prod-section" data-section="${s.id}">
      <h2>${esc(s.label)}</h2>${note}
      ${items.map((p, i) => `
        <div class="prod-row${p.hidden ? ' is-hidden' : ''}" data-id="${p.id}">
          <input type="text" value="${esc(p.name)}" data-act="rename" aria-label="Nombre del producto">
          <button class="mini" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Subir">▲</button>
          <button class="mini" data-act="down" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Bajar">▼</button>
          <button class="mini ${p.hidden ? '' : 'on'}" data-act="toggle" aria-label="${p.hidden ? 'Mostrar' : 'Ocultar'}">${p.hidden ? '◌' : '●'}</button>
          <button class="mini del" data-act="delete" aria-label="Eliminar">✕</button>
        </div>`).join('')}
      <div class="add-row">
        <input type="text" placeholder="Nuevo producto…" data-add="${s.id}" enterkeyhint="done">
        <button class="btn btn-primary btn-small" data-act="add" data-section="${s.id}">Agregar</button>
      </div>
    </div>`;
  }).join('') + '<p class="muted small">● visible · ◌ oculto (no aparece en planillas nuevas)</p>';
}

async function onProductsClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;

  if (act === 'add') {
    const input = $(`#productsEditor input[data-add="${btn.dataset.section}"]`);
    await addProduct(btn.dataset.section, input.value);
    return;
  }

  const id = btn.closest('.prod-row').dataset.id;
  const p = state.products.find((x) => x.id === id);
  if (!p) return;

  if (act === 'up' || act === 'down') {
    const same = state.products.filter((x) => x.section === p.section);
    const i = same.indexOf(p);
    const j = act === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= same.length) return;
    const a = state.products.indexOf(same[i]);
    const b = state.products.indexOf(same[j]);
    [state.products[a], state.products[b]] = [state.products[b], state.products[a]];
  } else if (act === 'toggle') {
    p.hidden = !p.hidden;
  } else if (act === 'delete') {
    if (!confirm(`¿Eliminar "${p.name}"? Las planillas viejas conservan sus datos.`)) return;
    state.products.splice(state.products.indexOf(p), 1);
  }
  await saveProducts();
  renderProducts();
}

async function addProduct(section, name) {
  name = (name || '').trim();
  if (!name) { toast('Escribí el nombre del producto'); return; }
  const lastIdx = state.products.map((p) => p.section).lastIndexOf(section);
  const sectionIdx = SECTIONS.findIndex((s) => s.id === section);
  let insertAt = lastIdx + 1;
  if (lastIdx === -1) {
    // sección vacía: va después de la última fila de las secciones anteriores
    insertAt = 0;
    state.products.forEach((p, i) => {
      if (SECTIONS.findIndex((s) => s.id === p.section) < sectionIdx) insertAt = i + 1;
    });
  }
  state.products.splice(insertAt, 0, { id: uid(), name, section, hidden: false });
  await saveProducts();
  renderProducts();
  toast(`"${name}" agregado`);
}

async function onProductsChange(e) {
  const input = e.target;
  if (input.dataset.act !== 'rename') return;
  const id = input.closest('.prod-row').dataset.id;
  const p = state.products.find((x) => x.id === id);
  const name = input.value.trim();
  if (!name) { input.value = p.name; return; }
  p.name = name;
  await saveProducts();
  toast('Nombre actualizado');
}

function onProductsKey(e) {
  if (e.key !== 'Enter') return;
  if (e.target.dataset.add) { e.preventDefault(); addProduct(e.target.dataset.add, e.target.value); }
  else if (e.target.dataset.act === 'rename') e.target.blur();
}

/* ---------- PDF (jsPDF + autotable) ---------- */

const PDF_TITLE = 'STOCK DIARIO DE DULCE JAZMÍN';

// sheet = null -> planilla en blanco con los productos visibles actuales.
function buildPdf(sheet) {
  const { jsPDF } = window.jspdf;
  const rows = sheet ? sheet.rows : rowsFromConfig();
  const lines = buildLayout(rows);

  const body = lines.map((line) => {
    if (line.type === 'section') {
      return [{ content: line.title, styles: { halign: 'center', fontStyle: 'bold' } }, '', '', '', '', '', ''];
    }
    if (line.type === 'total') {
      return [{ content: 'TOTAL', styles: { halign: 'center', fontStyle: 'bold' } },
        ...COLUMNS.map((_, c) => ({ content: sheet ? dash(computeTotal(sheet, line.of, c)) : '', styles: { fontStyle: 'bold' } }))];
    }
    return [{ content: line.row.name.toLocaleUpperCase('es-AR'), styles: { halign: 'left', fontStyle: 'bold' } },
      ...COLUMNS.map((_, c) => (sheet ? dash(getVal(sheet, line.row.id, c)) : ''))];
  });

  const fecha = sheet ? fmtDate(sheet.date) : '';

  // Probamos con escala 1 y achicamos hasta que entre en una sola hoja.
  for (let scale = 1; scale >= 0.5; scale -= 0.05) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 8;
    const tableW = pageW - margin * 2;
    const firstW = tableW * 0.30;
    const otherW = (tableW - firstW) / 6;

    const headH = 32 * scale;                         // título + fecha + encabezados (aprox.)
    const rowH = Math.min(7.6, (pageH - margin * 2 - headH) / body.length) * scale;
    const fontBody = Math.max(5, Math.min(9, rowH * 1.2)) * scale;

    doc.autoTable({
      theme: 'grid',
      startY: margin,
      margin: { top: margin, right: margin, bottom: margin, left: margin },
      tableWidth: tableW,
      pageBreak: 'auto',
      showHead: 'firstPage',
      head: [
        [{ content: PDF_TITLE, colSpan: 7, styles: { halign: 'center', fontStyle: 'bold', fontSize: 13 * scale, minCellHeight: 10 * scale } }],
        [{ content: `FECHA: ${fecha}`, colSpan: 7, styles: { halign: 'left', fontStyle: 'bold', fontSize: 10 * scale, minCellHeight: 7 * scale } }],
        [{ content: 'SABORES DE COOKIES - PRODUCTOS', styles: { halign: 'center' } },
          ...COLUMNS.map((c) => ({ content: c.pdf, styles: { halign: 'center' } }))]
      ],
      body,
      styles: {
        font: 'helvetica',
        fontSize: fontBody,
        textColor: [0, 0, 0],
        fillColor: [255, 255, 255],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 0.6, bottom: 0.6, left: 1.4, right: 1.4 },
        minCellHeight: rowH,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 6.6 * scale,
        halign: 'center',
        valign: 'middle',
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        cellPadding: { top: 1, bottom: 1, left: 1, right: 1 }
      },
      bodyStyles: { fillColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: firstW },
        1: { cellWidth: otherW }, 2: { cellWidth: otherW }, 3: { cellWidth: otherW },
        4: { cellWidth: otherW }, 5: { cellWidth: otherW }, 6: { cellWidth: otherW }
      }
    });

    if (doc.getNumberOfPages() === 1) return doc;
  }
  throw new Error('No entra en una hoja');
}

function pdfFileName(sheet) {
  return sheet ? `Stock_Dulce_Jazmin_${fmtDate(sheet.date).replace(/\//g, '-')}.pdf` : 'Stock_Dulce_Jazmin_en_blanco.pdf';
}

// En iPhone abre la hoja de compartir (Guardar en Archivos, WhatsApp…); si no se puede, descarga.
async function shareOrDownload(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.share) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;   // el usuario cerró la hoja de compartir
      console.warn('share falló, descargo', err);
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function downloadPdf(sheet) {
  try {
    if (sheet && saveTimer) flushSave();
    const doc = buildPdf(sheet);
    const blob = doc.output('blob');
    await shareOrDownload(blob, pdfFileName(sheet), sheet ? `Stock ${fmtDate(sheet.date)}` : 'Planilla en blanco');
  } catch (e) {
    console.error(e);
    toast('No se pudo generar el PDF');
  }
}

/* ---------- Backup JSON ---------- */

async function exportData() {
  const data = {
    app: 'universo-cookies-stock',
    version: 1,
    exportedAt: new Date().toISOString(),
    products: state.products,
    sheets: await DB.allSheets()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const d = todayISO().split('-').reverse().join('-');
  await shareOrDownload(blob, `Backup_Dulce_Jazmin_${d}.json`, 'Backup Dulce Jazmín');
}

async function importData(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'universo-cookies-stock' || !Array.isArray(data.products) || !Array.isArray(data.sheets)) {
      throw new Error('formato');
    }
    if (!confirm(`Importar ${data.sheets.length} planillas y ${data.products.length} productos.\nSe reemplaza la lista de productos y se sobrescriben las fechas repetidas. ¿Continuar?`)) return;
    for (const s of data.sheets) {
      if (s && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && Array.isArray(s.rows) && s.values) await DB.putSheet(s);
    }
    state.products = data.products.filter((p) => p && p.id && p.name && SECTIONS.some((s) => s.id === p.section));
    await saveProducts();
    await openDate(state.date);
    toast('Datos importados');
  } catch (e) {
    console.error(e);
    alert('El archivo no es un backup válido de esta app.');
  }
}

/* ---------- Navegación ---------- */

function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  if (name === 'history') renderHistory();
  if (name === 'products') renderProducts();
  if (name === 'sheet') renderSheetView();
  if (name === 'settings') renderStorageInfo();
}

async function renderStorageInfo() {
  let txt = 'Los datos se guardan solo en este dispositivo (IndexedDB). Hacé un backup de vez en cuando.';
  try {
    if (navigator.storage && navigator.storage.persisted) {
      const p = await navigator.storage.persisted();
      txt += p ? ' Almacenamiento persistente: activado.' : '';
    }
  } catch (e) { /* nada */ }
  $('#storageInfo').textContent = txt;
  $('#versionInfo').textContent = `Versión ${APP_VERSION}`;
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)));

  $('#dateInput').addEventListener('change', (e) => { if (e.target.value) openDate(e.target.value); });
  $('#prevDay').addEventListener('click', () => openDate(shiftISO(state.date, -1)));
  $('#nextDay').addEventListener('click', () => openDate(shiftISO(state.date, 1)));
  $('#todayBtn').addEventListener('click', () => openDate(todayISO()));

  document.querySelectorAll('.seg').forEach((b) => b.addEventListener('click', () => {
    state.mode = b.dataset.mode;
    document.querySelectorAll('.seg').forEach((x) => x.classList.toggle('active', x === b));
    try { localStorage.setItem('uc-mode', state.mode); } catch (e) { /* nada */ }
    renderTable();
  }));

  $('#createPrefill').addEventListener('click', (e) => createSheet(e.currentTarget.dataset.prev));
  $('#createEmpty').addEventListener('click', () => createSheet(null));
  $('#syncBtn').addEventListener('click', syncSheetRows);

  const table = $('#sheetTable');
  table.addEventListener('input', onCellInput);
  table.addEventListener('keydown', onCellKey);
  table.addEventListener('click', onStepClick);
  // que tocar + / − no saque ni abra el teclado
  table.addEventListener('pointerdown', (e) => { if (e.target.closest('.step')) e.preventDefault(); });
  table.addEventListener('focusin', (e) => { if (e.target.classList.contains('num-in')) e.target.select(); });

  $('#pdfBtn').addEventListener('click', () => downloadPdf(state.sheet));
  $('#blankPdfBtn').addEventListener('click', () => downloadPdf(null));

  $('#historyList').addEventListener('click', onHistoryClick);

  const pe = $('#productsEditor');
  pe.addEventListener('click', onProductsClick);
  pe.addEventListener('change', onProductsChange);
  pe.addEventListener('keydown', onProductsKey);

  $('#exportBtn').addEventListener('click', exportData);
  $('#importInput').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) importData(f);
  });

  // Guardar ya si la app pasa a segundo plano.
  document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) flushSave(); });
  window.addEventListener('pagehide', () => { if (saveTimer) flushSave(); });
}

/* ---------- Inicio ---------- */

async function init() {
  bindEvents();
  try { state.mode = localStorage.getItem('uc-mode') || 'full'; } catch (e) { /* nada */ }
  if (!MODE_COLS[state.mode]) state.mode = 'full';
  document.querySelectorAll('.seg').forEach((x) => x.classList.toggle('active', x.dataset.mode === state.mode));

  state.products = (await DB.getMeta('products')) || null;
  if (!state.products) {
    state.products = defaultProducts();
    await saveProducts();
  }
  await openDate(todayISO());

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
  }
}

init().catch((e) => {
  console.error(e);
  alert('No se pudo iniciar la app: ' + e.message);
});
