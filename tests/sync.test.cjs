const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Store}=require('../src/core/store.cjs');
const {editICS,expand}=require('../src/core/calendar.cjs');
const {CalDAV,appleURL}=require('../src/core/caldav.cjs');
const input={title:'Локально',start:'2026-10-02T12:00',end:'2026-10-02T13:00',zone:'Europe/Moscow',calendarId:'https://p01-caldav.icloud.com/cal/'};
const cal={id:input.calendarId,name:'iCloud',writable:true,color:'#d996e8'};
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'calendar-u-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true})); const store=new Store(dir);store.data.calendars.push(cal);return store;}
function event(store){return expand(store.data.resources,'2026-10-01T00:00:00Z','2026-11-01T00:00:00Z').events[0];}
function fake(rows=[]){let calls=[];return {calls,rows,discover:async()=>[cal],inventory:async()=>rows,get:async id=>{const r=rows.find(x=>x.id===id);return r?{status:200,text:r.ics,etag:r.etag}:{status:404,text:'',etag:null};},put:async(id,ics,etag)=>{calls.push({id,ics,etag});const old=rows.find(x=>x.id===id);if(old?etag!==old.etag:etag!==null)return {status:412}; const next={id,ics,etag:'"new"',calendarId:cal.id}; rows.splice(rows.findIndex(x=>x.id===id)<0?rows.length:rows.findIndex(x=>x.id===id),old?1:0,next); return {status:201};},delete:async(id,etag)=>{const r=rows.find(x=>x.id===id);if(!r)return {status:404};if(r.etag!==etag)return {status:412};rows.splice(rows.indexOf(r),1);return {status:204};}};}
test('offline queue survives restart and new event is conditionally created',async t=>{const s=fixture(t);s.upsert(input,'series');const reloaded=new Store(path.dirname(s.file));assert.equal(reloaded.data.resources[0].pending,true);const client=fake();await reloaded.synchronize(client);assert.equal(client.calls[0].etag,null);assert.equal(reloaded.data.resources[0].pending,false);assert.equal(reloaded.data.resources[0].etag,'"new"');});
test('editing twice offline preserves the first base ETag',t=>{const s=fixture(t);s.data.resources.push({id:cal.id+'a.ics',calendarId:cal.id,ics:editICS(input),etag:'"old"'});let e=event(s);s.upsert({...e,...input,title:'First'},'series');e=event(s);s.upsert({...e,...input,title:'Second'},'series');assert.equal(s.data.resources[0].baseEtag,'"old"');});
test('concurrent remote edit becomes conflict and does not overwrite either version',async t=>{const s=fixture(t),id=cal.id+'a.ics';s.data.resources.push({id,calendarId:cal.id,ics:editICS(input),etag:'"old"'});s.upsert({...event(s),...input,title:'Моё'},'series');const remote={id,calendarId:cal.id,ics:editICS({...input,title:'iPhone'}),etag:'"phone"'};await s.synchronize(fake([remote]));const r=s.data.resources[0];assert.ok(r.conflict);assert.ok(r.ics.includes('Моё'));assert.ok(r.conflict.remote.includes('iPhone'));assert.equal(r.pending,true);s.resolve(id,'remote');assert.equal(s.data.resources[0].pending,false);assert.ok(s.data.resources[0].ics.includes('iPhone'));});
test('keep local version retries against selected remote ETag',async t=>{const s=fixture(t),id=cal.id+'a.ics';s.data.resources.push({id,calendarId:cal.id,ics:editICS(input),etag:'"old"'});s.upsert({...event(s),...input,title:'Моё'},'series');const client=fake([{id,calendarId:cal.id,ics:editICS({...input,title:'iPhone'}),etag:'"phone"'}]);await s.synchronize(client);s.resolve(id,'local');await s.synchronize(client);assert.equal(client.calls[1].etag,'"phone"');assert.equal(s.data.resources[0].pending,false);assert.ok(s.data.resources[0].ics.includes('Моё'));});
test('remote deletion conflicts with offline edit and local recreation uses create precondition',async t=>{const s=fixture(t),id=cal.id+'a.ics';s.data.resources.push({id,calendarId:cal.id,ics:editICS(input),etag:'"old"'});s.upsert({...event(s),...input,title:'Моё'},'series');const client=fake();await s.synchronize(client);assert.equal(s.data.resources[0].conflict.remote,null);s.resolve(id,'local');await s.synchronize(client);assert.equal(client.calls[1].etag,null);assert.equal(s.data.resources[0].pending,false);});
test('remote edit conflicts with queued deletion',async t=>{const s=fixture(t),id=cal.id+'a.ics';s.data.resources.push({id,calendarId:cal.id,ics:editICS(input),etag:'"old"'});s.remove(event(s),'series');await s.synchronize(fake([{id,calendarId:cal.id,ics:editICS({...input,title:'iPhone'}),etag:'"phone"'}]));assert.equal(s.data.resources[0].deleted,true);assert.ok(s.data.resources[0].conflict);s.resolve(id,'remote');assert.equal(s.data.resources[0].deleted,false);});
test('failed inventory never deletes cache and unsynced events are retained',async t=>{const s=fixture(t);s.upsert(input,'series');const client=fake();client.put=async()=>{throw new Error('offline');};await assert.rejects(s.synchronize(client),/offline/);assert.equal(s.data.resources.length,1);const local=s.data.resources[0];local.pending=false;client.inventory=async()=>{throw new Error('incomplete');};await assert.rejects(s.synchronize(client),/incomplete/);assert.equal(s.data.resources.length,1);});
test('stale editor cannot overwrite a second window and local calendars can be edited',t=>{const s=fixture(t);s.upsert({...input,calendarId:'local'},'series');const stale=event(s);s.upsert({...stale,...input,calendarId:'local',title:'Changed'},'series');assert.throws(()=>s.upsert({...stale,...input,calendarId:'local'},'series'),/другом окне/);assert.throws(()=>s.remove(stale,'series'),/другом окне/);});
test('CalDAV sends If-Match / If-None-Match and rejects non-Apple redirects',async()=>{const calls=[];const c=new CalDAV({email:'u',password:'p'},async(url,opts)=>{calls.push(opts);return new Response('',{status:201});});await c.put(cal.id+'a.ics','ics',null);await c.put(cal.id+'a.ics','ics','"a"');assert.equal(calls[0].headers['If-None-Match'],'*');assert.equal(calls[1].headers['If-Match'],'"a"');assert.throws(()=>appleURL('https://icloud.com.evil.example/'),/Недопустимый/);assert.throws(()=>appleURL('http://caldav.icloud.com/'),/Недопустимый/);const redirect=new CalDAV({email:'u',password:'p'},async()=>new Response(null,{status:302,headers:{location:'https://evil.example/'}}));await assert.rejects(redirect.get(cal.id),/Недопустимый/);});
test('namespace-independent XML inventory parsing and read-only calendar privileges',async()=>{const ics=editICS(input);const escaped=ics.replaceAll('&','&amp;').replaceAll('<','&lt;');const c=new CalDAV({email:'u',password:'p'},async()=>new Response(`<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav"><D:response><D:href>/cal/a.ics</D:href><D:propstat><D:prop><D:getetag>&quot;v1&quot;</D:getetag><C:calendar-data>${escaped}</C:calendar-data></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response></D:multistatus>`,{status:207}));const rows=await c.inventory(cal.id);assert.equal(rows[0].etag,'"v1"');assert.equal(rows[0].ics.replaceAll('\r\n','\n'),ics.replaceAll('\r\n','\n'));});


test('organizer-only cloud events can be edited and deleted with conditional synchronization',async t=>{
  const s=fixture(t),id=cal.id+'personal.ics';
  const row={id,calendarId:cal.id,ics:editICS(input).replace('END:VEVENT','ORGANIZER:mailto:owner@example.com\r\nEND:VEVENT'),etag:'"old"'};
  s.data.resources.push({...row}); const client=fake([{...row}]);
  assert.equal(event(s).readOnly,false);
  s.upsert({...event(s),...input,title:'Changed'},'series');
  await s.synchronize(client); assert.equal(client.calls[0].etag,'"old"');
  assert.ok(client.calls[0].ics.includes('ORGANIZER:mailto:owner@example.com'));
  s.remove(event(s),'series'); assert.equal(s.data.resources[0].baseEtag,'"new"');
  await s.synchronize(client); assert.equal(s.data.resources.length,0); assert.equal(client.rows.length,0);
});
test('invitations cannot enter the edit or delete queue',t=>{
  const s=fixture(t); s.data.resources.push({id:cal.id+'invite.ics',calendarId:cal.id,ics:editICS(input).replace('END:VEVENT','ATTENDEE:mailto:guest@example.com\r\nEND:VEVENT'),etag:'"old"'});
  const before=JSON.stringify(s.data.resources),e=event(s); assert.equal(e.readOnly,true);
  assert.throws(()=>s.upsert({...e,...input},'series'),/приглашений/);
  assert.throws(()=>s.remove(e,'series'),/приглашений/);
  assert.equal(JSON.stringify(s.data.resources),before);
});

const targetCal={...cal,id:'https://p01-caldav.icloud.com/other/',name:'Other'};
function transferFixture(t,recurrence='') {
 const s=fixture(t);s.data.calendars.push(targetCal);
 const row={id:cal.id+'move.ics',calendarId:cal.id,ics:editICS({...input,recurrence}).replace('END:VEVENT','X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC\r\nEND:VEVENT'),etag:'"old"'};
 s.data.resources.push({...row});const client=fake([{...row}]);
 client.discover=async()=>[cal,targetCal];client.inventory=async id=>client.rows.filter(r=>r.calendarId===id);
 const put=client.put;client.put=async(id,ics,etag)=>{const reply=await put(id,ics,etag);const row=client.rows.find(r=>r.id===id);if(row)row.calendarId=id.startsWith(targetCal.id)?targetCal.id:cal.id;return reply;};
 return {s,client,row};
}
test('cloud calendar move survives restart and confirms destination before source deletion',async t=>{
 const {s,client,row}=transferFixture(t);const original=event(s);
 const id=s.upsert({...original,...input,calendarId:targetCal.id},'series');
 const moved=s.data.resources.find(r=>r.id===id);assert.equal(moved.calendarId,targetCal.id);assert.equal(moved.baseEtag,null);assert.ok(moved.ics.includes('X-APPLE-TRAVEL'));assert.equal(event(s).uid,original.uid);
 const restarted=new Store(path.dirname(s.file)),del=client.delete;client.delete=async(id,etag)=>{assert.ok(client.rows.some(r=>r.calendarId===targetCal.id));assert.equal(etag,'"old"');return del(id,etag);};
 await restarted.synchronize(client);assert.equal(client.rows.some(r=>r.id===row.id),false);assert.equal(restarted.data.resources.filter(r=>!r.deleted).length,1);assert.equal(restarted.data.resources[0].calendarId,targetCal.id);assert.equal(restarted.data.resources[0].moveSourceId,undefined);
});
test('failed destination creation never deletes the cloud source',async t=>{
 const {s,client,row}=transferFixture(t);s.upsert({...event(s),...input,calendarId:targetCal.id},'series');
 client.put=async()=>{throw new Error('offline');};let deletes=0;client.delete=async()=>{deletes++;return {status:204};};
 await assert.rejects(s.synchronize(client),/offline/);assert.equal(deletes,0);assert.ok(client.rows.some(r=>r.id===row.id));assert.equal(s.data.resources.length,2);
});
test('concurrent source changes during a calendar move remain a conflict',async t=>{
 const {s,client,row}=transferFixture(t);s.upsert({...event(s),...input,calendarId:targetCal.id},'series');
 client.rows[0].etag='"phone"';client.rows[0].ics=editICS({...input,title:'Changed on phone'});
 await s.synchronize(client);const source=s.data.resources.find(r=>r.id===row.id);assert.ok(source.conflict);assert.equal(source.conflict.remoteEtag,'"phone"');assert.ok(client.rows.some(r=>r.calendarId===targetCal.id));assert.ok(client.rows.some(r=>r.id===row.id));
});
test('moving one recurrence leaves the other occurrences in the source calendar',async t=>{
 const {s,client}=transferFixture(t,'FREQ=WEEKLY;COUNT=3');
 const occurrence=expand(s.data.resources,'2026-10-01T00:00:00Z','2026-11-01T00:00:00Z').events[1];
 const id=s.upsert({...occurrence,...input,start:'2026-10-09T12:00',end:'2026-10-09T13:00',calendarId:targetCal.id},'occurrence');
 const target=s.data.resources.find(r=>r.id===id);assert.ok(!target.ics.includes('RECURRENCE-ID'));assert.ok(!target.ics.includes('RRULE'));assert.ok(target.ics.includes('X-APPLE-TRAVEL'));
 await s.synchronize(client);const events=expand(s.data.resources,'2026-10-01T00:00:00Z','2026-11-01T00:00:00Z').events;
 assert.equal(events.filter(e=>e.calendarId===cal.id).length,2);assert.equal(events.filter(e=>e.calendarId===targetCal.id).length,1);
});
test('moving a series preserves existing exceptions',async t=>{
 const {s,client}=transferFixture(t,'FREQ=WEEKLY;COUNT=3');let series=event(s);const second=expand(s.data.resources,'2026-10-01T00:00:00Z','2026-11-01T00:00:00Z').events[1];
 s.data.resources[0].ics=editICS({...input,uid:series.uid,occurrence:second.occurrence,title:'Exception',start:'2026-10-09T15:00',end:'2026-10-09T16:00'},s.data.resources[0].ics,'occurrence');
 series=event(s);s.upsert({...series,...input,recurrence:series.recurrence,calendarId:targetCal.id},'series');await s.synchronize(client);
 const events=expand(s.data.resources,'2026-10-01T00:00:00Z','2026-11-01T00:00:00Z').events;assert.equal(events.length,3);assert.ok(events.every(e=>e.calendarId===targetCal.id));assert.equal(events[1].title,'Exception');
});
test('calendar moves check both calendars privileges and preserve stale-editor protection',t=>{
 const {s}=transferFixture(t);const e=event(s),before=JSON.stringify(s.data.resources);targetCal.writable=false;
 try{assert.throws(()=>s.upsert({...e,...input,calendarId:targetCal.id},'series'),/только для чтения/);}finally{targetCal.writable=true;}
 s.data.calendars.find(c=>c.id===cal.id).writable=false;assert.throws(()=>s.upsert({...e,...input,calendarId:targetCal.id},'series'),/только для чтения/);s.data.calendars.find(c=>c.id===cal.id).writable=true;
 assert.throws(()=>s.upsert({...e,...input,revision:20,calendarId:targetCal.id},'series'),/другом окне/);assert.equal(JSON.stringify(s.data.resources),before);
});
test('moves between local and cloud calendars retain a durable copy',async t=>{
 const {s,client}=transferFixture(t);s.upsert({...event(s),...input,calendarId:'local'},'series');assert.equal(event(s).calendarId,'local');await s.synchronize(client);assert.equal(client.rows.length,0);
 const id=s.upsert({...event(s),...input,calendarId:targetCal.id},'series');assert.equal(s.data.resources.length,1);assert.equal(s.data.resources[0].id,id);await s.synchronize(client);assert.equal(client.rows[0].calendarId,targetCal.id);
});

test('discarding a conflicted destination restores the original calendar event',async t=>{
 const {s,client,row}=transferFixture(t);const id=s.upsert({...event(s),...input,calendarId:targetCal.id},'series');
 client.rows.push({id,calendarId:targetCal.id,ics:editICS({...input,title:'Existing remote'}),etag:'"collision"'});
 let deletes=0;client.delete=async()=>{deletes++;return {status:204};};await s.synchronize(client);assert.equal(deletes,0);assert.ok(s.data.resources.find(r=>r.id===id).conflict);
 s.resolve(id,'remote');const source=s.data.resources.find(r=>r.id===row.id);assert.equal(Boolean(source.deleted),false);assert.equal(Boolean(source.pending),false);assert.equal(source.moveTargetId,undefined);assert.equal(source.ics,row.ics);
});
