const { expand } = require('./calendar.cjs');
// Bound memory; share recurrence expansion between app and widget windows.
class EventCache {
  constructor(limit = 4, calculate = expand) { this.limit = limit; this.calculate = calculate; this.resources = []; this.ranges = new Map(); }
  get(resources, from, to) {
    const fields = ['id', 'calendarId', 'ics', 'etag', 'revision', 'pending', 'deleted'];
    if (resources.length !== this.resources.length || resources.some((r, i) => fields.some(k => r[k] !== this.resources[i][k]) || Boolean(r.conflict) !== Boolean(this.resources[i].conflict))) {
      this.resources = resources.map(r => ({ ...r })); this.ranges.clear();
    }
    const key = JSON.stringify([from, to]);
    let value = this.ranges.get(key);
    if (!value) value = this.calculate(resources, from, to);
    this.ranges.delete(key); this.ranges.set(key, value);
    while (this.ranges.size > this.limit) this.ranges.delete(this.ranges.keys().next().value);
    return value;
  }
}
module.exports = { EventCache };
