'use strict';

// Results as a CSV file for a gradebook. Pure: the download itself lives in quiz-az.js.
// ';' is the default because Excel set to an Azerbaijani region splits columns on it.

const CSV_STATUS = { done: 'Bitirib', in_progress: 'Tamamlanmayıb', exited: 'Çıxıb', expired: 'Vaxtı bitib' };
const CSV_HEADER = ['Ad', 'Mövzu', 'Başlama', 'Status', 'Doğru', 'Yanlış', 'Cavabsız', 'Xal', 'Maksimum xal', 'Faiz',
  'Vaxt (san)', 'Çıxışlar', 'Kənarda (san)', 'Yapışdırma', 'Avto-göndərilib', 'Təkrar cəhd', 'Şübhəli'];

function csvCell(value, sep){
  let s = value == null ? '' : String(value);
  // A cell that starts with = + - @ can run as a formula when opened in a spreadsheet.
  if(/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if(s.includes(sep) || /["\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function recordsToCsv(records, opts){
  const sep = (opts && opts.sep) || ';';
  const formatDate = (opts && opts.formatDate) || (ts => ts ? new Date(ts).toLocaleString('az-AZ') : '');
  const rows = [CSV_HEADER].concat(records.map(r => {
    const graded = !r.ungraded;
    return [
      r.studentName || '',
      r.topic || '',
      formatDate(r.startedAt),
      CSV_STATUS[r.status] || r.status || '',
      graded ? r.correct : '',
      graded ? r.wrong : '',
      graded ? r.unanswered : '',
      graded ? r.score : '',
      graded ? r.maxScore : '',
      graded ? r.pct : '',
      r.timeUsed == null ? '' : r.timeUsed,
      r.tabSwitches || 0,
      r.timeAway || 0,
      r.pastes || 0,
      r.autoSubmitted ? 'Bəli' : 'Xeyr',
      r.repeatCount > 1 ? r.repeatCount : '',
      r.qidProblem ? 'Bəli' : ''
    ];
  }));
  return rows.map(row => row.map(c => csvCell(c, sep)).join(sep)).join('\r\n') + '\r\n';
}

if(typeof module !== 'undefined') module.exports = { recordsToCsv, csvCell, CSV_HEADER };
