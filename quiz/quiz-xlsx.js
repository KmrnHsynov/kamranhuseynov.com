'use strict';

// Reads the cells of an .xlsx workbook with no library. An .xlsx is a zip of XML files, so this
// finds the files in the zip, inflates them with the browser's built-in DecompressionStream
// (also in Node 18+) and pulls the cell values out of the XML.
// Only values are read: formulas give their last calculated result, formatting is ignored.

const XLSX_ERR = {
  notXlsx:   'Bu fayl düzgün .xlsx faylı deyil. Excel-də "Fərqli saxla" ilə .xlsx və ya CSV UTF-8 seçin.',
  encrypted: 'Parolla qorunan fayl oxuna bilmir. Parolu çıxarıb yenidən saxlayın.',
  noInflate: 'Brauzeriniz .xlsx faylını oxuya bilmir. Faylı CSV UTF-8 kimi saxlayıb yükləyin.',
  noSheets:  'Faylda vərəq tapılmadı.'
};
const XLSX_MAX_ROWS = 5000, XLSX_MAX_COLS = 60;

// ── the zip container ─────────────────────────────────

function xlsxOpenZip(input){
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // The "end of central directory" record is within the last 64 KB.
  let eocd = -1;
  for(let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--){
    if(dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error(XLSX_ERR.notXlsx);
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const entries = new Map();
  for(let n = 0; n < count; n++){
    if(p + 46 > b.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error(XLSX_ERR.notXlsx);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
    entries.set(new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen)), {
      flags: dv.getUint16(p + 8, true), method: dv.getUint16(p + 10, true),
      csize: dv.getUint32(p + 20, true), offset: dv.getUint32(p + 42, true)
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { b, dv, entries };
}

async function xlsxInflate(data){
  if(typeof DecompressionStream === 'undefined') throw new Error(XLSX_ERR.noInflate);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function xlsxFileText(zip, name){
  const e = zip.entries.get(name);
  if(!e) return null;
  if(e.flags & 1) throw new Error(XLSX_ERR.encrypted);
  const { dv, b } = zip;
  if(e.offset + 30 > b.length || dv.getUint32(e.offset, true) !== 0x04034b50) throw new Error(XLSX_ERR.notXlsx);
  const start = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true);
  const raw = b.subarray(start, start + e.csize);
  let bytes;
  if(e.method === 0) bytes = raw;
  else if(e.method === 8) bytes = await xlsxInflate(raw);
  else throw new Error(XLSX_ERR.notXlsx);
  return new TextDecoder('utf-8').decode(bytes);
}

// ── the XML inside ────────────────────────────────────

function xlsxUnescape(s){
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) => {
    if(e[0] === '#'){
      const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e];
  });
}

// All the text of one <si> or <is> item: its <t> pieces joined, skipping phonetic hints.
function xlsxItemText(xml){
  const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let out = '', m;
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  while((m = re.exec(clean)) !== null) out += m[1];
  return xlsxUnescape(out);
}

function xlsxSharedStrings(xml){
  if(!xml) return [];
  const list = [];
  const re = /<si\b[^>]*\/>|<si\b[^>]*>([\s\S]*?)<\/si>/g;   // the self-closing form first: <si/> is an empty string
  let m;
  while((m = re.exec(xml)) !== null) list.push(m[1] === undefined ? '' : xlsxItemText(m[1]));
  return list;
}

function xlsxColumn(ref){
  let n = 0;
  for(const ch of ref.replace(/[^A-Za-z]/g, '').toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function xlsxAttr(attrs, name){
  const m = attrs.match(new RegExp('(?:^|\\s)' + name + '="([^"]*)"'));
  return m ? m[1] : null;
}

function xlsxSheetRows(xml, shared){
  const rows = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rm, rowNo = 0;
  while((rm = rowRe.exec(xml)) !== null){
    const r = xlsxAttr(rm[1], 'r');
    rowNo = r ? parseInt(r, 10) : rowNo + 1;
    if(!rm[2] || rowNo > XLSX_MAX_ROWS) continue;
    const cells = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm, col = -1;
    while((cm = cellRe.exec(rm[2])) !== null){
      const ref = xlsxAttr(cm[1], 'r');
      col = ref ? xlsxColumn(ref) : col + 1;
      if(!cm[2] || col >= XLSX_MAX_COLS) continue;
      const type = xlsxAttr(cm[1], 't');
      const body = cm[2];
      const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let text = '';
      if(type === 'inlineStr') text = xlsxItemText((body.match(/<is>([\s\S]*?)<\/is>/) || [])[1] || '');
      else if(v === undefined) text = '';
      else if(type === 's') text = shared[parseInt(v, 10)] || '';
      else if(type === 'b') text = v === '1' ? 'TRUE' : 'FALSE';
      else if(type === 'str' || type === 'e') text = xlsxUnescape(v);
      else { const num = Number(v); text = Number.isFinite(num) ? String(num) : xlsxUnescape(v); }   // 2 stays "2", not "2.0"
      cells[col] = text;
    }
    // gaps between filled cells become empty strings, so columns line up
    rows[rowNo - 1] = Array.from(cells, c => c === undefined ? '' : c);
  }
  return Array.from(rows, r => r || []);
}

function xlsxResolveTarget(target){
  return target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
}

// ArrayBuffer of an .xlsx -> [{ name, rows: [[cell, ...], ...] }] in workbook order
async function xlsxReadSheets(buffer){
  const zip = xlsxOpenZip(buffer);
  const shared = xlsxSharedStrings(await xlsxFileText(zip, 'xl/sharedStrings.xml'));

  // Sheet order and names come from the workbook; the files themselves from its relationships.
  let sheets = [];
  const wb = await xlsxFileText(zip, 'xl/workbook.xml');
  const rels = await xlsxFileText(zip, 'xl/_rels/workbook.xml.rels');
  if(wb && rels){
    const targets = {};
    for(const m of rels.matchAll(/<Relationship\b([^>]*?)\/?>/g)){
      const id = xlsxAttr(m[1], 'Id'), target = xlsxAttr(m[1], 'Target');
      if(id && target) targets[id] = xlsxResolveTarget(target);
    }
    for(const m of wb.matchAll(/<sheet\b([^>]*?)\/?>/g)){
      const rid = xlsxAttr(m[1], 'r:id') || xlsxAttr(m[1], 'id');
      if(rid && targets[rid]) sheets.push({ name: xlsxUnescape(xlsxAttr(m[1], 'name') || ''), file: targets[rid] });
    }
  }
  if(!sheets.length){
    sheets = [...zip.entries.keys()].filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()
      .map(n => ({ name: n.replace(/^.*\//, ''), file: n }));
  }
  if(!sheets.length) throw new Error(XLSX_ERR.noSheets);

  const out = [];
  for(const s of sheets){
    const xml = await xlsxFileText(zip, s.file);
    if(xml !== null) out.push({ name: s.name, rows: xlsxSheetRows(xml, shared) });
  }
  if(!out.length) throw new Error(XLSX_ERR.noSheets);
  return out;
}

if(typeof module !== 'undefined') module.exports = { xlsxReadSheets, XLSX_ERR };
