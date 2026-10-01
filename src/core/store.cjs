const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { editICS, deleteOccurrence, parse, hasInvitations, standaloneOccurrence } = require('./calendar.cjs');
const defaults = { language: 'ru', theme: 'light', lightOpacity: 100, darkOpacity: 100, blur: false, zone: 'Europe/Moscow', firstDay: 1, hour12: false, weekNumbers: false, showWeekends: true, widget: 'none', widgetTop: false, autoStart: false, syncMinutes: 5, hiddenCalendars: [] };
class Store {
  constructor(dir) {
    fs.mkdirSync(dir, { recursive: true }); this.file = path.join(dir, 'calendar.json');
    if (fs.existsSync(this.file)) {
      // Never replace a damaged store with an empty one.
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (!Array.isArray(this.data.resources) || !Array.isArray(this.data.calendars)) throw new Error('Повреждено хранилище TimeLife');
    } else this.data = { settings: { ...defaults }, calendars: [{ id: 'local', name: 'На компьютере', color: '#d996e8', writable: true, visible: true }], resources: [], lastSync: null };
    this.data.settings = { ...defaults, ...this.data.settings };
    // Migrate the former tint-density slider to the native blur switch.
    this.data.settings.blur = Boolean(this.data.settings.blur);
  }
  save({ replaceBackup = false } = {}) {
    const temp = this.file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    // Privacy cleanup must never copy the previous cloud data into the backup.
    if (replaceBackup) fs.copyFileSync(temp, this.file + '.bak');
    else if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.file + '.bak');
    fs.renameSync(temp, this.file);
  }
  disconnectCloud() {
    if (this.data.resources.some(r => r.calendarId !== 'local' && (r.pending || r.conflict))) throw new Error('Сначала синхронизируйте изменения и разрешите конфликты');
    const previous = this.data;
    this.data = { ...this.data, resources: this.data.resources.filter(r => r.calendarId === 'local'), calendars: this.data.calendars.filter(c => c.id === 'local'), lastSync: null,
      settings: { ...this.data.settings, hiddenCalendars: this.data.settings.hiddenCalendars.filter(id => id === 'local') } };
    try { this.save({ replaceBackup: true }); } catch (error) { this.data = previous; throw error; }
  }
  upsert(input, scope) {
    const old = input.id && this.data.resources.find(x => x.id === input.id);
    const calendarId = input.calendarId || old?.calendarId;
    if (!this.data.calendars.find(c => c.id === calendarId)?.writable) throw new Error('Календарь доступен только для чтения');
    if (old && !this.data.calendars.find(c => c.id === old.calendarId)?.writable) throw new Error('Календарь доступен только для чтения');
    if (old?.moveTargetId || (old?.moveSourceId && old.calendarId !== calendarId)) throw new Error('Событие отправлено; ожидаем подтверждения iCloud');
    if (old?.conflict) throw new Error('Сначала разрешите конфликт события');
    if (input.id && !old) throw new Error('Событие уже удалено на другом устройстве');
    if (old && (input.etag || null) !== (old.etag || null)) throw new Error('Событие изменилось после открытия редактора. Откройте его заново.');
    if (old && (input.revision || 0) !== (old.revision || 0)) throw new Error('Событие уже изменено в другом окне. Откройте его заново.');
    const id = old?.id || (calendarId === 'local' ? 'local:' + randomUUID() : calendarId.replace(/\/?$/, '/') + randomUUID() + '.ics');
    const ics = editICS(input, old?.ics, scope);
    if (old && old.calendarId !== calendarId) return this.moveCalendar(old, input, scope, ics, calendarId);
    const resource = { ...old, id, calendarId, ics, revision: (old?.revision || 0) + 1, deleted: false, pending: calendarId !== 'local', baseEtag: old?.pending ? old.baseEtag : old?.etag || null };
    this.data.resources = this.data.resources.filter(x => x.id !== id).concat(resource); this.save(); return id;
  }
  moveCalendar(old, input, scope, editedICS, calendarId) {
    const single = scope === 'occurrence' && input.occurrence;
    const id = calendarId === 'local' ? 'local:' + randomUUID() : calendarId.replace(/\/?$/, '/') + randomUUID() + '.ics';
    const target = { id, calendarId, ics: single ? standaloneOccurrence(editedICS, input.uid, input.occurrence) : editedICS,
      revision: 1, pending: calendarId !== 'local', baseEtag: null };
    const source = { ...old, revision: (old.revision || 0) + 1 };
    if (single) source.ics = deleteOccurrence(old.ics, input.uid, input.occurrence);
    else source.deleted = true;
    // Persist the destination and source operation together. A cloud source is
    // changed only after iCloud confirms the destination copy.
    const keepSource = single || (old.calendarId !== 'local' && old.etag);
    if (keepSource) {
      source.pending = old.calendarId !== 'local';
      source.baseEtag = old.pending ? old.baseEtag : old.etag || null;
      if (source.pending) { source.moveTargetId = id; source.moveOriginal = { ...old }; target.moveSourceId = old.id; }
    }
    this.data.resources = this.data.resources.filter(r => r.id !== old.id).concat(target, keepSource ? [source] : []);
    this.save(); return id;
  }
  remove(input, scope) {
    const old = this.data.resources.find(x => x.id === input.id);
    if (!old) throw new Error('Событие уже удалено');
    if (old.moveTargetId || old.moveSourceId) throw new Error('Событие отправлено; ожидаем подтверждения iCloud');
    if (old.conflict) throw new Error('Сначала разрешите конфликт');
    if ((input.etag || null) !== (old.etag || null)) throw new Error('Событие изменилось. Откройте его заново.');
    if ((input.revision || 0) !== (old.revision || 0)) throw new Error('Событие уже изменено в другом окне');
    if (!this.data.calendars.find(c => c.id === old.calendarId)?.writable) throw new Error('Календарь доступен только для чтения');
    if (hasInvitations(parse(old.ics))) throw new Error('Удаление приглашений пока недоступно: измените событие в iCloud');
    if (scope === 'occurrence' && input.occurrence) { old.ics = deleteOccurrence(old.ics, input.uid, input.occurrence); old.pending = old.calendarId !== 'local'; old.baseEtag = old.pending && Object.hasOwn(old, 'baseEtag') ? old.baseEtag : old.etag; }
    else if (old.calendarId === 'local' || !old.etag) this.data.resources = this.data.resources.filter(x => x.id !== old.id);
    else { old.baseEtag = old.pending ? old.baseEtag : old.etag; old.pending = true; old.deleted = true; }
    old.revision = (old.revision || 0) + 1; this.save();
  }
  async synchronize(client) {
    for (const r of this.data.resources.filter(x => x.pending && !x.conflict).sort((a,b) => Number(Boolean(a.moveTargetId)) - Number(Boolean(b.moveTargetId)))) {
      if (r.moveTargetId) {
        const target = this.data.resources.find(x => x.id === r.moveTargetId);
        if (!target || target.pending || target.conflict || target.deleted) continue;
      }
      const reply = r.deleted ? await client.delete(r.id, r.baseEtag) : await client.put(r.id, r.ics, r.baseEtag);
      if (reply.status === 412 || (reply.status === 404 && !r.deleted)) {
        const remote = await client.get(r.id);
        r.conflict = { remote: remote.status === 404 ? null : remote.text, remoteEtag: remote.etag, detected: new Date().toISOString() };
      } else if (r.deleted) this.data.resources = this.data.resources.filter(x => x.id !== r.id);
      else {
        // Refetch the server's canonical data and ETag after PUT.
        const remote = await client.get(r.id);
        if (remote.status !== 200 || !remote.etag) throw new Error('Событие отправлено; ожидаем подтверждения iCloud');
        r.ics = remote.text; r.etag = remote.etag; r.pending = false; r.revision = (r.revision || 0) + 1; delete r.baseEtag;
      }
      if (r.moveTargetId) {
        const target = this.data.resources.find(x => x.id === r.moveTargetId);
        if (target) delete target.moveSourceId;
        delete r.moveTargetId; delete r.moveOriginal;
      }
      this.save();
    }
    const calendars = await client.discover();
    this.data.calendars = this.data.calendars.filter(c => c.id === 'local').concat(calendars);
    for (const cal of calendars) {
      const remote = await client.inventory(cal.id); const ids = new Set(remote.map(x => x.id));
      for (const item of remote) {
        const old = this.data.resources.find(x => x.id === item.id);
        if (old?.pending || old?.conflict) continue;
        this.data.resources = this.data.resources.filter(x => x.id !== item.id).concat({ ...item, pending: false, revision: old?.etag === item.etag ? old.revision : (old?.revision || 0) + 1 });
      }
      this.data.resources = this.data.resources.filter(x => x.calendarId !== cal.id || ids.has(x.id) || x.pending || x.conflict);
      this.save();
    }
    // Removed/shared-away calendars keep a local recovery copy but disappear from views.
    this.data.lastSync = new Date().toISOString(); this.save();
  }
  resolve(id, choice) {
    const r = this.data.resources.find(x => x.id === id); if (!r?.conflict) throw new Error('Конфликт уже разрешён');
    const conflict = r.conflict;
    if (choice === 'remote') {
      // Choosing the remote destination abandons the transfer, so retain the
      // original event instead of deleting it after an unrelated copy wins.
      if (r.moveSourceId) {
        const source = this.data.resources.find(x => x.id === r.moveSourceId);
        if (source?.moveOriginal) this.data.resources = this.data.resources.map(x => x === source ? { ...source.moveOriginal, revision: (source.revision || 0) + 1 } : x);
        delete r.moveSourceId;
      }
      if (!conflict.remote) this.data.resources = this.data.resources.filter(x => x.id !== id);
      else { r.ics = conflict.remote; r.etag = conflict.remoteEtag; r.pending = false; r.deleted = false; delete r.baseEtag; delete r.conflict; }
    } else if (choice === 'local') {
      r.baseEtag = conflict.remoteEtag || null; r.etag = conflict.remoteEtag || null; delete r.conflict;
      if (r.deleted && !r.baseEtag) this.data.resources = this.data.resources.filter(x => x.id !== id);
    } else throw new Error('Неизвестный способ разрешения конфликта');
    r.revision = (r.revision || 0) + 1;
    this.save();
  }
}
module.exports = { Store, defaults };
