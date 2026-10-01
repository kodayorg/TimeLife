const {test}=require('node:test'),assert=require('node:assert/strict');
const {plan}=require('../src/ui/event-move.js');
const {editICS,expand}=require('../src/core/calendar.cjs');
const base={title:'Move',start:'2026-10-02T09:00:00Z',end:'2026-10-02T10:30:00Z',zone:'Europe/Moscow',calendarId:'local'};
test('month move keeps local time, duration and event metadata',()=>{
 const e={...base,id:'a',etag:'v1',revision:2,description:'Notes'};
 const r=plan(e,'2026-10-02','2026-10-04','Europe/Moscow');
 assert.equal(r.input.start,'2026-10-04T12:00:00');assert.equal(r.input.end,'2026-10-04T13:30:00');assert.equal(r.input.etag,'v1');assert.equal(r.input.revision,2);assert.equal(r.input.description,'Notes');assert.equal(r.scope,'series');
});
test('week move snaps to supplied time in display zone and preserves original zone',()=>{
 const r=plan({...base,zone:'Asia/Tokyo'},'2026-10-02','2026-10-03','Europe/Moscow',615);
 assert.equal(r.input.start,'2026-10-03T16:15:00');assert.equal(r.input.end,'2026-10-03T17:45:00');
});
test('multi-day and all-day drags shift from the grabbed day, with exclusive end intact',()=>{
 const e={...base,allDay:true,start:'2026-10-02',end:'2026-10-05'};
 const r=plan(e,'2026-10-03','2026-10-04','Europe/Moscow',600);
 assert.equal(r.input.start,'2026-10-03');assert.equal(r.input.end,'2026-10-06');
});
test('floating moves preserve wall time and unchanged drops do not save',()=>{
 const e={...base,zone:'floating',start:'2026-10-02T12:00:00',end:'2026-10-02T13:30:00'};
 assert.equal(plan(e,'2026-10-02','2026-10-02','Asia/Tokyo').changed,false);
 const r=plan(e,'2026-10-02','2026-10-03','Asia/Tokyo');assert.equal(r.input.start,'2026-10-03T12:00:00');
 const ics=editICS(r.input);assert.ok(ics.includes('DTSTART:20261003T120000'));assert.equal(expand([{id:'f',calendarId:'local',ics}],'2026-10-01T00:00:00+09:00','2026-10-05T00:00:00+09:00').events[0].zone,'floating');
});
test('dragging a recurrence moves only its selected occurrence',()=>{
 const input={...base,start:'2026-10-02T12:00',end:'2026-10-02T13:30',recurrence:'FREQ=WEEKLY;COUNT=3'};
 const ics=editICS(input),resources=ics=>[{id:'a',calendarId:'local',ics}];
 const from='2026-10-01T00:00:00Z',to='2026-11-01T00:00:00Z';
 const e=expand(resources(ics),from,to).events[1],r=plan(e,'2026-10-09','2026-10-10','Europe/Moscow',900);
 const changed=expand(resources(editICS(r.input,ics,r.scope)),from,to).events;
 assert.equal(r.scope,'occurrence');assert.deepEqual(changed.map(e=>e.start),['2026-10-02T09:00:00.000Z','2026-10-10T12:00:00.000Z','2026-10-16T09:00:00.000Z']);
});
test('moves keep duration over DST and reject nonexistent target wall time',()=>{
 const e={...base,zone:'Europe/Berlin',start:'2026-10-24T10:00:00Z',end:'2026-10-24T11:30:00Z'};
 const r=plan(e,'2026-10-24','2026-10-25','Europe/Berlin');assert.equal(r.input.start,'2026-10-25T12:00:00');assert.equal(r.input.end,'2026-10-25T13:30:00');
 assert.throws(()=>plan(e,'2026-10-24','2026-03-29','Europe/Berlin',150),/перевода часов/);
});
