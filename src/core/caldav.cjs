const { XMLParser, XMLValidator } = require('fast-xml-parser');
const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: false, parseTagValue: false, trimValues: false, processEntities: true });
const list = x => x == null ? [] : Array.isArray(x) ? x : [x];
const xml = s => String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function appleURL(path, base = 'https://caldav.icloud.com/') {
  const u = new URL(path, base);
  if (u.protocol !== 'https:' || !(u.hostname === 'icloud.com' || u.hostname.endsWith('.icloud.com')) || u.username || u.password || (u.port && u.port !== '443')) throw new Error('Недопустимый адрес сервера iCloud');
  return u.href;
}
function responses(text) {
  if (XMLValidator.validate(text) !== true) throw new Error('Получен повреждённый ответ iCloud; локальные события сохранены');
  const document = parser.parse(text);
  if (!Object.hasOwn(document, 'multistatus')) throw new Error('Получен неожиданный ответ iCloud; локальные события сохранены');
  return list(document.multistatus?.response);
}
function props(row) {
  return Object.assign({}, ...list(row.propstat).filter(x => / 200 /.test(x.status)).map(x => x.prop));
}
class CalDAV {
  constructor(account, fetcher = fetch) { this.account = account; this.fetcher = fetcher; }
  async request(url, method, body, headers = {}) {
    url = appleURL(url);
    for (let i = 0; i < 5; i++) {
      const r = await this.fetcher(url, { method, redirect: 'manual', signal: AbortSignal.timeout(30000), headers: { Authorization: 'Basic ' + Buffer.from(`${this.account.email}:${this.account.password}`).toString('base64'), 'Content-Type': method === 'PUT' ? 'text/calendar; charset=utf-8' : 'application/xml; charset=utf-8', ...headers }, body });
      if ([301, 302, 307, 308].includes(r.status)) { url = appleURL(r.headers.get('location'), url); continue; }
      if ([401, 403].includes(r.status)) throw new Error('iCloud отклонил доступ. Проверьте Apple Account, пароль приложения и права календаря.');
      if (!r.ok && ![404, 412].includes(r.status)) throw new Error(`Ошибка iCloud (${r.status}). Попробуйте позже.`);
      return { status: r.status, etag: r.headers.get('etag'), text: await r.text(), url };
    }
    throw new Error('Слишком много перенаправлений iCloud');
  }
  async discover() {
    const root = await this.request('https://caldav.icloud.com/', 'PROPFIND', '<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>', { Depth: '0' });
    const principal = props(responses(root.text)[0] || {})['current-user-principal']?.href;
    if (!principal) throw new Error('Не удалось найти календарь этого Apple Account');
    const p = await this.request(appleURL(principal, root.url), 'PROPFIND', '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>', { Depth: '0' });
    const home = props(responses(p.text)[0] || {})['calendar-home-set']?.href;
    if (!home) throw new Error('iCloud не вернул адрес календарей');
    const c = await this.request(appleURL(home, p.url), 'PROPFIND', '<d:propfind xmlns:d="DAV:" xmlns:a="http://apple.com/ns/ical/" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:displayname/><d:resourcetype/><a:calendar-color/><d:current-user-privilege-set/><c:supported-calendar-component-set/></d:prop></d:propfind>', { Depth: '1' });
    return responses(c.text).flatMap(row => {
      const prop = props(row);
      if (!Object.hasOwn(prop.resourcetype || {}, 'calendar')) return [];
      const comps = list(prop['supported-calendar-component-set']?.comp);
      if (comps.length && !comps.some(x => x['@_name'] === 'VEVENT')) return [];
      const privileges = list(prop['current-user-privilege-set']?.privilege);
      const writable = privileges.some(x => ['all', 'write'].some(k => Object.hasOwn(x, k))) || (privileges.some(x => Object.hasOwn(x, 'write-content')) && privileges.some(x => Object.hasOwn(x, 'bind')));
      const id = appleURL(row.href, c.url);
      return [{ id, name: prop.displayname || 'iCloud', color: String(prop['calendar-color'] || '#d996e8').slice(0, 7), writable, visible: true }];
    });
  }
  async inventory(calendarId) {
    const r = await this.request(calendarId, 'REPORT', '<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"/></c:comp-filter></c:filter></c:calendar-query>', { Depth: '1' });
    if (r.status !== 207) throw new Error('iCloud не вернул полный список событий');
    return responses(r.text).flatMap(row => {
      if (typeof row.href !== 'string' || !row.href.trim()) throw new Error('Получен неполный ответ iCloud; локальные события сохранены');
      const id = appleURL(row.href, r.url);
      // iCloud includes the collection itself in REPORT responses. It has an
      // ETag but no VEVENT/calendar-data; only that exact collection is skipped.
      if (id.replace(/\/$/, '') === r.url.replace(/\/$/, '')) {
        const statuses = list(row.propstat).map(p => p.status);
        if (!statuses.some(s => / 200 /.test(s)) || (row.status && !/ 200 /.test(row.status))) throw new Error('iCloud не подтвердил доступ к календарю; локальные события сохранены');
        return [];
      }
      const prop = props(row);
      if (typeof prop['calendar-data'] !== 'string' || !prop['calendar-data'].trim() || typeof prop.getetag !== 'string' || !prop.getetag.trim()) throw new Error('Получен неполный ответ iCloud; локальные события сохранены');
      return [{ id, calendarId, etag: prop.getetag, ics: prop['calendar-data'] }];
    });
  }
  get(id) { return this.request(id, 'GET'); }
  put(id, ics, etag) { return this.request(id, 'PUT', ics, etag ? { 'If-Match': etag } : { 'If-None-Match': '*' }); }
  delete(id, etag) { if (!etag) throw new Error('Нет версии для безопасного удаления'); return this.request(id, 'DELETE', undefined, { 'If-Match': etag }); }
}
module.exports = { CalDAV, appleURL, responses, props, xml };
