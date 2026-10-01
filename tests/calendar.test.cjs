const { test } = require('node:test');
const assert = require('node:assert/strict');
const { editICS, expand, parse, deleteOccurrence } = require('../src/core/calendar.cjs');
const base = { title: 'Тренажерный зал', start: '2026-10-02T12:00', end: '2026-10-02T13:00', zone: 'Europe/Moscow', recurrence: '' };
const range = (ics, from='2026-10-01T00:00:00+03:00', to='2026-11-01T00:00:00+03:00') => expand([{id:'test',calendarId:'local',ics}],from,to);
test('Unicode, UTC conversion and unknown properties survive edits', () => {
  let ics = editICS({...base, description:'Текст, с; запятой\nНовая строка'});
  ics = ics.replace('END:VEVENT', 'X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC\r\nEND:VEVENT');
  const m = range(ics).events[0]; assert.equal(m.start,'2026-10-02T09:00:00.000Z');
  const result = editICS({...base,uid:m.uid,title:'Обновление'},ics);
  assert.ok(result.includes('X-APPLE-TRAVEL')); assert.equal(range(result).events[0].description,'');
  assert.equal(range(ics).events[0].description,'Текст, с; запятой\nНовая строка');
});
test('weekly recurrence stays at the same local time across DST', () => {
  const r = range(editICS({...base,start:'2026-10-18T12:00',end:'2026-10-18T13:00',zone:'Europe/Berlin',recurrence:'FREQ=WEEKLY;COUNT=3'}),'2026-10-01T00:00:00Z','2026-11-10T00:00:00Z');
  assert.equal(r.errors.length,0); assert.deepEqual(r.events.map(x=>x.start),['2026-10-18T10:00:00.000Z','2026-10-25T11:00:00.000Z','2026-11-01T11:00:00.000Z']);
});
test('edit a single occurrence and keep master and other occurrences', () => {
  const ics = editICS({...base,recurrence:'FREQ=WEEKLY;COUNT=3'}), second = range(ics).events[1];
  const edited = editICS({...base,uid:second.uid,occurrence:second.occurrence,start:'2026-10-09T15:00',end:'2026-10-09T16:00',title:'Перенесено'},ics,'occurrence');
  const r = range(edited); assert.equal(r.errors.length,0); assert.equal(r.events.length,3); assert.equal(r.events[1].title,'Перенесено'); assert.equal(r.events[1].start,'2026-10-09T12:00:00.000Z'); assert.equal(r.events[1].seriesStart,'2026-10-02T09:00:00.000Z'); assert.equal(r.events[0].title,base.title);
});
test('delete single occurrence uses EXDATE without deleting series', () => {
  const ics=editICS({...base,recurrence:'FREQ=WEEKLY;COUNT=3'}), second=range(ics).events[1];
  const r=range(deleteOccurrence(ics,second.uid,second.occurrence)); assert.equal(r.errors.length,0); assert.equal(r.events.length,2); assert.ok(!r.events.some(x=>x.occurrence===second.occurrence));
});
test('moved exception is shown even if its original recurrence-id is outside range', () => {
  const ics=editICS({...base,recurrence:'FREQ=WEEKLY;COUNT=3'}), first=range(ics).events[0];
  const edited=editICS({...base,uid:first.uid,occurrence:first.occurrence,start:'2026-11-02T12:00',end:'2026-11-02T13:00',title:'Ноябрь'},ics,'occurrence');
  const r=range(edited,'2026-11-01T00:00:00Z','2026-11-10T00:00:00Z'); assert.equal(r.events.length,1); assert.equal(r.events[0].title,'Ноябрь');
});
test('all-day events use exclusive end and date values', () => {
  const ics=editICS({...base,allDay:true,start:'2026-10-02',end:'2026-10-04'}); assert.ok(ics.includes('DTSTART;VALUE=DATE:20261002')); const r=range(ics); assert.equal(r.events[0].end,'2026-10-04'); assert.equal(r.events[0].allDay,true);
});
test('monthly BYDAY and COUNT are supported',()=>{
  const r=range(editICS({...base,recurrence:'FREQ=MONTHLY;BYDAY=1FR;COUNT=3'}),'2026-10-01T00:00:00Z','2027-01-01T00:00:00Z'); assert.equal(r.events.length,3); assert.deepEqual(r.events.map(x=>x.start.slice(0,10)),['2026-10-02','2026-11-06','2026-12-04']);
});
test('reject nonexistent DST time and invalid end',()=>{
  assert.throws(()=>editICS({...base,zone:'Europe/Berlin',start:'2026-03-29T02:30',end:'2026-03-29T04:00'}),/перевода часов/);
  assert.throws(()=>editICS({...base,end:base.start}),/позже/);
});
test('floating calendar events remain floating in the display model',()=>{
  const ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:f\r\nDTSTART:20261002T120000\r\nDTEND:20261002T130000\r\nSUMMARY:Floating\r\nEND:VEVENT\r\nEND:VCALENDAR'; const e=range(ics).events[0]; assert.equal(e.zone,'floating'); assert.equal(e.start,'2026-10-02T12:00:00');
});
test('attendee invitations are read-only and malformed resources do not hide good ones',()=>{
  const invite=editICS(base).replace('END:VEVENT','ORGANIZER:mailto:a@example.com\r\nATTENDEE:mailto:b@example.com\r\nEND:VEVENT'); assert.equal(range(invite).events[0].readOnly,true); assert.throws(()=>editICS(base,invite),/приглашений/);
  const r=expand([{id:'bad',ics:'invalid'},{id:'good',ics:editICS(base)}],'2026-10-01T00:00:00Z','2026-11-01T00:00:00Z'); assert.equal(r.events.length,1); assert.equal(r.errors.length,1);
});

test('personal iCloud organizer metadata does not restrict editing or occurrence deletion',()=>{
  for (const recurrence of ['', 'FREQ=WEEKLY;COUNT=3']) {
    const ics=editICS({...base,recurrence}).replace('END:VEVENT','ORGANIZER:mailto:owner@example.com\r\nEND:VEVENT');
    const e=range(ics).events[0]; assert.equal(e.readOnly,false);
    const edited=editICS({...base,uid:e.uid,recurrence,title:'Changed',occurrence:e.occurrence},ics,recurrence?'occurrence':'series');
    assert.equal(range(edited).events[0].title,'Changed');
    assert.ok(edited.includes('ORGANIZER:mailto:owner@example.com'));
    assert.ok(range(edited).events.every(x=>!x.readOnly));
    if (recurrence) assert.equal(range(deleteOccurrence(edited,e.uid,e.occurrence)).events.length,2);
  }
});
test('participants on recurrence exceptions protect the entire resource',()=>{
  const ics=editICS({...base,recurrence:'FREQ=WEEKLY;COUNT=3'}), e=range(ics).events[1];
  const edited=editICS({...base,uid:e.uid,occurrence:e.occurrence},ics,'occurrence');
  const cal=parse(edited); cal.getAllSubcomponents('vevent')[1].updatePropertyWithValue('attendee','mailto:guest@example.com');
  const invite=cal.toString(); assert.ok(range(invite).events.every(x=>x.readOnly));
  assert.throws(()=>editICS({...base,uid:e.uid},invite),/приглашений/);
  assert.throws(()=>editICS({...base,uid:e.uid,occurrence:e.occurrence},invite,'occurrence'),/приглашений/);
  assert.throws(()=>deleteOccurrence(invite,e.uid,e.occurrence),/нельзя удалить/);
});
