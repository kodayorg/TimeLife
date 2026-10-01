const { parentPort } = require('node:worker_threads');
const { EventCache } = require('./event-cache.cjs');
const cache = new EventCache(6);
let resources = [];
parentPort.on('message', ({ id, snapshot, from, to }) => {
  try {
    if (snapshot) resources = snapshot;
    const result = cache.get(resources, from, to);
    // The editor reloads original ICS in Store; do not duplicate it in every occurrence.
    parentPort.postMessage({ id, result: { events: result.events.map(({ raw, ...event }) => event), errors: result.errors } });
  } catch (error) { parentPort.postMessage({ id, error: error.message }); }
});
