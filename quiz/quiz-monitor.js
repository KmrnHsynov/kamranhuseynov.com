'use strict';

const MONITOR_MAX_EVENTS = 100;

// `initial` restores a saved session: {tabSwitches, timeAway, pastes, events, elapsed (seconds)}
function createMonitor(limit, nowFn, initial){
  const now = nowFn || (() => Date.now());
  const init = initial || {};
  const startedAt = now() - (init.elapsed || 0) * 1000;
  let awaySince = null;
  const s = {
    tabSwitches: init.tabSwitches || 0,
    timeAway: init.timeAway || 0,
    pastes: init.pastes || 0,
    events: (init.events || []).slice(0, MONITOR_MAX_EVENTS)
  };

  function secs(ms){ return Math.round(ms / 1000); }
  function log(type){
    if(s.events.length < MONITOR_MAX_EVENTS) s.events.push({ type, t: secs(now() - startedAt) });
  }

  return {
    leave(){
      if(awaySince !== null) return null;
      awaySince = now();
      s.tabSwitches++;
      log('leave');
      return { count: s.tabSwitches, reached: limit > 0 && s.tabSwitches >= limit };
    },
    back(){
      if(awaySince === null) return null;
      s.timeAway += secs(now() - awaySince);
      awaySince = null;
      return { count: s.tabSwitches };
    },
    paste(){ s.pastes++; log('paste'); },
    copy(){ log('copy'); },
    stats(){
      return {
        tabSwitches: s.tabSwitches,
        timeAway: s.timeAway + (awaySince !== null ? secs(now() - awaySince) : 0),
        pastes: s.pastes,
        events: s.events.slice()
      };
    }
  };
}

if(typeof module !== 'undefined') module.exports = { createMonitor };
