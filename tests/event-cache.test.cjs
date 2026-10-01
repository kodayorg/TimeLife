const test = require('node:test');
const assert = require('node:assert/strict');
const { EventCache } = require('../src/core/event-cache.cjs');
test('range cache reuses expansion and invalidates in-place event and sync changes', () => {
  let calls=0;const cache=new EventCache(2,(resources,from,to)=>({events:resources.map(r=>({...r})),from,to,call:++calls}));
  const resources=[{id:'one',calendarId:'local',ics:'first',revision:1}];
  const first=cache.get(resources,'a','b');assert.equal(cache.get(resources,'a','b'),first);
  for(const [key,value] of [['ics','second'],['revision',2],['pending',true],['etag','new'],['conflict',{}],['deleted',true],['calendarId','cloud']]) {
    const before=calls;resources[0][key]=value;cache.get(resources,'a','b');assert.equal(calls,before+1,key);
  }
  const before=calls;cache.get([],'a','b');assert.equal(calls,before+1);
});
test('range cache preserves timezone-sensitive bounds and evicts least recently used ranges', () => {
  let calls=0;const cache=new EventCache(2,()=>({call:++calls}));
  cache.get([],'2026-10-01T00:00+03:00','b');cache.get([],'2026-10-01T00:00-07:00','b');assert.equal(calls,2);
  cache.get([],'2026-10-01T00:00+03:00','b');cache.get([],'c','d');assert.equal(calls,3);
  cache.get([],'2026-10-01T00:00-07:00','b');assert.equal(calls,4);assert.equal(cache.ranges.size,2);
});
