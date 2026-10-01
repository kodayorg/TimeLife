(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('luxon').DateTime);
  else root.CalendarUMove = factory(root.luxon.DateTime);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (DT) {
  function plan(event, sourceDate, targetDate, displayZone, minutes = null) {
    const local = event.allDay || event.zone === 'floating';
    const start = DT.fromISO(event.start, { zone: local ? displayZone : undefined }).setZone(displayZone);
    const end = DT.fromISO(event.end, { zone: local ? displayZone : undefined }).setZone(displayZone);
    const source = DT.fromISO(sourceDate, { zone: displayZone }).startOf('day');
    const target = DT.fromISO(targetDate, { zone: displayZone }).startOf('day');
    const delta = Math.round(target.diff(source, 'days').days);
    let next = start.plus({ days: delta });
    if (!event.allDay && minutes !== null) next = target.set({ hour: Math.floor(minutes / 60), minute: minutes % 60, second: 0, millisecond: 0 });
    const expectedHour = minutes === null ? start.hour : Math.floor(minutes / 60);
    const expectedMinute = minutes === null ? start.minute : minutes % 60;
    if (!next.isValid || (!event.allDay && (next.hour !== expectedHour || next.minute !== expectedMinute))) throw new Error('Такого времени нет из-за перевода часов');
    const finish = event.allDay ? next.plus({ days: Math.round(end.diff(start, 'days').days) }) : next.plus({ milliseconds: end.toMillis() - start.toMillis() });
    const eventZone = local ? displayZone : event.zone || 'UTC';
    const format = d => event.allDay ? d.toISODate() : d.setZone(eventZone).toFormat("yyyy-MM-dd'T'HH:mm:ss");
    return { input: { ...event, start: format(next), end: format(finish), displayZone }, scope: event.recurring ? 'occurrence' : 'series', changed: next.toMillis() !== start.toMillis() };
  }
  return { plan };
});
