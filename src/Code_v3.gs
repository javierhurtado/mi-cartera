/**
 * Mi Cartera v3 - hoja "Inversiones"
 * Pestañas usadas: Cartera, Oper., Div., Rend., Emp. (+ _Hist, auxiliar que crea el script)
 */
const CONFIG = {
  SHEET_ID: '1Yr5xY3F9Ajbu_DgCtjrunsAAu7U5CPX5EEomd9LnOsA',
  CARTERA: 'Cartera', OPER: 'Oper.', DIV: 'Div.', REND: 'Rend.', EMP: 'Emp.', HIST: '_Hist',

  CELL_VALOR: 'D3', CELL_COSTE: 'D5', CELL_PYG_NOREAL: 'G5', CELL_TR: 'K5', CELL_DIV: 'U5', CELL_PYG_REAL: 'W5', CELL_OPC: 'S5', CELL_PYG_DIA: 'G3', CELL_PYG_DIA_PCT: 'I3',

  // Columnas de Oper. (índice desde 0)
  OP: { t: 0, cartera: 2, divisa: 3, broker: 4, fc: 5, tipo: 8, acc: 9, totC: 16, vend: 17, fv: 18, totV: 25 },
  TIPOS_EXCLUIR: ['divisa', 'margen'],
  TIPOS_SIN_FLUJO: ['traspaso', 'spin-off', 'contrasplit'],
  DIV_RESTA_DESTINO: false,

  // Hoja de origen de «Emp.» (la de IMPORTRANGE). De ahí se lee la columna API (símbolo tipo ACS.MC) para los logos
  EMPRESAS_ID: '1w6L4H9Br9x1k_9_ae644SU0H9FBupWA0IWVvPjhOTns',
  EMPRESAS_TAB: 'Empresas',

  // Carpeta de Drive con los logos, un archivo por valor llamado TICKER.png
  LOGOS_FOLDER: '1iIje_Fmh8xoDsYgXOs7f7WFHl67FlZF5',

  // Logos manuales por ticker (opcional): { 'ACS': 'https://...png' }
  LOGOS: {}
};

/* ---------- Entrada web ----------
 * Sin parámetros: devuelve la página HTML, solo si quien la abre es el propietario.
 * Con ?a=loadAll|loadLogos|buildHistory&k=CLAVE: devuelve JSON (lo usa la web instalable del iPhone).
 * La clave se crea una vez con crearClaveApi() y se guarda en las propiedades del script. */
function out_(o) {
  return ContentService.createTextOutput(typeof o === 'string' ? o : JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.a) {
    const key = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (!key || p.k !== key) return out_({ error: 'No autorizado' });
    try {
      if (p.a === 'loadAll') return out_(loadAll(p.s === '1'));
      if (p.a === 'loadLogos') return out_(loadLogos(+p.s || 0));
      if (p.a === 'loadTvLogos') return out_(loadTvLogos());
      if (p.a === 'loadBench') return out_(loadBench());
      if (p.a === 'buildHistory') return out_(buildHistory());
      return out_({ error: 'Acción desconocida' });
    } catch (err) { return out_({ error: String(err) }); }
  }
  const me = Session.getEffectiveUser().getEmail(), you = Session.getActiveUser().getEmail();
  if (!me || me !== you) return HtmlService.createHtmlOutput('Acceso restringido');
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Mi Cartera')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
/** Ejecútala una vez desde el editor y copia la clave del registro de ejecución. */
function crearClaveApi() {
  const k = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('API_KEY', k);
  Logger.log('CLAVE: ' + k);
  return k;
}
/** Muestra la clave ya creada. */
function verClaveApi() {
  const k = PropertiesService.getScriptProperties().getProperty('API_KEY') || '(no creada: ejecuta crearClaveApi)';
  Logger.log('CLAVE: ' + k);
  return k;
}

const norm_ = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

function num_(v) {
  if (typeof v === 'number') return v;
  let s = String(v == null ? '' : v).replace(/[€$£%\s]/g, '');
  if (!s || s === '-') return NaN;
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else s = s.replace(',', '.');
  return parseFloat(s);
}

function date_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  const s = String(v == null ? '' : v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return null;
}

function sheet_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error('No encuentro la pestaña "' + name + '".');
  return sh;
}

/* Variación diaria: celda con formato % (número = fracción) o texto «0,84%» */
function chg_(v) {
  if (typeof v === 'number') return v;
  const n = num_(v); return isNaN(n) ? NaN : n / 100;
}

/* ---------- Cartera ---------- */
function readCartera_(ss) {
  const sh = sheet_(ss, CONFIG.CARTERA), vals = sh.getDataRange().getValues();
  let hr = -1;
  for (let i = 0; i < Math.min(20, vals.length); i++) {
    const h = vals[i].map(norm_);
    if (h.includes('ticker') && h.includes('pos.')) { hr = i; break; }
  }
  if (hr < 0) throw new Error('No encuentro la cabecera (Ticker, Pos.) en la pestaña Cartera.');
  const h = vals[hr].map(norm_), ix = n => h.indexOf(norm_(n));
  const C = { t: ix('ticker'), q: ix('pos.'), pmc: ix('pmc'), px: ix('ultimo'), chg: ix('cambio'), ccy: ix('divisa'), cost: ix('coste'),
              val: ix('valor'), pyg: ix('pyg'), div: ix('div'), sector: ix('sector'), sub: ix('subsector') };
  const positions = [];
  for (let r = hr + 1; r < vals.length; r++) {
    const row = vals[r], t = String(row[C.t] || '').trim().toUpperCase(), q = num_(row[C.q]);
    if (!t || !(q > 0)) continue;
    positions.push({ t, q, pmc: num_(row[C.pmc]), px: num_(row[C.px]), chg: chg_(row[C.chg]), ccy: row[C.ccy], cost: num_(row[C.cost]),
      val: num_(row[C.val]), pyg: num_(row[C.pyg]), div: num_(row[C.div]) || 0, sector: row[C.sector] || '', sub: row[C.sub] || '' });
  }
  const g = a => { const m = /^([A-Z]+)(\d+)$/.exec(a); let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; const row = vals[+m[2] - 1]; return num_(row ? row[c - 1] : ''); };
  const totals = { valor: g(CONFIG.CELL_VALOR), coste: g(CONFIG.CELL_COSTE), pygNoReal: g(CONFIG.CELL_PYG_NOREAL),
                   tr: g(CONFIG.CELL_TR), div: g(CONFIG.CELL_DIV), pygReal: g(CONFIG.CELL_PYG_REAL),
                   opc: g(CONFIG.CELL_OPC), pygDia: g(CONFIG.CELL_PYG_DIA), pygDiaPct: g(CONFIG.CELL_PYG_DIA_PCT) };
  return { positions, totals };
}

/* ---------- Oper. ---------- */
function readOper_(ss, tz) {
  const sh = sheet_(ss, CONFIG.OPER), vals = sh.getDataRange().getValues(), O = CONFIG.OP;
  const lots = []; const movs = []; let skipped = 0; const tipos = {};
  for (let r = 1; r < vals.length; r++) {
    const row = vals[r], t = String(row[O.t] || '').trim().toUpperCase();
    if (!t) continue;
    const tipo = norm_(row[O.tipo]);
    tipos[tipo] = (tipos[tipo] || 0) + 1;
    if (CONFIG.TIPOS_EXCLUIR.includes(tipo)) { skipped++; continue; }
    const fc = date_(row[O.fc], tz), q = num_(row[O.acc]), eur = num_(row[O.totC]);
    // Movimientos para el broker: incluye traspasos aunque no tengan acciones/importe
    const brk = String(row[O.broker] || '').trim();
    if (fc && brk) movs.push({ t, fc, broker: brk, tipo, sold: norm_(row[O.vend]).startsWith('s'), r });
    if (!fc || !(q > 0)) { skipped++; continue; }
    const lot = { t, tipo, fc, q, broker: String(row[O.broker] || '').trim(), eur: isNaN(eur) ? 0 : Math.abs(eur),
                  flujoC: !CONFIG.TIPOS_SIN_FLUJO.includes(tipo) && !isNaN(eur) && eur > 0 };
    if (norm_(row[O.vend]).startsWith('s')) {
      const fv = date_(row[O.fv], tz), ev = num_(row[O.totV]);
      if (fv && !isNaN(ev)) { lot.fv = fv; lot.eurV = ev; }
    }
    lots.push(lot);
  }
  return { lots, skipped, tipos, movs };
}

/* ---------- Opc. (opciones cerradas: PyG por contrato) ---------- */
function readOpc_(ss, tz) {
  const sh = ss.getSheetByName('Opc.'); if (!sh) return [];
  const vals = sh.getDataRange().getValues(), h = vals[0].map(norm_);
  const iT = h.indexOf('ticker'), iF = h.indexOf('vencimiento'), iP = h.indexOf('pyg'), iY = h.indexOf('tipo de compra'), iFY = h.indexOf('ejercicio fiscal'), iS = h.indexOf('simbolo'), iK = h.indexOf('strike');
  if (iT < 0 || iF < 0 || iP < 0) return [];
  const out = [];
  for (let r = 1; r < vals.length; r++) {
    const row = vals[r], f = date_(row[iF], tz), p = num_(row[iP]);
    if (!f || isNaN(p)) continue;
    out.push({ t: String(row[iT] || '').trim().toUpperCase(), tipo: String(row[iY] || '').trim(), f, fy: iFY >= 0 ? String(row[iFY]).trim() : f.slice(0, 4), pyg: p,
      sym: iS >= 0 ? String(row[iS] || '').trim() : '', k: iK >= 0 ? num_(row[iK]) : NaN });
  }
  return out;
}

/* ---------- Div. ---------- */
function readDiv_(ss, tz) {
  const sh = sheet_(ss, CONFIG.DIV), vals = sh.getDataRange().getValues();
  const h = vals[0].map(norm_), ix = n => h.indexOf(norm_(n));
  const C = { t: ix('ticker'), f: ix('fecha'), b: ix('div. bruto (€)'), o: ix('ret. origen (€)'), d: ix('ret. destino (€)'), c: ix('comision (€)') };
  const divs = [];
  for (let r = 1; r < vals.length; r++) {
    const row = vals[r], f = date_(row[C.f], tz), b = num_(row[C.b]);
    if (!f || isNaN(b)) continue;
    let net = b - (num_(row[C.o]) || 0) - (num_(row[C.c]) || 0);
    if (CONFIG.DIV_RESTA_DESTINO) net -= (num_(row[C.d]) || 0);
    divs.push({ t: String(row[C.t] || '').trim().toUpperCase(), f, net, gross: b });
  }
  return divs;
}

/* ---------- Rend. (control) ---------- */
function readRend_(ss, tz) {
  const sh = ss.getSheetByName(CONFIG.REND); if (!sh) return [];
  const vals = sh.getDataRange().getValues();
  const h = vals[0].map(norm_), iF = h.indexOf('fecha'), iC = h.indexOf('coste bolsa'), iV = h.indexOf('valor bolsa');
  const out = [];
  for (let r = 1; r < vals.length; r++) {
    const f = date_(vals[r][iF], tz), c = num_(vals[r][iC]), v = num_(vals[r][iV]);
    if (f && c > 0 && v > 0) out.push({ f, c, v });
  }
  return out;
}

/* ---------- Emp. (catálogo: prefijo, divisa, sector, previsión de dividendos, logo) ---------- */
function logoOf_(v) {
  try {
    if (v && typeof v === 'object' && typeof v.getUrl === 'function') return v.getUrl() || '';   // imagen en celda
  } catch (e) {}
  const s = String(v || '').trim();
  const m = s.match(/https?:\/\/[^\s"')]+/);
  return m ? m[0] : '';
}

function readEmp_(ss, tz) {
  const sh = sheet_(ss, CONFIG.EMP), n = sh.getLastRow() - 2;
  if (n < 1) return [];
  const vals = sh.getRange(3, 1, n, 31).getValues(), out = [];
  vals.forEach(r => {
    const t = String(r[1] || '').trim().toUpperCase();
    if (!t) return;
    out.push({
      t, name: r[2], pais: r[4], prefix: String(r[5] || '').trim(), ccy: String(r[6] || '').trim(),
      sector: r[7], sub: r[8], tipo: r[10], acc: num_(r[11]) || 0, fxN: num_(r[13]),
      divAnual: num_(r[14]) || 0,
      months: r.slice(15, 27).map(x => { const v = num_(x); return isNaN(v) ? 0 : v; }),   // € por acción, ene..dic
      nextDate: date_(r[27], tz), nextDiv: num_(r[28]) || 0, nextTotal: num_(r[29]) || 0,
      logo: CONFIG.LOGOS[t] || logoOf_(r[30])
    });
  });
  return out;
}

/* ---------- Logos desde la carpeta de Drive (se devuelven incrustados, con caché 6 h) ---------- */
/** Ejecútala una vez desde el editor para conceder el permiso de Drive (lectura de la carpeta de logos). */
function autorizarDrive() {
  const f = DriveApp.getFolderById(CONFIG.LOGOS_FOLDER);
  Logger.log('Carpeta de logos: ' + f.getName());
}

/** Índice nombre → id de archivo (con duplicados elige el que no es el icono genérico). Caché 6 h. */
function logoIndex_() {
  const cache = CacheService.getScriptCache(), c = cache.get('lgidx2');
  if (c) return JSON.parse(c);
  const PLACEHOLDER = 15326, by = {}, it = DriveApp.getFolderById(CONFIG.LOGOS_FOLDER).getFiles();
  while (it.hasNext()) {
    const f = it.next(), n = f.getName().replace(/\.[^.]+$/, '').replace(/^\./, '').trim().toUpperCase();
    if (n) (by[n] = by[n] || []).push(f);
  }
  const idx = {};
  Object.keys(by).forEach(n => {
    const arr = by[n];
    const pick = arr.length > 1 ? (arr.find(f => f.getSize() !== PLACEHOLDER) || arr[0]) : arr[0];
    idx[n] = pick.getId();
  });
  try { cache.put('lgidx2', JSON.stringify(idx), 21600); } catch (e) {}
  return idx;
}

/** Devuelve los logos por lotes de 30. La app los pide aparte, para que la carga principal no espere a Drive. */
function loadLogos(start) {
  start = start || 0;
  const N = 30;
  try {
    const idx = logoIndex_(), names = Object.keys(idx).sort(), cache = CacheService.getScriptCache();
    const part = names.slice(start, start + N);
    let hit = {};
    try { hit = cache.getAll(part.map(n => 'lg3_' + idx[n])); } catch (e) {}
    const out = {}, put = {};
    part.forEach(n => {
      let u = hit['lg3_' + idx[n]];
      if (!u) {
        try {
          const f = DriveApp.getFileById(idx[n]), b = f.getSize() < 70000 ? f.getBlob() : f.getThumbnail();
          u = 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes());
          if (u.length < 95000) put['lg3_' + idx[n]] = u;
        } catch (e) { return; }
      }
      out[n] = u;
    });
    if (Object.keys(put).length) { try { cache.putAll(put, 21600); } catch (e) {} }
    return JSON.stringify({ logos: out, next: start + N < names.length ? start + N : null, total: names.length });
  } catch (e) {
    return JSON.stringify({ error: String(e), next: null, total: 0 });
  }
}

/* ---------- Logos de TradingView para las posiciones sin logo en Drive ----------
 * Se consulta el «logoid» de cada símbolo (scanner / búsqueda de TradingView) y se guarda en las propiedades del script,
 * de modo que cada ticker se pregunta una sola vez. El logo se carga luego desde s3-symbol-logo.tradingview.com. */
const TV_EXCH_ = { 'BME:': 'BME', 'EPA:': 'EURONEXT', 'AMS:': 'EURONEXT', 'EBR:': 'EURONEXT', 'ELI:': 'EURONEXT', 'ETR:': 'XETR', 'LON:': 'LSE',
  'BIT:': 'MIL', 'SWX:': 'SIX', 'HEL:': 'OMXHEX', 'STO:': 'OMXSTO', 'CPH:': 'OMXCOP', 'VIE:': 'VIE', 'TSE:': 'TSX', 'TYO:': 'TSE',
  'NASDAQ:': 'NASDAQ', 'NYSE:': 'NYSE', 'NYSEARCA:': 'AMEX', 'NYSEAMERICAN:': 'AMEX', 'NYSEMKT:': 'AMEX', 'OTCMKTS:': 'OTC', 'OTC:': 'OTC' };
function tvHeaders_() { return { Origin: 'https://es.tradingview.com', Referer: 'https://es.tradingview.com/', 'User-Agent': 'Mozilla/5.0' }; }
function loadTvLogos() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID), tz = ss.getSpreadsheetTimeZone();
    const car = readCartera_(ss), emp = readEmp_(ss, tz), idx = logoIndex_();
    const pref = {}; emp.forEach(e => { pref[e.t] = e.prefix; });
    let opcT = []; try { opcT = readOpc_(ss, tz).map(o => String(o.t).trim().toUpperCase()); } catch (e) {}
    const tickers = [...new Set(car.positions.map(p => String(p.t).trim().toUpperCase()).concat(opcT))].filter(t => t);
    const P = PropertiesService.getScriptProperties();
    let map = {}; try { map = JSON.parse(P.getProperty('TV_LOGOS') || '{}'); } catch (e) {}
    const todo = tickers.filter(t => !(t in map)).slice(0, 20);
    let errors = 0;
    if (todo.length) {
      const sym = t => (TV_EXCH_[pref[t]] ? TV_EXCH_[pref[t]] + ':' : '') + t;
      const reqs = todo.map(t => ({ url: 'https://scanner.tradingview.com/symbol?symbol=' + encodeURIComponent(sym(t)) + '&fields=logoid&no_404=true', muteHttpExceptions: true, headers: tvHeaders_() }));
      const res = UrlFetchApp.fetchAll(reqs);
      const retry = [];
      res.forEach((r, i) => {
        const t = todo[i];
        if (r.getResponseCode() === 200) {
          let id = ''; try { const o = JSON.parse(r.getContentText()); id = (o && typeof o.logoid === 'string') ? o.logoid : ''; } catch (e) {}
          if (id) map[t] = id; else retry.push(t);
        } else if (r.getResponseCode() === 429 || r.getResponseCode() >= 500) errors++;
        else retry.push(t);
      });
      retry.forEach(t => {            // plan B: búsqueda de símbolos
        try {
          const r = UrlFetchApp.fetch('https://symbol-search.tradingview.com/symbol_search/v3/?text=' + encodeURIComponent(t) + '&hl=1&lang=es&search_type=stock&domain=production&start=0',
            { muteHttpExceptions: true, headers: tvHeaders_() });
          let id = '';
          if (r.getResponseCode() === 200) {
            const o = JSON.parse(r.getContentText()), arr = (o.symbols || o || []);
            const hit = arr.find(s => String(s.symbol || '').toUpperCase() === t && (s.logoid || s.source_logoid)) || arr.find(s => s.logoid || s.source_logoid);
            if (hit) id = hit.logoid || hit.source_logoid || '';
            map[t] = id;              // '' = no encontrado (no se vuelve a preguntar)
          } else errors++;
        } catch (e) { errors++; }
      });
      P.setProperty('TV_LOGOS', JSON.stringify(map));
    }
    const out = {};
    tickers.forEach(t => { if (map[t]) out[t] = 'https://s3-symbol-logo.tradingview.com/' + map[t] + '--big.svg'; });
    return JSON.stringify({ logos: out, pending: errors ? 0 : tickers.filter(t => !(t in map)).length, missing: tickers.filter(t => map[t] === '').length, total: tickers.length });
  } catch (e) {
    return JSON.stringify({ error: String(e), logos: {}, pending: 0 });
  }
}
/** Borra la caché de logos de TradingView (por si quieres volver a consultarlos). */
function limpiarLogosTV() { PropertiesService.getScriptProperties().deleteProperty('TV_LOGOS'); }

/* ---------- Símbolos para logos: Empresas!B (Ticker) → Empresas!«API» ---------- */
function readSyms_() {
  try {
    const sh = SpreadsheetApp.openById(CONFIG.EMPRESAS_ID).getSheetByName(CONFIG.EMPRESAS_TAB);
    const vals = sh.getDataRange().getValues(), h = vals[1].map(norm_);
    const iT = h.indexOf('ticker'), iA = h.lastIndexOf('api'), out = {};
    if (iT < 0 || iA < 0) return {};
    for (let r = 2; r < vals.length; r++) {
      const t = String(vals[r][iT] || '').trim().toUpperCase(), a = String(vals[r][iA] || '').trim();
      if (t && a && a.indexOf('#') < 0) out[t] = a;
    }
    return out;
  } catch (e) { return {}; }   // sin acceso a la hoja de origen: el cliente usa el ticker + prefijo de mercado
}

/* ---------- Histórico de precios (GOOGLEFINANCE semanal en _Hist) ---------- */
function histInfo_(lots, emp) {
  const byT = {}; emp.forEach(e => byT[e.t] = e);
  const tickers = [...new Set(lots.map(l => l.t))].filter(t => byT[t] && byT[t].prefix).sort();
  const ccys = [...new Set(tickers.map(t => byT[t].ccy).filter(c => c && c !== 'EUR'))].sort();
  return { byT, tickers, ccys };
}

/** Devuelve ',' o ';' según acepte la hoja (en configuración regional española hace falta ';'). */
function formulaSep_(sh) {
  const c = sh.getRange(1, 1);
  c.setFormula('=SUM(1,2)'); SpreadsheetApp.flush();
  const ok = c.getValue() === 3;
  c.clear();
  return ok ? ',' : ';';
}

function buildHistory() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID), tz = ss.getSpreadsheetTimeZone();
  const op = readOper_(ss, tz), emp = readEmp_(ss, tz), info = histInfo_(op.lots, emp);
  const first = op.lots.reduce((m, l) => l.fc < m ? l.fc : m, '9999-12-31');
  const d0 = new Date(first + 'T00:00:00Z'); d0.setUTCDate(d0.getUTCDate() - 10);
  let SPx = ',';   // se corrige tras detectar el separador
  const dateF = SP => 'DATE(' + d0.getUTCFullYear() + SP + (d0.getUTCMonth() + 1) + SP + d0.getUTCDate() + ')';

  let sh = ss.getSheetByName(CONFIG.HIST);
  if (sh) sh.clear(); else { sh = ss.insertSheet(CONFIG.HIST); sh.hideSheet(); }
  const SP = formulaSep_(sh);
  const blocks = info.tickers.length + info.ccys.length;
  if (sh.getMaxColumns() < blocks * 3) sh.insertColumnsAfter(sh.getMaxColumns(), blocks * 3 - sh.getMaxColumns());
  if (sh.getMaxRows() < 1500) sh.insertRowsAfter(sh.getMaxRows(), 1500 - sh.getMaxRows());

  let c = 1;
  info.tickers.forEach(t => {
    const e = info.byT[t];
    sh.getRange(1, c).setValue(t + '|' + e.ccy + '|' + e.prefix);
    sh.getRange(2, c).setFormula('=IFERROR(GOOGLEFINANCE("' + e.prefix + t + '"' + SP + '"close"' + SP + dateF(SP) + SP + 'TODAY()' + SP + '"WEEKLY")' + SP + '"")');
    c += 3;
  });
  info.ccys.forEach(cc => {
    sh.getRange(1, c).setValue('FX|' + cc);
    sh.getRange(2, c).setFormula('=IFERROR(GOOGLEFINANCE("CURRENCY:' + cc + 'EUR"' + SP + '"price"' + SP + dateF(SP) + SP + 'TODAY()' + SP + '"WEEKLY")' + SP + '"")');
    c += 3;
  });
  SpreadsheetApp.flush();

  // Espera a que GOOGLEFINANCE termine de calcular (máx. ~100 s)
  let loading = true;
  for (let k = 0; k < 12 && loading; k++) {
    Utilities.sleep(8000);
    const row = sh.getRange(3, 1, 1, blocks * 3).getValues()[0];
    loading = row.some(v => /Loading|Cargando/.test(String(v)));
  }
  const err = sh.getRange(2, 1, 1, blocks * 3).getValues()[0].some(v => /#ERROR|#NAME|#VALUE/.test(String(v)));
  if (err) return { status: 'error', sep: SP, tickers: info.tickers.length, currencies: info.ccys };
  PropertiesService.getScriptProperties().setProperty('histSig', info.tickers.join(',') + '|' + first);
  return { status: loading ? 'pending' : 'ok', sep: SP, tickers: info.tickers.length, currencies: info.ccys };
}

function readHist_(lots, emp, tz, ss) {
  ss = ss || SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sh = ss.getSheetByName(CONFIG.HIST);
  if (!sh || sh.getLastRow() < 2) return null;
  const vals = sh.getDataRange().getValues(), head = vals[0], px = {}, fx = {};
  for (let c = 0; c < head.length; c += 3) {
    const key = String(head[c] || ''); if (!key) continue;
    const pts = [];
    for (let r = 2; r < vals.length; r++) {
      const d = vals[r][c], v = vals[r][c + 1];
      const day = d instanceof Date ? Utilities.formatDate(d, tz, 'yyyy-MM-dd')
        : (typeof d === 'number' && d > 20000 ? new Date((Math.floor(d) - 25569) * 86400000).toISOString().slice(0, 10) : null);
      if (day && typeof v === 'number' && v > 0) pts.push([day, v]);
    }
    const p = key.split('|');
    if (p[0] === 'FX') fx[p[1]] = pts;
    else px[p[0]] = { ccy: p[1], div: p[2] === 'LON:' ? 100 : 1, pts };
  }
  const info = histInfo_(lots, emp);
  const first = lots.reduce((m, l) => l.fc < m ? l.fc : m, '9999-12-31');
  const sig = info.tickers.join(',') + '|' + first;
  const stale = PropertiesService.getScriptProperties().getProperty('histSig') !== sig;
  const missing = info.tickers.filter(t => !px[t] || !px[t].pts.length);
  const noEmp = [...new Set(lots.map(l => l.t))].filter(t => !info.tickers.includes(t));
  return { px, fx, stale, missing, noEmp };
}

/* ---------- Caché de la parte "fija" (nada que dependa de la cotización) ----------
 * Se guardan operaciones, lotes, opciones, dividendos cobrados y símbolos: solo cambian cuando editas la hoja.
 * Cartera (precios, valor, PyG), Rend., Emp. (incluye divisas) e histórico de precios se leen SIEMPRE en vivo.
 * La caché se descarta sola a los 30 min, si cambia el tamaño de las pestañas, o al pulsar actualizar (fresh). */
const CACHE_TTL_ = 1800, CACHE_CHUNK_ = 30000;
function cacheGet_(k) {
  try {
    const c = CacheService.getScriptCache(), n = +c.get(k + '#n');
    if (!n) return null;
    const keys = []; for (let i = 0; i < n; i++) keys.push(k + '#' + i);
    const m = c.getAll(keys); let s = '';
    for (let i = 0; i < n; i++) { const p = m[k + '#' + i]; if (p == null) return null; s += p; }
    return s;
  } catch (e) { return null; }
}
function cachePut_(k, s) {
  try {
    const c = CacheService.getScriptCache(), o = {}; let n = 0;
    for (let i = 0; i < s.length; i += CACHE_CHUNK_) o[k + '#' + (n++)] = s.slice(i, i + CACHE_CHUNK_);
    o[k + '#n'] = String(n);
    c.putAll(o, CACHE_TTL_);
  } catch (e) {}
}
function cacheClear() {   // por si quieres vaciarla a mano desde el editor
  const c = CacheService.getScriptCache(), n = +c.get('static#n') || 0, keys = ['static#n'];
  for (let i = 0; i < n; i++) keys.push('static#' + i);
  c.removeAll(keys);
}
function staticSig_(ss) {
  return [CONFIG.OPER, CONFIG.DIV, 'Opc.'].map(n => { const sh = ss.getSheetByName(n); return sh ? sh.getLastRow() + 'x' + sh.getLastColumn() : '0'; }).join('|');
}
function readStatic_(ss, tz, fresh, T) {
  const sig = staticSig_(ss);
  if (!fresh) {
    const t = cacheGet_('static');
    if (t) { try { const o = JSON.parse(t); if (o.sig === sig) { T.cache = 'hit'; return o.d; } } catch (e) {} }
  }
  T.cache = fresh ? 'fresh' : 'miss';
  const op = readOper_(ss, tz);
  const d = { lots: op.lots, movs: op.movs, skipped: op.skipped, tipos: op.tipos, opc: readOpc_(ss, tz), divs: readDiv_(ss, tz), syms: readSyms_() };
  cachePut_('static', JSON.stringify({ sig, d }));
  return d;
}

/* ---------- Punto de entrada ---------- */
function loadAll(fresh) {
  const t0 = Date.now(), T = { ms: {} }, lap = (k, t) => { T.ms[k] = Date.now() - t; return Date.now(); };
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID), tz = ss.getSpreadsheetTimeZone();
  let t = lap('abrir', t0);
  const st = readStatic_(ss, tz, !!fresh, T); t = lap('fija', t);
  const car = readCartera_(ss); t = lap('cartera', t);
  const emp = readEmp_(ss, tz); t = lap('emp', t);
  const rend = readRend_(ss, tz); t = lap('rend', t);
  const hist = readHist_(st.lots, emp, tz, ss); t = lap('hist', t);
  T.total = Date.now() - t0;
  const res = {
    positions: car.positions, totals: car.totals,
    lots: st.lots, movs: st.movs, opc: st.opc, skipped: st.skipped, tipos: st.tipos,
    divs: st.divs, rend, emp, syms: st.syms, hist,
    today: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'),
    divNeto: CONFIG.DIV_RESTA_DESTINO ? 'bruto − ret. origen − ret. destino − comisión' : 'bruto − ret. origen − comisión',
    timing: T
  };
  // Como texto JSON: evita que google.script.run devuelva null por NaN/Date/etc. (NaN pasa a null)
  return JSON.stringify(res);
}


/* Comparativa con índices (rentabilidad total): ETFs acumulativos/precio ajustado por dividendos de Yahoo Finance, cierres semanales */
const BENCH_ = [
  { k: 'sp',   name: 'S&P 500',            syms: ['SXR8.DE', '^SP500TR', 'VOO'] },
  { k: 'ibex', name: 'IBEX 35',            syms: ['LYXIB.MC', '^IBEX'] },
  { k: 'msci', name: 'MSCI World',         syms: ['IWDA.AS', 'EUNL.DE', 'URTH'] },
  { k: 'dya',  name: 'Div. Aristocrats',   syms: ['SPYD.DE', 'NOBL'] }
];
function benchFetch_(sym) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=max&interval=1d&events=div%2Csplit';
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (r.getResponseCode() !== 200) return null;
  const j = JSON.parse(r.getContentText()), res = j && j.chart && j.chart.result && j.chart.result[0];
  if (!res || !res.timestamp) return null;
  const adj = res.indicators.adjclose && res.indicators.adjclose[0] && res.indicators.adjclose[0].adjclose, cl = res.indicators.quote[0].close, ts = res.timestamp, wk = {};
  ts.forEach((t, i) => {
    const v = adj ? adj[i] : cl[i]; if (v == null || !isFinite(v)) return;
    const d = new Date(t * 1000), mon = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 864e5);
    wk[Utilities.formatDate(mon, 'UTC', 'yyyy-MM-dd')] = [Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'), Math.round(v * 10000) / 10000];
  });
  const pts = Object.keys(wk).sort().map(k => wk[k]);
  return pts.length > 10 ? { cur: res.meta && res.meta.currency, pts } : null;
}
function loadBench() {
  const C = CacheService.getScriptCache(), out = {}, errors = [];
  BENCH_.forEach(b => {
    let hit = null; try { hit = JSON.parse(C.get('BM_' + b.k) || 'null'); } catch (e) {}
    if (!hit) {
      for (const s of b.syms) {
        try { const o = benchFetch_(s); if (o) { hit = { name: b.name, sym: s, cur: o.cur, pts: o.pts }; break; } } catch (e) {}
      }
      if (hit) { try { C.put('BM_' + b.k, JSON.stringify(hit), 21600); } catch (e) {} }
    }
    if (hit) out[b.k] = hit; else errors.push(b.name);
  });
  return JSON.stringify({ bench: out, errors });
}
