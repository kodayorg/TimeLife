const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { expand } = require('../src/core/calendar.cjs');
const { EventCache } = require('../src/core/event-cache.cjs');
// Synthetic data only; does not read or connect to an iCloud account.
const resources=Array.from({length:3000},(_,i)=>({id:`bench:${i}`,calendarId:'bench',revision:1,ics:`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:bench-${i}\r\nSUMMARY:Event ${i}\r\nDTSTART:20251002T090000Z\r\nDTEND:20251002T100000Z\r\n${i%10===0?'RRULE:FREQ=WEEKLY\r\n':''}END:VEVENT\r\nEND:VCALENDAR\r\n`}));
const from='2026-09-20T00:00:00+03:00',to='2026-11-16T00:00:00+03:00',cache=new EventCache();
const start=performance.now(),first=cache.get(resources,from,to),cold=performance.now()-start;
const repeat=performance.now();for(let i=0;i<20;i++) assert.equal(cache.get(resources,from,to),first);
const warm=(performance.now()-repeat)/20;
assert.deepEqual(first,expand(resources,from,to));assert.equal(first.errors.length,0);
const nextStart=performance.now();cache.get(resources,'2026-11-01T00:00:00+03:00','2027-01-01T00:00:00+03:00');const next=performance.now()-nextStart;
console.log(JSON.stringify({resources:resources.length,events:first.events.length,initialExpansionMs:Math.round(cold),newRangeMs:Math.round(next),cachedExpansionMs:Number(warm.toFixed(2)),sameResults:true}));
