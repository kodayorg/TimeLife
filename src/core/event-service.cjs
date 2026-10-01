const path = require('node:path');
const { Worker } = require('node:worker_threads');
class EventService {
  constructor() { this.snapshot = []; this.pending = new Map(); this.sequence = 0; }
  get(resources, from, to) {
    if (!this.worker) {
      const worker = this.worker = new Worker(path.join(__dirname, 'event-worker.cjs'));
      this.snapshot = [];
      worker.on('message', ({ id, result, error }) => { const request = this.pending.get(id); if (!request) return; this.pending.delete(id); error ? request.reject(new Error(error)) : request.resolve(result); });
      const failed = error => { if (this.worker !== worker) return; this.worker = null; for (const p of this.pending.values()) p.reject(error); this.pending.clear(); };
      worker.on('error', failed);
      worker.on('exit', code => failed(new Error(`Обработка календаря остановилась (${code})`)));
      worker.unref();
    }
    const fields = ['id', 'calendarId', 'ics', 'etag', 'revision', 'pending', 'deleted'];
    const changed = resources.length !== this.snapshot.length || resources.some((r, i) => fields.some(k => r[k] !== this.snapshot[i][k]) || Boolean(r.conflict) !== Boolean(this.snapshot[i].conflict));
    const snapshot = changed ? resources.map(r => ({ ...r })) : undefined;
    if (snapshot) this.snapshot = snapshot;
    const id = ++this.sequence;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.worker.postMessage({ id, snapshot, from, to }); });
  }
  async reset() {
    const worker = this.worker; this.worker = null; this.snapshot = [];
    for (const request of this.pending.values()) request.reject(new Error('Calendar cache cleared'));
    this.pending.clear(); if (worker) await worker.terminate();
  }
  close() { return this.reset(); }
}
module.exports = { EventService };
