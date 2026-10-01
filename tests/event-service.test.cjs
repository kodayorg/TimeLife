const test=require('node:test'),assert=require('node:assert/strict');
const {EventService}=require('../src/core/event-service.cjs');
const {editICS,expand}=require('../src/core/calendar.cjs');
test('worker returns matching occurrences and handles edits, filtering and concurrent ranges',async()=>{
  const service=new EventService();
  const r={id:'one',calendarId:'local',revision:1,ics:editICS({title:'Recurring',start:'2026-10-02T12:00',end:'2026-10-02T13:00',zone:'Europe/Moscow',recurrence:'FREQ=WEEKLY'})};
  const from='2026-10-01T00:00:00+03:00',to='2026-11-01T00:00:00+03:00';
  try {
    const [oct,nov]=await Promise.all([service.get([r],from,to),service.get([r],to,'2026-12-01T00:00:00+03:00')]);
    assert.deepEqual(oct.events,expand([r],from,to).events.map(({raw,...e})=>e));assert.ok(nov.events.length>0);
    r.pending=true;r.revision=2;assert.equal((await service.get([r],from,to)).events[0].pending,true);
    r.ics=editICS({title:'Changed',start:'2026-10-02T15:00',end:'2026-10-02T16:00',zone:'Europe/Moscow'},r.ics);assert.equal((await service.get([r],from,to)).events[0].title,'Changed');
    assert.equal((await service.get([],from,to)).events.length,0);
  } finally {await service.close();}
});
