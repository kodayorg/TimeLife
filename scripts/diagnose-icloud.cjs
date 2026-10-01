// Read-only diagnostic. Never prints credentials, event content, names or account URLs.
const { app, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { CalDAV, responses, props, appleURL } = require('../src/core/caldav.cjs');
const { expand } = require('../src/core/calendar.cjs');
const { DateTime } = require('luxon');
const source = path.join(app.getPath('appData'), 'Calendar U');
const diagnosticData = path.join(__dirname, '../qa/diagnostic-data');
fs.mkdirSync(diagnosticData, { recursive: true });
fs.copyFileSync(path.join(source, 'Local State'), path.join(diagnosticData, 'Local State'));
app.setName('Calendar U');
app.setPath('userData', diagnosticData);
app.whenReady().then(async () => {
  try {
    const account = JSON.parse(safeStorage.decryptString(fs.readFileSync(path.join(app.getPath('appData'), 'Calendar U/account.enc'))));
    const client = new CalDAV(account);
    const request = client.request.bind(client);
    client.request = async (url, method, ...args) => {
      if (!['GET', 'PROPFIND', 'REPORT'].includes(method)) throw new Error('Diagnostic is read-only');
      const reply = await request(url, method, ...args);
      const rows = reply.status === 207 ? responses(reply.text) : [];
      console.log(JSON.stringify({ method, status: reply.status, bytes: reply.text.length, rows: rows.length, shapes: rows.slice(0, 3).map(row => ({ isCollection: appleURL(row.href, reply.url).replace(/\/$/,'') === reply.url.replace(/\/$/,''), propertyKeys: Object.keys(props(row)), statuses: (Array.isArray(row.propstat) ? row.propstat : [row.propstat]).filter(Boolean).map(p => p.status), valueTypes: Object.fromEntries(Object.entries(props(row)).map(([k,v])=>[k,typeof v])) })) }));
      return reply;
    };
    const calendars = await client.discover();
    console.log(JSON.stringify({ stage: 'discovery', calendars: calendars.length }));
    for (let index = 0; index < calendars.length; index++) {
      try {
        const items = await client.inventory(calendars[index].id);
        const from = DateTime.now().setZone('Europe/Moscow').startOf('month').minus({ days: 7 });
        const to = from.plus({ months: 2 });
        const rendered = expand(items, from.toISO(), to.toISO());
        console.log(JSON.stringify({ stage: 'inventory', index, count: items.length, expandedEvents: rendered.events.length, parseErrors: rendered.errors.length }));
      }
      catch (error) { console.log(JSON.stringify({ stage: 'inventory', index, error: error.message, cause: error.cause?.code })); }
    }
    app.exit(0);
  } catch (error) { console.log(JSON.stringify({ error: error.message, cause: error.cause?.code })); app.exit(1); }
});
