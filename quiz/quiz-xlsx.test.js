const test = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');
const { xlsxReadSheets, XLSX_ERR } = require('./quiz-xlsx.js');
const { parseQuestionsSheets, parseQuestionsCsv } = require('./quiz-csv.js');

// A minimal zip writer, so the tests can build workbooks of any shape without a library.
function buildZip(files, opts = {}) {
  const locals = [], centrals = [];
  let offset = 0, count = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const deflate = (opts.deflate || []).includes(name);
    const comp = deflate ? zlib.deflateRawSync(data) : data;
    const nameBuf = Buffer.from(name);
    const flags = opts.encrypt ? 1 : 0, method = deflate ? 8 : 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(flags, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBuf.length, 26);
    locals.push(lh, nameBuf, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(flags, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
    count++;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(count, 8); eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const workbook = `<?xml version="1.0"?><workbook ${NS}><sheets><sheet name="Info &amp; Notes" sheetId="1" r:id="rId1"/><sheet name="Quiz" sheetId="2" r:id="rId2"/></sheets></workbook>`;
const rels = `<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="x" Target="/xl/worksheets/sheet2.xml"/></Relationships>`;
const shared = `<sst ${NS}>
  <si><t>plain</t></si>
  <si><r><rPr><b/></rPr><t>Bo</t></r><r><t xml:space="preserve">ld text</t></r></si>
  <si><t>日本</t><rPh sb="0" eb="1"><t>ニホン</t></rPh></si>
  <si><t>R&amp;D &lt;b&gt; &#252;&#x259;</t></si>
  <si/>
  <si><t>Sual</t></si><si><t>Cavab 1</t></si>
</sst>`;
const sheet1 = `<worksheet ${NS}><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>`;
const sheet2 = `<worksheet ${NS}><sheetData>
  <row r="1"><c r="A1" t="s"><v>5</v></c><c r="C1" t="s"><v>6</v></c></row>
  <row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3" t="n"><v>2</v></c><c r="C3"><v>0.5</v></c><c r="D3" t="b"><v>1</v></c><c r="E3" t="b"><v>0</v></c></row>
  <row r="4"><c r="A4" t="inlineStr"><is><t>inline</t></is></c><c r="B4" t="str"><f>A1&amp;A1</f><v>fx result</v></c><c r="C4" s="2"/><c r="D4" t="e"><v>#N/A</v></c><c r="F4"><f>1+1</f><v>2</v></c></row>
  <row r="5"><c r="A5" t="s"><v>2</v></c><c r="B5" t="s"><v>3</v></c><c r="C5" t="s"><v>4</v></c><c r="D5"><v>1E+2</v></c><c r="E5"><v>20.0</v></c></row>
</sheetData></worksheet>`;
const files = { 'xl/workbook.xml': workbook, 'xl/_rels/workbook.xml.rels': rels, 'xl/sharedStrings.xml': shared, 'xl/worksheets/sheet1.xml': sheet1, 'xl/worksheets/sheet2.xml': sheet2 };

test('sheets come back in workbook order with their names (names are XML-decoded)', async () => {
  const sheets = await xlsxReadSheets(buildZip(files));
  assert.deepStrictEqual(sheets.map(s => s.name), ['Info & Notes', 'Quiz']);
  assert.deepStrictEqual(sheets[0].rows, [['plain']]);
});

test('every cell type is read, and gaps keep the columns lined up', async () => {
  const rows = (await xlsxReadSheets(buildZip(files)))[1].rows;
  assert.deepStrictEqual(rows[0], ['Sual', '', 'Cavab 1']);                         // B1 missing -> ''
  assert.deepStrictEqual(rows[1], []);                                               // row 2 does not exist
  assert.deepStrictEqual(rows[2], ['Bold text', '2', '0.5', 'TRUE', 'FALSE']);       // rich text joined, number, boolean
  assert.deepStrictEqual(rows[3], ['inline', 'fx result', '', '#N/A', '', '2']);     // inline string, formula text, empty styled cell, error, formula number
  assert.deepStrictEqual(rows[4], ['日本', 'R&D <b> üə', '', '100', '20']);          // phonetic hint dropped, entities decoded, 1E+2 -> 100, 20.0 -> 20
});

test('deflated and stored entries give identical results', async () => {
  const plain = await xlsxReadSheets(buildZip(files));
  const packed = await xlsxReadSheets(buildZip(files, { deflate: Object.keys(files) }));
  assert.deepStrictEqual(packed, plain);
});

test('without a workbook file the sheets are found by their file names', async () => {
  const { 'xl/workbook.xml': _a, 'xl/_rels/workbook.xml.rels': _b, ...rest } = files;
  const sheets = await xlsxReadSheets(buildZip(rest));
  assert.deepStrictEqual(sheets.map(s => s.name), ['sheet1.xml', 'sheet2.xml']);
  assert.strictEqual(sheets[1].rows[0][0], 'Sual');
});

test('things that are not a workbook give a clear message', async () => {
  await assert.rejects(xlsxReadSheets(Buffer.from('this is plain text, not a zip file')), { message: XLSX_ERR.notXlsx });
  await assert.rejects(xlsxReadSheets(buildZip(files).subarray(0, 60)), { message: XLSX_ERR.notXlsx });
  await assert.rejects(xlsxReadSheets(buildZip({ 'readme.txt': 'hi' })), { message: XLSX_ERR.noSheets });
  await assert.rejects(xlsxReadSheets(buildZip(files, { encrypt: true })), { message: XLSX_ERR.encrypted });
});

// ── a file made by real Excel ─────────────────────────

const fixture = name => fs.readFileSync(path.join(__dirname, 'test-fixtures', name));

test('a workbook saved by Excel is read: the questions are on its second sheet', async () => {
  const sheets = await xlsxReadSheets(fixture('excel-made.xlsx'));
  assert.deepStrictEqual(sheets.map(s => s.name), ['Məlumat', 'Suallar']);
  const rows = sheets[1].rows;
  assert.match(rows[3][0], /^Question/);                       // header on row 4, below the instruction rows
  assert.deepStrictEqual(rows[4].slice(0, 7), ['What is 2+2?', '3', '4', '5', '6', '20', '2']);   // numbers read as "2", not "2.0"
  assert.strictEqual(rows[7][0], 'Bold part and R&D <b>');                                          // rich text and entities
  assert.deepStrictEqual(rows[8].slice(1, 3), ['TRUE', 'FALSE']);                                   // real Excel booleans
});

test('an Excel-made workbook imports as questions, skipping the sheet that has none', async () => {
  const r = parseQuestionsSheets(await xlsxReadSheets(fixture('excel-made.xlsx')));
  assert.deepStrictEqual(r.questions.map(q => q.type), ['mc', 'mc', 'mc', 'mc', 'tf']);
  const [q1, q2, q3, q4, q5] = r.questions;
  assert.strictEqual(q1.options[q1.correctOption], '4');
  assert.strictEqual(q2.text, 'Hansı ədədlər sadədir? (ə ş ı ğ ç ö ü)');
  assert.strictEqual(q2.needsReview, true);                                    // "1,3": two correct answers
  assert.strictEqual(q3.options[q3.correctOption], 'Paris');                   // the correct answer was a formula (=2-1)
  assert.deepStrictEqual(q3.options, ['Paris', 'Rome', '', '', '']);           // empty columns dropped
  assert.strictEqual(q4.options[q4.correctOption], 'Yes');
  assert.strictEqual(q5.tfAnswer, true);
  assert.strictEqual(r.encodingProblem, false);
});

test('the same data saved by Excel as xlsx and as CSV UTF-8 gives the same questions', async () => {
  const fromXlsx = parseQuestionsSheets(await xlsxReadSheets(fixture('excel-made.xlsx')));
  const fromCsv = parseQuestionsCsv(new TextDecoder('utf-8').decode(fixture('excel-utf8.csv')));
  assert.deepStrictEqual(fromXlsx.questions, fromCsv.questions);
});

test('Excel\'s plain "CSV (Comma delimited)" is reported as damaged', () => {
  const r = parseQuestionsCsv(new TextDecoder('utf-8').decode(fixture('excel-ansi.csv')));
  assert.strictEqual(r.encodingProblem, true);
});

test('a few question marks inside words count as damage, a single URL does not', () => {
  const head = 'Question,Answer 1,Answer 2,Correct answer(s)\n';
  assert.strictEqual(parseQuestionsCsv(head + 'Hans? ?d?dl?r sad?dir?,a,b,1\n').encodingProblem, true);
  assert.strictEqual(parseQuestionsCsv(head + 'Open page?x=1 in the browser,a,b,1\n').encodingProblem, false);
});

test('a workbook with no header row on any sheet says so', async () => {
  const noHeader = { ...files, 'xl/worksheets/sheet2.xml': sheet1 };
  await assert.rejects(async () => parseQuestionsSheets(await xlsxReadSheets(buildZip(noHeader))), /Başlıq sətri/);
});
