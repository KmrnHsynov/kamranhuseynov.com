'use strict';

// When an exam can be started. opensAt / closesAt are millisecond timestamps, 0 or missing = no limit.
// closesAt is the last moment a NEW attempt may start; students already inside keep their own time.

function scheduleState(now, opensAt, closesAt){
  if(opensAt && now < opensAt) return 'before';
  if(closesAt && now > closesAt) return 'closed';
  return 'open';
}

// Value of an <input type="datetime-local"> ("2026-11-02T09:30", read as local time) -> timestamp, '' -> 0.
function parseLocalDateTime(value){
  if(!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function checkSchedule(opensAt, closesAt){
  if(opensAt && closesAt && closesAt <= opensAt) return 'Son başlama vaxtı açılış vaxtından sonra olmalıdır.';
  return null;
}

function formatWhen(ts){
  return new Date(ts).toLocaleString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Short description for lists, e.g. "Açılış: 02.11.2026 09:30".
function scheduleLabel(now, opensAt, closesAt){
  const state = scheduleState(now, opensAt, closesAt);
  if(state === 'before') return 'Açılış: ' + formatWhen(opensAt);
  if(state === 'closed') return 'Bağlanıb';
  if(closesAt) return 'Son başlama: ' + formatWhen(closesAt);
  return '';
}

if(typeof module !== 'undefined') module.exports = { scheduleState, parseLocalDateTime, checkSchedule, scheduleLabel };
