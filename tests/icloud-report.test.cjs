const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CalDAV } = require('../src/core/caldav.cjs');
const { editICS } = require('../src/core/calendar.cjs');
const calendar = 'https://p109-caldav.icloud.com/123/calendars/example/';
const ics = editICS({ title: 'Test', start: '2026-10-02T12:00', end: '2026-10-02T13:00', zone: 'Europe/Moscow' });
const collection = `<D:response><D:href>/123/calendars/example/</D:href><D:propstat><D:prop><D:getetag>&quot;collection&quot;</D:getetag></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat><D:propstat><D:prop><C:calendar-data/></D:prop><D:status>HTTP/1.1 404 Not Found</D:status></D:propstat></D:response>`;
const event = `<D:response><D:href>/123/calendars/example/event.ics</D:href><D:propstat><D:prop><D:getetag>&quot;event&quot;</D:getetag><C:calendar-data><![CDATA[${ics}]]></C:calendar-data></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`;
const envelope = body => `<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">${body}</D:multistatus>`;
const client = body => new CalDAV({ email: 'test', password: 'test' }, async () => new Response(body, { status: 207 }));
test('iCloud REPORT collection header is ignored, event rows are imported', async () => {
  const rows = await client(envelope(collection + event)).inventory(calendar);
  assert.equal(rows.length, 1); assert.equal(rows[0].etag, '"event"'); assert.equal(rows[0].ics, ics.replaceAll('\r\n', '\n'));
});
test('empty iCloud calendar with only collection header succeeds', async () => {
  assert.deepEqual(await client(envelope(collection)).inventory(calendar), []);
});
test('collection header accepts missing trailing slash', async () => {
  const body = collection.replace('/example/</D:href>', '/example</D:href>');
  assert.equal((await client(envelope(body + event)).inventory(calendar)).length, 1);
});
test('incomplete event row still fails rather than silently losing cached events', async () => {
  const broken = event.replace(/<C:calendar-data>[\s\S]*?<\/C:calendar-data>/, '');
  await assert.rejects(client(envelope(collection + broken)).inventory(calendar), /неполный ответ/);
});
test('denied collection row does not masquerade as empty calendar', async () => {
  await assert.rejects(client(envelope(collection.replace('HTTP/1.1 200 OK', 'HTTP/1.1 403 Forbidden'))).inventory(calendar), /не подтвердил доступ/);
});
test('malformed 207 response is rejected instead of becoming empty inventory', async () => {
  await assert.rejects(client('<html>error</html>').inventory(calendar), /неожиданный ответ/);
  await assert.rejects(client(envelope(event).slice(0, -10)).inventory(calendar), /повреждённый ответ/);
});
