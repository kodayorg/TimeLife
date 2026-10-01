const ICAL = require('ical.js');
const { DateTime } = require('luxon');
const zones = require('@touch4it/ical-timezones');
const { randomUUID } = require('node:crypto');

function registerZone(id) {
  if (!id || ['UTC', 'floating'].includes(id) || ICAL.TimezoneService.has(id)) return;
  const text = zones.getVtimezoneComponent(id);
  if (!text) throw new Error(`Неизвестный часовой пояс: ${id}`);
  const component = new ICAL.Component(ICAL.parse(text));
  ICAL.TimezoneService.register(id, new ICAL.Timezone({ component, tzid: id }));
}
function parse(text) {
  const cal = new ICAL.Component(ICAL.parse(text));
  for (const c of cal.getAllSubcomponents('vtimezone')) {
    const tzid = c.getFirstPropertyValue('tzid');
    ICAL.TimezoneService.register(tzid, new ICAL.Timezone({ component: c, tzid }));
  }
  for (const e of cal.getAllSubcomponents('vevent')) {
    for (const name of ['dtstart', 'dtend', 'recurrence-id', 'exdate', 'rdate']) {
      for (const p of e.getAllProperties(name)) registerZone(p.getParameter('tzid'));
    }
  }
  return cal;
}
// ORGANIZER alone also occurs on personal iCloud events. Scheduling actions
// remain restricted when any occurrence in the resource has participants.
function hasInvitations(cal) {
  return cal.getAllSubcomponents('vevent').some(c => c.hasProperty('attendee'));
}
function time(value, zone, allDay) {
  if (allDay) return ICAL.Time.fromDateString(value.slice(0, 10));
  registerZone(zone);
  const dt = DateTime.fromISO(value, { zone });
  if (!dt.isValid) throw new Error('Некорректная дата или часовой пояс');
  // Reject local clock times skipped during a DST transition.
  if (dt.toFormat("yyyy-MM-dd'T'HH:mm") !== value.slice(0, 16)) throw new Error('Такого времени нет из-за перевода часов');
  const t = ICAL.Time.fromDateTimeString(dt.toFormat("yyyy-MM-dd'T'HH:mm:ss"));
  t.zone = zone === 'UTC' ? ICAL.Timezone.utcTimezone : ICAL.TimezoneService.get(zone);
  return t;
}
function putTime(c, name, t) {
  c.removeAllProperties(name);
  const p = new ICAL.Property(name);
  if (!t.isDate && !['UTC', 'floating'].includes(t.zone.tzid)) p.setParameter('tzid', t.zone.tzid);
  p.setValue(t); c.addProperty(p);
}
function model(e, resource, occurrence, start, end, readOnly = hasInvitations(e.component.parent)) {
  const s = start || e.startDate, f = end || e.endDate;
  const convert = t => t.isDate || t.zone.tzid === 'floating' ? t.toString() : t.toJSDate().toISOString();
  return {
    id: resource.id, uid: e.uid, calendarId: resource.calendarId,
    title: e.summary || 'Без названия', description: e.description || '',
    location: e.location || '', start: convert(s), end: convert(f), allDay: s.isDate,
    zone: s.zone?.tzid === 'floating' ? 'floating' : s.zone?.tzid || 'UTC',
    recurrence: e.component.getFirstPropertyValue('rrule')?.toString() || '',
    occurrence: occurrence?.toString() || null,
    recurring: Boolean(occurrence), etag: resource.etag || null,
    pending: Boolean(resource.pending), conflict: Boolean(resource.conflict), revision: resource.revision || 0,
    readOnly,
    raw: resource.ics
  };
}
const preparedCalendars = new Map();
function prepare(text) {
  let prepared = preparedCalendars.get(text);
  if (!prepared) {
    const components = parse(text).getAllSubcomponents('vevent');
    prepared = components.filter(c => !c.hasProperty('recurrence-id')).map(c => {
      const e = new ICAL.Event(c), exceptions = components.filter(x => x.hasProperty('recurrence-id') && x.getFirstPropertyValue('uid') === e.uid);
      exceptions.forEach(x => e.relateException(new ICAL.Event(x)));
      return { c, e, exceptions, base: model(e, {}), recurring: e.isRecurring() };
    });
  }
  preparedCalendars.delete(text); preparedCalendars.set(text, prepared);
  while (preparedCalendars.size > 4000) preparedCalendars.delete(preparedCalendars.keys().next().value);
  return prepared;
}
function expand(resources, from, to) {
  const result = [], errors = [];
  const displayZone = DateTime.fromISO(from, { setZone: true }).zoneName;
  const lower = DateTime.fromISO(from).toMillis(), upper = DateTime.fromISO(to).toMillis();
  const millis = (value, m) => m.allDay || m.zone === 'floating' ? DateTime.fromISO(value, { zone: displayZone }).toMillis() : Date.parse(value);
  const overlaps = m => millis(m.end, m) > lower && millis(m.start, m) < upper;
  for (const resource of resources) {
    if (resource.deleted) continue;
    try {
      for (const { c, e, exceptions, base, recurring } of prepare(resource.ics)) {
        if (!recurring) {
          if (c.getFirstPropertyValue('status') !== 'CANCELLED') {
            if (overlaps(base)) result.push({ ...base, id: resource.id, calendarId: resource.calendarId, etag: resource.etag || null, pending: Boolean(resource.pending), conflict: Boolean(resource.conflict), revision: resource.revision || 0, raw: resource.ics });
          }
          continue;
        }
        const iterator = e.iterator(); let next; let count = 0;
        while ((next = iterator.next())) {
          if (++count > 100000) throw new Error('Слишком много повторений для отображения');
          const details = e.getOccurrenceDetails(next);
          const m = model(details.item, resource, next, details.startDate, details.endDate, base.readOnly);
          m.recurrence = c.getFirstPropertyValue('rrule')?.toString() || '';
          m.seriesStart = base.start; m.seriesEnd = base.end;
          const originalMillis = next.isDate || next.zone.tzid === 'floating' ? DateTime.fromISO(next.toString(), { zone: displayZone }).toMillis() : next.toJSDate().getTime();
          if (originalMillis >= upper) break;
          if (overlaps(m) && details.item.component.getFirstPropertyValue('status') !== 'CANCELLED') result.push(m);
        }
        // Moved exceptions may lie in this range even when their recurrence-id lies outside it.
        for (const x of exceptions) {
          const ex = new ICAL.Event(x), rid = x.getFirstPropertyValue('recurrence-id');
          const m = model(ex, resource, rid, undefined, undefined, base.readOnly);
          m.recurrence = c.getFirstPropertyValue('rrule')?.toString() || '';
          m.seriesStart = base.start; m.seriesEnd = base.end;
          if (overlaps(m) && x.getFirstPropertyValue('status') !== 'CANCELLED' && !result.some(r => r.id === m.id && r.occurrence === m.occurrence)) result.push(m);
        }
      }
    } catch (error) { errors.push({ id: resource.id, message: error.message }); }
  }
  return { events: result.sort((a, b) => a.start.localeCompare(b.start)), errors };
}
function editICS(input, oldICS, scope = 'series') {
  const cal = oldICS ? parse(oldICS) : new ICAL.Component(['vcalendar', [], []]);
  cal.updatePropertyWithValue('version', '2.0');
  if (!oldICS) cal.updatePropertyWithValue('prodid', '-//TimeLife//Windows//RU');
  let c = cal.getAllSubcomponents('vevent').find(x => !x.hasProperty('recurrence-id') && (!input.uid || x.getFirstPropertyValue('uid') === input.uid));
  if (!c) { c = new ICAL.Component('vevent'); cal.addSubcomponent(c); c.updatePropertyWithValue('uid', input.uid || randomUUID()); }
  if (hasInvitations(cal)) throw new Error('Редактирование приглашений пока недоступно: измените событие в iCloud');
  if (scope === 'occurrence' && input.occurrence) {
    const master = c;
    c = cal.getAllSubcomponents('vevent').find(x => x.getFirstPropertyValue('recurrence-id')?.toString() === input.occurrence && x.getFirstPropertyValue('uid') === master.getFirstPropertyValue('uid'));
    if (!c) {
      c = new ICAL.Component(JSON.parse(JSON.stringify(master.jCal)));
      ['rrule', 'rdate', 'exdate'].forEach(n => c.removeAllProperties(n));
      const rid = ICAL.Time.fromString(input.occurrence); rid.zone = master.getFirstPropertyValue('dtstart').zone;
      putTime(c, 'recurrence-id', rid); cal.addSubcomponent(c);
    }
  }
  if (!input.title?.trim()) throw new Error('Укажите название события');
  const zone = input.zone === 'floating' ? input.displayZone || 'Europe/Moscow' : input.zone || 'Europe/Moscow';
  const start = time(input.start, zone, input.allDay), end = time(input.end, zone, input.allDay);
  if (input.zone === 'floating' && !input.allDay) start.zone = end.zone = ICAL.Timezone.localTimezone;
  if (end.compare(start) <= 0) throw new Error('Конец события должен быть позже начала');
  for (const [name, val] of [['summary', input.title.trim()], ['description', input.description || ''], ['location', input.location || '']]) c.updatePropertyWithValue(name, val);
  putTime(c, 'dtstart', start); putTime(c, 'dtend', end); c.removeAllProperties('duration');
  c.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(), true));
  c.updatePropertyWithValue('last-modified', ICAL.Time.fromJSDate(new Date(), true));
  c.updatePropertyWithValue('sequence', Number(c.getFirstPropertyValue('sequence') || 0) + 1);
  if (scope === 'series') {
    c.removeAllProperties('rrule');
    if (input.recurrence) {
      const r = ICAL.Recur.fromString(input.recurrence);
      if (!r.freq) throw new Error('Некорректное правило повторения');
      c.updatePropertyWithValue('rrule', r);
    }
  }
  if (!input.allDay && input.zone !== 'floating' && zone !== 'UTC' && !cal.getAllSubcomponents('vtimezone').some(x => x.getFirstPropertyValue('tzid') === zone)) cal.addSubcomponent(new ICAL.Component(ICAL.parse(zones.getVtimezoneComponent(zone))));
  return cal.toString() + '\r\n';
}
function deleteOccurrence(ics, uid, occurrence) {
  const cal = parse(ics), master = cal.getAllSubcomponents('vevent').find(x => x.getFirstPropertyValue('uid') === uid && !x.hasProperty('recurrence-id'));
  if (!master || hasInvitations(cal)) throw new Error('Это событие нельзя удалить в TimeLife');
  const t = ICAL.Time.fromString(occurrence); t.zone = master.getFirstPropertyValue('dtstart').zone;
  const p = new ICAL.Property('exdate'); if (!t.isDate && !['UTC', 'floating'].includes(t.zone.tzid)) p.setParameter('tzid', t.zone.tzid); p.setValue(t); master.addProperty(p);
  for (const c of cal.getAllSubcomponents('vevent')) if (c.getFirstPropertyValue('recurrence-id')?.toString() === occurrence && c.getFirstPropertyValue('uid') === uid) cal.removeSubcomponent(c);
  master.updatePropertyWithValue('sequence', Number(master.getFirstPropertyValue('sequence') || 0) + 1);
  master.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(), true));
  return cal.toString() + '\r\n';
}
function standaloneOccurrence(ics, uid, occurrence) {
  const cal = parse(ics), c = cal.getAllSubcomponents('vevent').find(c => c.getFirstPropertyValue('uid') === uid && c.getFirstPropertyValue('recurrence-id')?.toString() === occurrence);
  if (!c) throw new Error('Событие уже удалено');
  for (const other of cal.getAllSubcomponents('vevent')) if (other !== c) cal.removeSubcomponent(other);
  for (const name of ['recurrence-id','rrule','rdate','exdate']) c.removeAllProperties(name);
  c.updatePropertyWithValue('uid', randomUUID());
  return cal.toString() + '\r\n';
}
function clearPreparedCalendars() { preparedCalendars.clear(); }
module.exports = { clearPreparedCalendars, parse, expand, editICS, deleteOccurrence, registerZone, hasInvitations, standaloneOccurrence };
