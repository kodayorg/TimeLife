/* Local renderer only. iCloud credentials and requests stay in the main process. */
const { DateTime: DT } = luxon;
const api = window.calendarU;
const locale = () => CalendarUI18n.locales[state?.settings.language || 'ru'];
const t = (key, values) => CalendarUI18n.translate(key, state?.settings.language || 'ru', values);
const dateLabel = d => d.setLocale(locale()).toLocaleString({ weekday: 'short', day: 'numeric', month: 'long' });
const calendarName = c => c?.id === 'local' && c.name === 'На компьютере' ? t('На компьютере') : c?.name || '';
const errorText = message => t(message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''));
const monthLabel = d => ['ja', 'zh'].includes(state.settings.language) ? d.toFormat('yyyy年M月') : state.settings.language === 'ko' ? d.toFormat('yyyy년 M월') : `${cap(d.toFormat('LLLL'))} ${d.year}`;
const widgetKind = new URLSearchParams(location.search).get('widget');
const root = document.getElementById('root'), overlays = document.getElementById('overlays');
let compactPage = 'calendar';
let state, events = [], anchor, selected, view = 'month', settingsTab = 'appearance', refreshNumber = 0;
let eventMetadata = new WeakMap(), eventIndices = new WeakMap(), dayEvents = new Map();
let loadedFrom, loadedTo, agendaStart, agendaEnd, agendaFrame, extendingAgenda = false;
const esc = s => String(s ?? '').replace(/[&<>"']/g, x => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[x]));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const color = id => /^#[0-9a-f]{6}$/i.test(state.calendars.find(c => c.id === id)?.color || '') ? state.calendars.find(c => c.id === id).color : '#d996e8';
const zone = () => state.settings.zone;
const now = () => DT.now().setZone(zone()).setLocale(locale());
const day = value => DT.fromISO(value, { zone: zone() }).setLocale(locale());
const dateKey = d => d.toISODate();
const timeText = d => d.toFormat(state.settings.hour12 ? 'h:mm a' : 'HH:mm');
const startOfWeek = d => d.startOf('day').minus({ days: (d.weekday % 7 - Number(state.settings.firstDay) + 7) % 7 });
function metadata(e) {
  if (!eventMetadata.has(e)) eventMetadata.set(e, {
    start: DT.fromISO(e.start, { zone: e.allDay || e.zone === 'floating' ? zone() : undefined }).setZone(zone()).setLocale(locale()),
    end: DT.fromISO(e.end, { zone: e.allDay || e.zone === 'floating' ? zone() : undefined }).setZone(zone()).setLocale(locale()),
    index: eventIndices.get(e)
  });
  return eventMetadata.get(e);
}
const eventStart = e => metadata(e).start;
const eventEnd = e => metadata(e).end;
const eventIndex = e => metadata(e).index;
function forDay(d) {
  const key = dateKey(d);
  if (!dayEvents.has(key)) {
    const lower = d.startOf('day').toMillis(), upper = d.startOf('day').plus({ days: 1 }).toMillis();
    dayEvents.set(key, events.filter(e => eventStart(e).toMillis() < upper && eventEnd(e).toMillis() > lower));
  }
  return dayEvents.get(key);
}
const rangeText = e => e.allDay ? (t("Весь день")) : timeText(eventStart(e)) + '–' + timeText(eventEnd(e));
function toast(message) { const el = document.getElementById('toast'); el.className = 'toast'; el.textContent = errorText(message); clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.className = ''; el.textContent = ''; }, 6000); }
async function action(fn) { try { return await fn(); } catch (e) { toast(e.message); return null; } }
function theme() {
  document.documentElement.lang = locale();
  document.documentElement.dataset.theme = state.settings.theme;
  document.documentElement.dataset.nativeBlur = String(Boolean(state.settings.blur));
  const accent = state.appearance?.accent || '#d9d9d9';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-on', contrastColor(accent));
  document.documentElement.style.setProperty('--accent-ink', readableAccent(accent, state.settings.theme === 'dark'));
  document.documentElement.style.setProperty('--blur', state.settings.blur ? 1 : 0);
  document.documentElement.style.setProperty('--widget-radius', state.settings.blur ? '8px' : '20px');
  document.documentElement.style.setProperty('--opacity', (state.settings.theme === 'dark' ? state.settings.darkOpacity : state.settings.lightOpacity) / 100);
}
function luminance(hex) {
  const channels = hex.replace('#', '').match(/../g).slice(0, 3).map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrastColor(hex) { return luminance(hex) > .179 ? '#172116' : '#ffffff'; }
function readableAccent(hex, dark) {
  const light = luminance(hex);
  if (dark ? light >= .179 : light <= .179) return hex;
  return '#' + hex.slice(1).match(/../g).map(c => { const v = parseInt(c, 16); return Math.round(dark ? v + (255 - v) * .6 : v * .38).toString(16).padStart(2, '0'); }).join('');
}
async function refresh() {
  const ticket = ++refreshNumber;
  const next = await api.state(); if (ticket !== refreshNumber) return;
  const previousZone = state?.settings.zone; state = next;
  if (anchor && previousZone !== zone()) { anchor = anchor.setZone(zone(), { keepLocalTime: true }); selected = selected.setZone(zone(), { keepLocalTime: true }); }
  if (!anchor) { anchor = now().startOf('month'); selected = now().startOf('day'); }
  anchor = anchor.setLocale(locale()); selected = selected.setLocale(locale());
  theme();
  await loadEvents(anchor, ticket);
}
async function loadEvents(center, ticket = ++refreshNumber) {
  const from = center.startOf('month').minus({ months: 1, days: 8 });
  const to = center.endOf('month').plus({ months: 2, days: 8 });
  const result = await api.events(from.toISO(), to.toISO()); if (ticket !== refreshNumber) return;
  if (!anchor.hasSame(center, 'month')) return loadEvents(anchor);
  loadedFrom = from; loadedTo = to;
  events = result.events; eventMetadata = new WeakMap(); eventIndices = new WeakMap(); events.forEach((e, i) => eventIndices.set(e, i)); dayEvents.clear(); render();
  if (result.errors.length) toast(t('Не удалось отобразить {count} событий. Исходные данные сохранены: {message}', {count:result.errors.length,message:t(result.errors[0].message)}));
}
function agendaPosition() {
  const scroller = root.querySelector('.widget-agenda-scroll');
  if (!scroller) return null;
  const top = scroller.getBoundingClientRect().top;
  const section = [...scroller.children].find(el => el.getBoundingClientRect().bottom > top + 1);
  return section ? { date: section.dataset.agendaDate, offset: section.getBoundingClientRect().top - top } : null;
}
function render(focusAgenda = false) {
  const position = focusAgenda ? null : agendaPosition();
  if (!agendaStart || selected < agendaStart || selected > agendaEnd) resetAgenda();
  const html = widgetKind ? widgetHTML(widgetKind) : appHTML();
  const existingScroller = widgetKind && root.querySelector('.widget-agenda-scroll');
  if (existingScroller) {
    const template = document.createElement('template'); template.innerHTML = html;
    root.querySelector('.widget-title').innerHTML = template.content.querySelector('.widget-title').innerHTML;
    root.querySelector('.widget-month').outerHTML = template.content.querySelector('.widget-month').outerHTML;
    root.querySelector('.widget-agenda-head').innerHTML = template.content.querySelector('.widget-agenda-head').innerHTML;
    existingScroller.innerHTML = template.content.querySelector('.widget-agenda-scroll').innerHTML;
  } else root.innerHTML = html;
  bindRoot();
  const scroller = root.querySelector('.widget-agenda-scroll');
  const target = scroller?.querySelector(`[data-agenda-date="${position?.date || dateKey(selected)}"]`);
  if (target) scroller.scrollTop = target.offsetTop - (position?.offset || 0);
}
function resetAgenda() { agendaStart = selected.minus({ days: 28 }).startOf('day'); agendaEnd = selected.plus({ days: 56 }).startOf('day'); }
function needsEvents() {
  const first = startOfWeek(anchor.startOf('month')), last = anchor.endOf('month').plus({ days: 8 });
  return !loadedFrom || first < loadedFrom || last > loadedTo || (widgetKind && (agendaStart < loadedFrom || agendaEnd.plus({ days: 1 }) > loadedTo));
}
async function navigateDate(next, focusAgenda = true) {
  selected = next; anchor = selected.startOf('month');
  if (focusAgenda) resetAgenda();
  render(focusAgenda);
  if (needsEvents()) await loadEvents(anchor);
}
function weekDays(includeAll = false) {
  return Array.from({ length: 7 }, (_, i) => startOfWeek(anchor).plus({ days: i })).filter(d => includeAll || state.settings.showWeekends || d.weekday < 6);
}
function sidebarHTML(syncLabel) {
  return `<aside class="sidebar"><div><div class="brand">Time<span>Life</span></div><p class="hint" style="margin-top:10px">${t("Ваш день. В одном месте.")}</p></div><div class="calendar-section"><div class="section-label">${t("Календари")}</div>${state.calendars.map(c => `<label class="calendar-filter" style="--cal-color:${color(c.id)};--cal-check:${contrastColor(color(c.id))}"><span class="calendar-check"><input type="checkbox" aria-label="${esc(t('Показывать календарь {name}', {name:calendarName(c)}))}" data-calendar="${esc(c.id)}" ${!state.settings.hiddenCalendars.includes(c.id) ? 'checked' : ''}><span class="check-disc" aria-hidden="true"></span></span><span class="menu-label">${esc(calendarName(c))}</span>${!c.writable ? `<small title="${t("Только чтение")}">◦</small>` : ''}</label>`).join('')}</div><div class="side-actions"><button id="widgets" class="menu-row"><span class="menu-icon"><img src="../assets/widgets.svg" alt=""></span><span class="menu-label">${t("Виджеты рабочего стола")}</span></button><button id="settings" class="menu-row"><span class="menu-icon"><img src="../assets/settings.svg" alt=""></span><span class="menu-label">${t("Настройки")}</span></button><div class="sync-card"><div class="sync-status"><span class="sync-icon"><span class="sync-dot ${!state.connected || state.syncError ? 'off' : ''}"></span></span><span>${syncLabel}</span></div><small class="sync-details">${state.lastSync ? (t("Обновлено")+" ") + day(state.lastSync).toFormat('HH:mm') : (t("Подключите iCloud в настройках"))}${state.pending ? `<br>${t("Ожидают отправки:")+" "}${state.pending}` : ''}</small></div></div></aside>`;
}
function appHTML() {
  const syncLabel = state.syncing ? (t("Синхронизация…")) : state.syncError ? (t("Не удалось обновить")) : state.connected ? (t("iCloud подключён")) : (t("Локальный календарь"));
  return `<div class="app">${sidebarHTML(syncLabel)}<main class="main"><header class="toolbar"><h1>${cap(anchor.toFormat('LLLL'))}<span class="year">${anchor.year}</span></h1><div class="spacer"></div><div class="segmented"><button data-view="month" class="${view === 'month' ? 'active' : ''}">${t("Месяц")}</button><button data-view="week" class="${view === 'week' ? 'active' : ''}">${t("Неделя")}</button></div><button class="plain" id="today">${t("Сегодня")}</button><button class="icon-button" data-nav="-1" aria-label="${t("Назад")}">‹</button><button class="icon-button" data-nav="1" aria-label="${t("Вперёд")}">›</button><button class="primary" id="new-event">${t("＋ Событие")}</button></header>${state.conflicts.length ? `<div class="status-banner">${t("Изменения на двух устройствах:")+" "}${state.conflicts.length}<button id="conflicts">${t("Разрешить конфликты")}</button></div>` : ''}${state.syncError ? `<div class="status-banner">${esc(t(state.syncError))}<button id="retry-sync">${t("Повторить")}</button></div>` : ''}<div class="subbar"><span>${view === 'week' ? startOfWeek(selected).toFormat('d LLL') + ' — ' + startOfWeek(selected).plus({ days: 6 }).toFormat('d LLL yyyy') : (t("Все события месяца"))}</span><span>${esc(zone())} · ${state.settings.hour12 ? '12' : '24'}${t("-часовой формат")}</span></div>${view === 'month' ? monthHTML() : weekHTML()}</main></div>`;
}
function monthHTML() {
  const first = startOfWeek(anchor.startOf('month')), columns = state.settings.showWeekends ? 7 : 5;
  return `<div class="month-view" style="--columns:${columns}"><div class="weekdays">${weekDays().map(d => `<span>${d.toFormat('cccc')}</span>`).join('')}</div><div class="month-grid">${Array.from({ length: 42 }, (_, i) => {
    const d = first.plus({ days: i }); if (!state.settings.showWeekends && d.weekday > 5) return '';
    const items = forDay(d);
    return `<div class="month-cell ${d.month !== anchor.month ? 'outside' : ''}" data-cell="${dateKey(d)}">${state.settings.weekNumbers && i % 7 === 0 ? `<span class="week-number">${d.weekNumber}</span>` : ''}<button data-day="${dateKey(d)}" class="date-button ${d.hasSame(selected, 'day') ? 'selected' : ''} ${d.hasSame(now(), 'day') ? 'today' : ''}">${d.day}</button><div class="cell-events">${items.map(e => `<button class="event-chip" style="--cal-color:${color(e.calendarId)}" data-event="${eventIndex(e)}" title="${esc(e.title)}"><span>${e.allDay ? '' : timeText(eventStart(e))}</span>${esc(e.title)}${e.pending ? ' ·' : ''}</button>`).join('')}</div></div>`;
  }).join('')}</div></div>`;
}
function layoutEvents(items, d) {
  const dated = items.map(e => { const s = Math.max(0, eventStart(e).diff(d.startOf('day'), 'minutes').minutes), end = Math.min(1440, eventEnd(e).diff(d.startOf('day'), 'minutes').minutes); return { e, s, end, lane: 0, lanes: 1 }; }).sort((a, b) => a.s - b.s || b.end - a.end);
  let group = [], groupEnd = -1, lanes = [];
  const close = () => group.forEach(x => x.lanes = lanes.length || 1);
  for (const item of dated) {
    if (item.s >= groupEnd) { close(); group = []; lanes = []; groupEnd = -1; }
    let lane = lanes.findIndex(end => end <= item.s); if (lane < 0) lane = lanes.length;
    item.lane = lane; lanes[lane] = item.end; group.push(item); groupEnd = Math.max(groupEnd, item.end);
  } close(); return dated;
}
function weekHTML() {
  const first = startOfWeek(selected), days = Array.from({ length: 7 }, (_, i) => first.plus({ days: i })).filter(d => state.settings.showWeekends || d.weekday < 6);
  return `<div class="week-view" style="--columns:${days.length}"><div class="week-scroll"><div class="week-sticky"><div class="week-heading"><span>${state.settings.weekNumbers ? '№ ' + first.weekNumber : ''}</span>${days.map(d => `<button data-day="${dateKey(d)}" class="${d.hasSame(now(), 'day') ? 'today' : ''}">${d.toFormat('ccc')}<b>${d.day}</b></button>`).join('')}</div><div class="week-all-day"><div><small style="font-size:9px">${t("Весь день")}</small></div>${days.map(d => `<div data-drop-date="${dateKey(d)}">${forDay(d).filter(e => e.allDay).map(e => `<button class="event-chip" data-event="${eventIndex(e)}" style="--cal-color:${color(e.calendarId)}">${esc(e.title)}</button>`).join('')}</div>`).join('')}</div></div><div class="week-hours"><div class="hours-label">${Array.from({ length: 24 }, (_, h) => `<span style="top:${h * 48 + 3}px">${DT.fromObject({year:2026,month:1,day:1,hour:h},{zone:'UTC',locale:locale()}).toFormat(state.settings.hour12 ? 'h a' : 'HH:mm')}</span>`).join('')}</div>${days.map(d => `<div class="time-column" data-time-date="${dateKey(d)}">${layoutEvents(forDay(d).filter(e => !e.allDay), d).map(({ e, s, end, lane, lanes }) => `<button class="time-event" data-event="${eventIndex(e)}" style="--cal-color:${color(e.calendarId)};top:${s * .8}px;height:${Math.max(22, (end - s) * .8)}px;left:calc(${lane / lanes * 100}% + 3px);width:calc(${100 / lanes}% - 6px)">${esc(e.title)}<small>${rangeText(e)}</small></button>`).join('')}</div>`).join('')}</div></div></div>`;
}
const assetSets = {
  month: ['109-163-imgGroup13.svg', '109-163-imgGroup12.svg', '109-258-imgGroup1.svg'],
  horizontal: ['109-258-imgGroup11.svg', '109-258-imgGroup10.svg', '109-258-imgGroup1.svg'],
  vertical: ['109-154-imgGroup9.svg', '109-154-imgGroup8.svg', '109-154-imgGroup1.svg', '109-154-imgGroup2.svg']
};
function agendaDaysHTML(first, last, assets) {
  const count = Math.round(last.diff(first, 'days').days) + 1;
  return Array.from({ length: count }, (_, i) => {
    const d = first.plus({ days: i }), items = forDay(d);
    const loaded = loadedFrom && d >= loadedFrom.startOf('day') && d.plus({ days: 1 }) <= loadedTo;
    return `<section class="widget-agenda-group" data-agenda-date="${dateKey(d)}"><div class="widget-day-head"><span>${dateLabel(d)}</span><button class="widget-plus" data-add="${dateKey(d)}" aria-label="${t("Добавить событие")}"><img src="../assets/${assets[2]}" alt=""></button></div>${items.length ? items.map(e => `<button class="widget-event" style="--cal-color:${color(e.calendarId)}" data-event="${eventIndex(e)}">${esc(e.title)}<small>${rangeText(e)}</small></button>`).join('') : `<p class="widget-empty">${loaded ? (t("Событий нет")) : (t("Загрузка…"))}</p>`}</section>`;
  }).join('');
}
function updateWidgetCalendar() {
  const calendar = root.querySelector('.widget-month');
  if (calendar) { calendar.outerHTML = widgetMonthHTML(widgetKind); bindRoot(); }
  const label = root.querySelector('.month .widget-agenda-head > span'); if (label) label.textContent = monthLabel(anchor);
}
function bindAgenda() {
  const scroller = root.querySelector('.widget-agenda-scroll');
  if (!scroller) return;
  scroller.onscroll = () => {
    if (widgetKind === 'month' && compactPage !== 'events') return;
    cancelAnimationFrame(agendaFrame);
    agendaFrame = requestAnimationFrame(async () => {
      if (!scroller.isConnected || (widgetKind === 'month' && compactPage !== 'events')) return;
      const position = agendaPosition(); if (!position) return;
      const next = day(position.date);
      if (!next.hasSame(selected, 'day')) {
        selected = next; anchor = next.startOf('month'); updateWidgetCalendar();
        const add = root.querySelector('.widget-agenda-head [data-add]'); if (add) add.dataset.add = dateKey(next);
      }
      if (!extendingAgenda && (scroller.scrollTop < 200 || scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 400)) {
        extendingAgenda = true;
        try { resetAgenda(); if (needsEvents()) await action(() => loadEvents(anchor)); else render(); }
        finally { extendingAgenda = false; }
      }
    });
  };
}
function widgetMonthHTML(kind) {
  const first = startOfWeek(anchor.startOf('month')), last = anchor.endOf('month');
  const rows = Math.ceil((last.startOf('day').diff(first, 'days').days + 1) / 7), assets = assetSets[kind];
  return `<div class="widget-month"><div class="widget-month-bar"><span>${monthLabel(anchor)}</span><button class="widget-asset" data-nav="-1" aria-label="${t("Предыдущий месяц")}"><img src="../assets/${assets[0]}" alt=""></button><button class="widget-asset" data-nav="1" aria-label="${t("Следующий месяц")}"><img src="../assets/${assets[1]}" alt=""></button></div><div class="widget-weekdays">${weekDays(true).map(d => `<span>${d.toFormat('ccc')}</span>`).join('')}</div><div class="widget-days" style="--rows:${rows}">${Array.from({ length: rows * 7 }, (_, i) => { const d = first.plus({ days: i }), items = forDay(d); return `<button class="widget-day ${d.month !== anchor.month ? 'outside' : ''} ${d.hasSame(selected, 'day') ? 'selected' : ''}" data-date="${dateKey(d)}">${d.day}${items.length ? `<div class="widget-markers">${[...new Set(items.map(e => color(e.calendarId)))].slice(0, 3).map(c => `<span style="background:${c}"></span>`).join('')}</div>` : ''}</button>`; }).join('')}</div></div>`;
}
function compactArrowsHTML(page) {
  return ['calendar', 'events'].map((target, i) => `<button class="compact-arrow ${i ? 'next' : 'previous'}" data-compact-page="${target}" aria-label="${t(target === 'calendar' ? 'Календарь' : 'События')}" ${page === target ? 'disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${i ? 'm9 4 8 8-8 8' : 'm15 4-8 8 8 8'}"/></svg></button>`).join('');
}
function applyCompactPage() {
  const widget = root.querySelector('.widget.month'); if (!widget) return;
  widget.dataset.page = compactPage;
  widget.querySelector('.widget-title').firstChild.textContent = t(compactPage === 'events' ? 'События' : 'Календарь');
  widget.querySelector('.widget-month').inert = compactPage !== 'calendar';
  widget.querySelector('.widget-agenda').inert = compactPage !== 'events';
  widget.querySelectorAll('[data-compact-page]').forEach(button => { button.disabled = button.dataset.compactPage === compactPage; });
}
function switchCompactPage(page) {
  if (widgetKind !== 'month' || page === compactPage) return;
  compactPage = page; applyCompactPage();
  if (page === 'events') {
    const scroller = root.querySelector('.widget-agenda-scroll');
    const target = scroller.querySelector(`[data-agenda-date="${dateKey(selected)}"]`);
    if (target) scroller.scrollTop = target.offsetTop;
  }
}
function widgetHTML(kind, preview = false) {
  const assets = assetSets[kind];
  const plus = (date, head = false) => `<button class="widget-plus" data-add="${date}" aria-label="${t("Добавить событие")}"><img src="../assets/${head && assets[3] ? assets[3] : assets[2]}" alt=""></button>`;
  return `<div class="widget ${kind}" ${kind === 'month' ? `data-page="${preview ? 'calendar' : compactPage}"` : ''} data-node-id="${{ month: '109:163', horizontal: '109:258', vertical: '109:154' }[kind]}"><div class="widget-title">${t(kind === 'month' && !preview && compactPage === 'events' ? "События" : "Календарь")}${kind === 'month' ? compactArrowsHTML(preview ? 'calendar' : compactPage) : ''}${!preview ? `<div class="widget-controls"><button id="widget-open" title="${t("Открыть TimeLife")}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3M5 3h8v8"/></svg></button><button id="widget-close" title="${t("Убрать виджет")}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8m0-8-8 8"/></svg></button></div>` : ''}</div>${widgetMonthHTML(kind)}<div class="widget-agenda"><div class="widget-agenda-head"><span>${kind === 'month' ? monthLabel(anchor) : t("События")}</span><button class="widget-today" id="today" aria-label="${t("Вернуться к сегодняшнему дню")}">${t("сегодня")}</button>${plus(dateKey(selected), true)}</div><div class="widget-agenda-scroll">${agendaDaysHTML(preview ? selected : agendaStart, preview ? selected.plus({ days: 6 }) : agendaEnd, assets)}</div></div></div>`;
}
function bindRoot() {
  root.querySelectorAll('[data-nav]').forEach(el => el.onclick = () => { const by = Number(el.dataset.nav); action(() => navigateDate(view === 'week' && !widgetKind ? selected.plus({ weeks: by }) : selected.plus({ months: by }))); });
  root.querySelectorAll('[data-date]').forEach(el => el.onclick = () => action(async () => { const loading = navigateDate(day(el.dataset.date)); if (widgetKind === 'month') switchCompactPage('events'); await loading; }));
  root.querySelectorAll('[data-day]').forEach(el => el.onclick = () => { selected = day(el.dataset.day); showDay(selected); });
  root.querySelectorAll('[data-event]').forEach(el => bindEventActions(el, events[Number(el.dataset.event)]));
  root.querySelectorAll('[data-add]').forEach(el => el.onclick = () => editEvent(null, day(el.dataset.add)));
  root.querySelectorAll('[data-cell]').forEach(el => el.ondblclick = e => { if (!e.target.closest('[data-event]')) editEvent(null, day(el.dataset.cell)); });
  root.querySelectorAll('[data-time-date]').forEach(el => el.ondblclick = e => { if (e.target.closest('[data-event]')) return; const mins = Math.round((e.clientY - el.getBoundingClientRect().top) / .8 / 15) * 15; editEvent(null, day(el.dataset.timeDate).plus({ minutes: Math.min(1425, mins) })); });
  root.querySelectorAll('[data-view]').forEach(el => el.onclick = () => { view = el.dataset.view; render(); if (view === 'week') root.querySelector('.week-scroll').scrollTop = 8 * 48; });
  root.querySelectorAll('[data-calendar]').forEach(el => el.onchange = () => action(async () => { const hidden = [...state.settings.hiddenCalendars].filter(id => id !== el.dataset.calendar); if (!el.checked) hidden.push(el.dataset.calendar); await api.settings({ hiddenCalendars: hidden }); }));
  const bind = (id, fn) => { const el = root.querySelector('#' + id); if (el) el.onclick = fn; };
  bind('today', () => action(() => navigateDate(now().startOf('day'))));
  bind('new-event', () => editEvent()); bind('settings', () => showSettings('appearance')); bind('widgets', () => showSettings('widgets'));
  bind('conflicts', showConflicts); bind('retry-sync', () => action(() => api.sync()));
  bind('widget-open', () => api.openApp()); bind('widget-close', () => api.closeWidget());
  root.querySelectorAll('[data-compact-page]').forEach(el => el.onclick = () => switchCompactPage(el.dataset.compactPage));
  if (!widgetKind) bindEventDragging();
  if (widgetKind === 'month') applyCompactPage();
  bindAgenda();
}
function modal(title, content, wide = false) {
  overlays.innerHTML = `<div class="modal-backdrop"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-scroll"><div class="modal-head"><h2>${esc(title)}</h2><button id="close-modal" aria-label="${t("Закрыть")}">×</button></div>${content}</div></section></div>`;
  overlays.querySelector('#close-modal').onclick = () => overlays.innerHTML = '';
  overlays.querySelector('.modal-backdrop').onclick = e => { if (e.target.classList.contains('modal-backdrop')) overlays.innerHTML = ''; };
  const first = overlays.querySelector('input,button'); first?.focus();
}
let draggedEvent = null, suppressEventClickUntil = 0;
function clearEventDrag() {
  root.querySelectorAll('.drop-target,.event-dragging').forEach(el => el.classList.remove('drop-target','event-dragging'));
  draggedEvent = null;
}
function bindEventDragging() {
  root.querySelectorAll('[data-event]').forEach(button => {
    const event = events[Number(button.dataset.event)];
    button.draggable = !eventLocked(event);
    button.ondragstart = ev => {
      if (eventLocked(event)) { ev.preventDefault(); return; }
      const cell = button.closest('[data-cell],[data-time-date],[data-drop-date]');
      const sourceDate = cell.dataset.cell || cell.dataset.timeDate || cell.dataset.dropDate;
      const grabMinutes = cell.dataset.timeDate ? (ev.clientY - cell.getBoundingClientRect().top) / .8 - eventStart(event).diff(day(sourceDate).startOf('day'),'minutes').minutes : 0;
      draggedEvent = { event, sourceDate, grabMinutes };
      ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', event.id);
      button.classList.add('event-dragging');
    };
    button.ondragend = () => { suppressEventClickUntil = performance.now() + 250; clearEventDrag(); };
  });
  root.querySelectorAll('[data-cell],[data-time-date],[data-drop-date]').forEach(cell => {
    cell.ondragover = ev => {
      if (!draggedEvent) return;
      ev.preventDefault(); ev.dataTransfer.dropEffect = 'move';
      root.querySelectorAll('.drop-target').forEach(el => { if (el !== cell) el.classList.remove('drop-target'); });
      cell.classList.add('drop-target');
      const scroller = cell.closest('.week-scroll');
      if (scroller) {
        const bounds = scroller.getBoundingClientRect();
        if (ev.clientY > bounds.bottom - 45) scroller.scrollTop += 18;
        else if (ev.clientY < bounds.top + 120) scroller.scrollTop -= 18;
      }
    };
    cell.ondragleave = ev => { if (!cell.contains(ev.relatedTarget)) cell.classList.remove('drop-target'); };
    cell.ondrop = ev => {
      if (!draggedEvent) return;
      ev.preventDefault(); ev.stopPropagation();
      const { event, sourceDate, grabMinutes } = draggedEvent;
      const targetDate = cell.dataset.cell || cell.dataset.timeDate || cell.dataset.dropDate;
      const minutes = cell.dataset.timeDate && !event.allDay ? Math.max(0,Math.min(1425,Math.round(((ev.clientY-cell.getBoundingClientRect().top)/.8-grabMinutes)/15)*15)) : null;
      suppressEventClickUntil = performance.now() + 250; clearEventDrag();
      action(async () => {
        const move = CalendarUMove.plan(event, sourceDate, targetDate, zone(), minutes);
        if (!move.changed) return;
        await api.saveEvent(move.input, move.scope); await refresh(); toast(t('Событие сохранено'));
      });
    };
  });
}
function bindEventActions(button, event) {
  button.onclick = () => { if (performance.now() >= suppressEventClickUntil) editEvent(event); };
  button.title = `${event.title} — ${t('Редактировать')} / ${t('Удалить')}`;
  button.oncontextmenu = ev => { ev.preventDefault(); action(() => api.eventMenu(event)); };
  button.onkeydown = ev => { if ((ev.shiftKey && ev.key === 'F10') || ev.key === 'ContextMenu') { ev.preventDefault(); action(() => api.eventMenu(event)); } };
}
function eventLocked(event) { return Boolean(event && (event.readOnly || event.conflict || !state.calendars.some(c => c.id === event.calendarId && c.writable))); }
function confirmDeleteEvent(event, date = selected, scope = null) {
  if (widgetKind) { api.openApp({ event, date: date.toISO(), action: 'delete' }); return; }
  if (!event || eventLocked(event)) { toast(t('Это событие доступно только для просмотра. При конфликте сначала выберите версию в основном окне.')); return; }
  let deletionScope = scope || (event.recurring ? 'occurrence' : 'series');
  const deletionHint = () => (deletionScope === 'occurrence' ? t('Будет удалено только выбранное повторение.') : event.recurring ? t('Будет удалена вся серия, включая её повторения.') : t('Событие будет удалено из календаря.')) + (event.calendarId !== 'local' ? ' ' + t('После синхронизации изменение появится на iPhone.') : '');
  modal(t('Удалить событие?'), `<p class="delete-event-title">${esc(event.title)}</p>${event.recurring && !scope ? `<label class="field" style="margin:16px 0">${t('Удалить')}<select id="delete-scope"><option value="occurrence">${t('Только это повторение')}</option><option value="series">${t('Всю серию')}</option></select></label>` : ''}<p class="hint" id="delete-hint">${deletionHint()}</p><div class="modal-footer"><button class="plain" id="keep-event">${t('Отмена')}</button><button class="primary" id="confirm-delete">${t('Удалить')}</button></div>`);
  const choice = overlays.querySelector('#delete-scope'); if (choice) choice.onchange = () => { deletionScope = choice.value; overlays.querySelector('#delete-hint').textContent = deletionHint(); };
  overlays.querySelector('#keep-event').onclick = () => { if (scope) editEvent(event, date); else overlays.innerHTML = ''; };
  overlays.querySelector('#confirm-delete').onclick = async ev => {
    const button = ev.currentTarget; button.disabled = true;
    const deleted = await action(async () => { await api.deleteEvent(event, deletionScope); return true; });
    if (deleted) { overlays.innerHTML = ''; await refresh(); toast(t('Событие удалено')); } else button.disabled = false;
  };
}
function showDay(d) {
  const items = forDay(d);
  modal(dateLabel(d), `<div class="day-list">${items.map(e => `<button data-list-event="${eventIndex(e)}" style="--cal-color:${color(e.calendarId)}">${esc(e.title)}<small>${rangeText(e)} · ${esc(calendarName(state.calendars.find(c => c.id === e.calendarId)))}</small></button>`).join('') || `<p class="empty-list">${t("Событий нет")}</p>`}</div><div class="modal-footer"><button class="primary" id="day-add">${t("＋ Добавить событие")}</button></div>`);
  overlays.querySelectorAll('[data-list-event]').forEach(el => bindEventActions(el, events[Number(el.dataset.listEvent)]));
  overlays.querySelector('#day-add').onclick = () => editEvent(null, d);
}
const timezoneList = () => [...new Set([zone(), 'UTC', 'Europe/Moscow', 'Europe/London', 'Europe/Berlin', 'Asia/Yekaterinburg', 'Asia/Novosibirsk', 'Asia/Vladivostok', 'Asia/Dubai', 'Asia/Tokyo', 'America/New_York', 'America/Los_Angeles', ...Intl.supportedValuesOf('timeZone')])];
const options = (items, val) => items.map(([v, label]) => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(label)}</option>`).join('');
const zoneOptions = val => options([...new Set([val, ...timezoneList()])].map(z => [z, z]), val);
function editEvent(e = null, d = selected) {
  if (widgetKind) { api.openApp({ event: e, date: d.toISO() }); return; }
  const writable = state.calendars.filter(c => c.writable);
  if (!e && !writable.length) { toast((t("Нет календаря с правом создания событий. Проверьте доступ к календарям iCloud."))); return; }
  const locked = eventLocked(e);
  const tz = e?.zone && !['floating', 'UTC'].includes(e.zone) ? e.zone : e?.zone === 'UTC' ? 'UTC' : zone();
  let start = e ? DT.fromISO(e.start, { zone: e.allDay ? tz : undefined }).setZone(tz) : d.setZone(tz).set({ hour: d.hour || 12, minute: d.minute || 0 });
  let end = e ? DT.fromISO(e.end, { zone: e.allDay ? tz : undefined }).setZone(tz) : start.plus({ hours: 1 });
  const fmt = dt => dt.toFormat("yyyy-MM-dd'T'HH:mm");
  modal(e ? (t("Событие")) : (t("Новое событие")), `<form id="event-form"><div class="form-grid"><label class="field full">${t("Название")}<input name="title" value="${esc(e?.title || '')}" required maxlength="500" autofocus></label><label class="field full">${t("Календарь")}<select name="calendarId">${options((locked ? state.calendars.filter(c => c.id === e.calendarId) : writable).map(c => [c.id, calendarName(c)]), e?.calendarId || writable.find(c => c.id !== 'local')?.id || 'local')}</select></label><label class="check-field full"><input type="checkbox" name="allDay" ${e?.allDay ? 'checked' : ''}>${t("Весь день")}</label><label class="field">${t("Начало")}<input name="start" type="${e?.allDay ? 'date' : 'datetime-local'}" value="${e?.allDay ? start.toISODate() : fmt(start)}" required></label><label class="field">${t("Конец")}${e?.allDay ? (" "+t("(не включая)")) : ''}<input name="end" type="${e?.allDay ? 'date' : 'datetime-local'}" value="${e?.allDay ? end.toISODate() : fmt(end)}" required></label><label class="field full">${t("Часовой пояс")}<select name="zone">${zoneOptions(tz)}</select></label>${e?.recurring ? `<label class="field full">${t("Изменить")}<select name="scope"><option value="occurrence">${t("Только это повторение")}</option><option value="series">${t("Всю серию")}</option></select></label>` : ''}<label class="field full">${t("Повторение")}<select name="repeat">${options([['', (t("Не повторять"))], ['FREQ=DAILY', (t("Каждый день"))], ['FREQ=WEEKLY', (t("Каждую неделю"))], ['FREQ=MONTHLY', (t("Каждый месяц"))], ['FREQ=YEARLY', (t("Каждый год"))], ['custom', (t("Своё правило (RRULE)"))]], ['', 'FREQ=DAILY', 'FREQ=WEEKLY', 'FREQ=MONTHLY', 'FREQ=YEARLY'].includes(e?.recurrence || '') ? e?.recurrence || '' : 'custom')}</select></label><label class="field full" id="custom-rule">${t("Правило RRULE")}<input name="rule" value="${esc(e?.recurrence || '')}" placeholder="FREQ=WEEKLY;BYDAY=MO,WE;COUNT=12"><small>${t("Поддерживаются интервалы, дни недели, COUNT и UNTIL.")}</small></label><label class="field full">${t("Место")}<input name="location" value="${esc(e?.location || '')}" maxlength="2000"></label><label class="field full">${t("Заметки")}<textarea name="description" maxlength="20000">${esc(e?.description || '')}</textarea></label></div>${locked ? `<p class="hint" style="margin-top:15px">${t("Это событие доступно только для просмотра. При конфликте сначала выберите версию в основном окне.")}</p>` : ''}<p class="error" id="event-error" role="alert"></p><div class="modal-footer">${e && !locked ? `<button type="button" class="danger" id="delete-event">${t("Удалить")}</button>` : ''}<button type="button" class="plain" id="cancel-event">${t("Закрыть")}</button>${!locked ? `<button class="primary" type="submit">${t("Сохранить")}</button>` : ''}</div></form>`);
  const form = overlays.querySelector('#event-form'), err = overlays.querySelector('#event-error');
  const updateRepeat = () => { const occurrence = form.elements.scope?.value === 'occurrence'; form.elements.repeat.disabled = occurrence; form.elements.rule.disabled = occurrence; overlays.querySelector('#custom-rule').style.display = form.elements.repeat.value === 'custom' ? 'grid' : 'none'; };
  form.elements.repeat.onchange = updateRepeat; updateRepeat();
  if (form.elements.scope) form.elements.scope.onchange = () => {
    if (form.elements.scope.value === 'series' && e.seriesStart) {
      start = DT.fromISO(e.seriesStart, { zone: e.allDay ? tz : undefined }).setZone(tz); end = DT.fromISO(e.seriesEnd, { zone: e.allDay ? tz : undefined }).setZone(tz);
    } else { start = DT.fromISO(e.start, { zone: e.allDay ? tz : undefined }).setZone(tz); end = DT.fromISO(e.end, { zone: e.allDay ? tz : undefined }).setZone(tz); }
    form.elements.start.value = form.elements.allDay.checked ? start.toISODate() : fmt(start); form.elements.end.value = form.elements.allDay.checked ? end.toISODate() : fmt(end); updateRepeat();
  };
  form.elements.allDay.onchange = () => {
    const all = form.elements.allDay.checked;
    for (const name of ['start', 'end']) { const val = form.elements[name].value; form.elements[name].type = all ? 'date' : 'datetime-local'; form.elements[name].value = all ? val.slice(0, 10) : val.slice(0, 10) + (name === 'start' ? 'T12:00' : 'T13:00'); }
    if (all && form.elements.end.value <= form.elements.start.value) form.elements.end.value = DT.fromISO(form.elements.start.value).plus({ days: 1 }).toISODate();
  };
  overlays.querySelector('#cancel-event').onclick = () => overlays.innerHTML = '';
  if (locked) [...form.elements].forEach(el => { if (!['cancel-event'].includes(el.id)) el.disabled = true; });
  form.onsubmit = async ev => {
    ev.preventDefault(); const button = form.querySelector('[type=submit]'); button.disabled = true;
    const input = { ...e, title: form.elements.title.value, calendarId: form.elements.calendarId.value, allDay: form.elements.allDay.checked, start: form.elements.start.value, end: form.elements.end.value, zone: form.elements.zone.value, displayZone: zone(), recurrence: form.elements.repeat.value === 'custom' ? form.elements.rule.value.trim().toUpperCase() : form.elements.repeat.value, location: form.elements.location.value, description: form.elements.description.value };
    try { await api.saveEvent(input, form.elements.scope?.value || 'series'); overlays.innerHTML = ''; await refresh(); toast((t("Событие сохранено"))); }
    catch (error) { err.textContent = errorText(error.message); button.disabled = false; }
  };
  const remove = overlays.querySelector('#delete-event'); if (remove) remove.onclick = () => confirmDeleteEvent(e, d, form.elements.scope?.value || 'series');
}
function showSettings(tab = settingsTab) {
  settingsTab = tab;
  modal((t("Настройки")), `<nav class="settings-tabs">${[['appearance', (t("Оформление"))], ['widgets', (t("Виджеты"))], ['calendar', (t("Календарь"))], ['account', 'iCloud']].map(([id, title]) => `<button data-tab="${id}" class="${id === tab ? 'active' : ''}">${title}</button>`).join('')}</nav><div class="settings-content">${settingsHTML(tab)}</div><p class="hint" style="margin-top:20px">${t("Настройки сохраняются автоматически.")}</p><div class="legal-links">${[['terms','Условия использования'],['privacy','Конфиденциальность'],['notices','Лицензии компонентов'],['source','Исходники MPL']].map(([id,label])=>`<button class="plain" data-legal="${id}">${t(label)}</button>`).join('')}</div>`, true);
  overlays.querySelectorAll('[data-legal]').forEach(button => button.onclick = () => action(() => api.openLegal(button.dataset.legal)));
  overlays.querySelectorAll('[data-tab]').forEach(el => el.onclick = () => showSettings(el.dataset.tab));
  overlays.querySelectorAll('[data-theme-choice]').forEach(el => el.onclick = async () => { await action(() => api.settings({ theme: el.dataset.themeChoice })); await refresh(); showSettings(tab); });
  overlays.querySelectorAll('[data-setting]').forEach(el => {
    const isRange = el.type === 'range';
    const handler = async () => { const key = el.dataset.setting, val = el.type === 'checkbox' ? el.checked : ['firstDay', 'syncMinutes', 'lightOpacity', 'darkOpacity'].includes(key) ? Number(el.value) : el.value; if (isRange) { el.nextElementSibling.textContent = el.value + '%'; if (key === state.settings.theme + 'Opacity') document.documentElement.style.setProperty('--opacity', Number(el.value) / 100); } await action(() => api.settings({ [key]: val })); };
    el.onchange = async () => { await handler(); if (el.dataset.setting === 'language') { await refresh(); showSettings(tab); } };
    if (isRange) el.oninput = () => { el.nextElementSibling.textContent = el.value + '%'; const current = state.settings.theme === 'dark' ? 'darkOpacity' : 'lightOpacity'; if (el.dataset.setting === current) document.documentElement.style.setProperty('--opacity', Number(el.value) / 100); };
  });
  overlays.querySelectorAll('[data-widget-choice]').forEach(el => el.onclick = async () => { await action(() => api.settings({ widget: el.dataset.widgetChoice })); await refresh(); showSettings(tab); });
  const connect = overlays.querySelector('#account-form'); if (connect) connect.onsubmit = async ev => { ev.preventDefault(); const btn = connect.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = (t("Подключение…")); try { await api.connect({ email: connect.elements.email.value, password: connect.elements.password.value }); connect.elements.password.value = ''; await refresh(); showSettings('account'); } catch (e) { overlays.querySelector('#account-error').textContent = errorText(e.message); btn.disabled = false; btn.textContent = (t("Подключить iCloud")); } };
  const apple = overlays.querySelector('#apple-link'); if (apple) apple.onclick = () => api.openApple();
  const sync = overlays.querySelector('#sync-now'); if (sync) sync.onclick = async () => { sync.disabled = true; await action(() => api.sync()); await refresh(); showSettings('account'); };
  const disconnect = overlays.querySelector('#disconnect'); if (disconnect) disconnect.onclick = () => {
    modal((t("Отключить iCloud?")), `<p class="hint">${t("Сохранённый пароль и копии синхронизированных событий будут удалены с компьютера. События в iCloud и локальный календарь останутся.")}</p><div class="modal-footer"><button class="plain" id="cancel-disconnect">${t("Отмена")}</button><button class="primary" id="confirm-disconnect">${t("Отключить")}</button></div>`);
    overlays.querySelector('#cancel-disconnect').onclick = () => showSettings('account');
    overlays.querySelector('#confirm-disconnect').onclick = async () => { if (await action(async () => { await api.disconnect(); return true; })) { await refresh(); showSettings('account'); } };
  };
}
function settingRow(title, hint, control) { return `<div class="setting-row"><div>${title}${hint ? `<small>${hint}</small>` : ''}</div>${control}</div>`; }
function settingsHTML(tab) {
  const s = state.settings;
  if (tab === 'appearance') return `${settingRow((t("Язык")), (t("Язык приложения и виджетов")), `<select data-setting="language" aria-label="${t("Язык")}">${options(CalendarUI18n.languages, s.language)}</select>`)}${settingRow((t("Тема")), (t("Для приложения и всех виджетов")), `<div class="theme-choices"><button class="theme-choice ${s.theme === 'light' ? 'active' : ''}" data-theme-choice="light">${t("☼ Светлая")}</button><button class="theme-choice ${s.theme === 'dark' ? 'active' : ''}" data-theme-choice="dark">${t("☾ Тёмная")}</button></div>`)}${['light', 'dark'].map(mode => settingRow(t(mode === 'light' ? 'Непрозрачность светлого фона' : 'Непрозрачность тёмного фона'), (t("Непрозрачность фона виджета. При включённом блюре смешивается со стеклом.")), `<div style="display:flex;align-items:center;gap:15px"><input aria-label="${t(mode === 'light' ? 'Непрозрачность светлого фона' : 'Непрозрачность тёмного фона')}" type="range" min="0" max="100" data-setting="${mode}Opacity" value="${s[mode + 'Opacity']}"><span style="width:45px">${s[mode + 'Opacity']}%</span></div>`)).join('')}${settingRow(t("Блюр фона виджета"), t("Системное размытие Acrylic. Чтобы видеть эффект, уменьшите непрозрачность фона."), `<input aria-label="${t("Блюр фона виджета")}" type="checkbox" data-setting="blur" ${s.blur ? 'checked' : ''}>`)}${settingRow((t("Выделение дня")), (t("5% чёрного в светлой теме, 5% белого в тёмной")), '<span style="background:var(--selected);border-radius:5px;width:35px;height:35px;display:grid;place-items:center">2</span>')}`;
  if (tab === 'widgets') return `<div class="widgets-layout"><div class="widget-options">${[['none', (t("Без виджета")), ''], ['month', (t("Календарь")), '350 × 412'], ['horizontal', (t("Календарь и события")), (t("700 × 412 · горизонтальный"))], ['vertical', (t("Календарь и события")), (t("350 × 840 · вертикальный"))]].map(([id, title, hint]) => `<button class="widget-option ${s.widget === id ? 'active' : ''}" data-widget-choice="${id}">${title}<small>${hint}</small></button>`).join('')}</div><div class="preview-stage"><div class="preview-scale ${s.widget === 'vertical' ? 'vertical' : ''}">${widgetHTML(s.widget === 'none' ? 'month' : s.widget, true)}</div></div></div>${settingRow((t("Поверх других окон")), (t("По умолчанию виджет находится на уровне обычного окна")), `<input aria-label="${t("Поверх других окон")}" type="checkbox" data-setting="widgetTop" ${s.widgetTop ? 'checked' : ''}>`)}<p class="hint" style="margin-top:15px">${t("Перемещайте виджет за заголовок «Календарь». При наведении появятся кнопки открытия приложения и скрытия виджета.")}</p>`;
  if (tab === 'calendar') return `${settingRow((t("Часовой пояс")), (t("События показываются в выбранном часовом поясе")), `<select data-setting="zone" aria-label="${t("Часовой пояс")}">${zoneOptions(s.zone)}</select>`)}${settingRow((t("Начало недели")), '', `<select data-setting="firstDay" aria-label="${t("Начало недели")}">${options([[1, (t("Понедельник"))], [0, (t("Воскресенье"))], [6, (t("Суббота"))]], s.firstDay)}</select>`)}${settingRow((t("12-часовой формат")), (t("Выключено — время в формате 24 часов")), `<input type="checkbox" data-setting="hour12" ${s.hour12 ? 'checked' : ''}>`)}${settingRow((t("Номера недель")), (t("В основном календаре")), `<input type="checkbox" data-setting="weekNumbers" ${s.weekNumbers ? 'checked' : ''}>`)}${settingRow((t("Показывать выходные")), (t("В видах месяца и недели. Виджет всегда показывает 7 дней.")), `<input type="checkbox" data-setting="showWeekends" ${s.showWeekends ? 'checked' : ''}>`)}${settingRow((t("Запуск вместе с Windows")), '', `<input type="checkbox" data-setting="autoStart" ${s.autoStart ? 'checked' : ''}>`)}`;
  return `${state.connected ? `<div class="account-box"><h3>${t("iCloud подключён")}</h3><p class="hint">${esc(state.email)}</p><p class="hint">${state.lastSync ? (t("Последняя синхронизация:")+" ") + day(state.lastSync).toLocaleString(DT.DATETIME_SHORT) : (t("Первое обновление ещё не завершено"))}</p><p class="hint">${t("Изменений в очереди:")+" "}${state.pending}</p>${state.syncError ? `<p class="error">${esc(t(state.syncError))}</p>` : ''}<div class="modal-footer"><button class="danger" id="disconnect">${t("Отключить")}</button><button class="plain" id="sync-now">${t("Синхронизировать сейчас")}</button></div></div>` : `<p class="hint" style="margin-bottom:20px">${t("На iPhone включите «Настройки → ваше имя → iCloud → Календарь». Создайте пароль приложения в Apple Account с включённой двухфакторной аутентификацией и введите его здесь.")}</p><form id="account-form"><div class="form-grid"><label class="field">Apple Account<input name="email" type="email" placeholder="name@icloud.com" autocomplete="username" required></label><label class="field">${t("Пароль приложения")}<input name="password" type="password" placeholder="xxxx-xxxx-xxxx-xxxx" autocomplete="off" required></label></div><p id="account-error" class="error"></p><div class="modal-footer"><button type="button" class="plain" id="apple-link">${t("Открыть Apple Account ↗")}</button><button type="submit" class="primary">${t("Подключить iCloud")}</button></div></form>`}${settingRow((t("Частота синхронизации")), (t("Также обновляется после сохранения события")), `<select data-setting="syncMinutes">${options([1, 5, 10, 15, 30].map(n => [n, t('Каждые {n} мин.', {n})]), s.syncMinutes)}</select>`)}<p class="hint" style="margin-top:20px">${t("Пароль хранится локально и шифруется средствами Windows. TimeLife обращается напрямую к iCloud. События календаря «На компьютере» остаются локальными.")}</p>`;
}
function showConflicts() {
  modal((t("Изменения на двух устройствах")), `<p class="hint">${t("Пока вы редактировали событие, его версия в iCloud изменилась. Выберите версию для каждого события.")}</p>${state.conflicts.map(c => `<div class="conflict-card"><div class="conflict-versions"><div><small>${t("На компьютере")}</small><p>${c.deleted ? (t("Удалено")) : esc(c.local.title)}</p><p>${esc(c.local.start)}</p><p>${esc(c.local.description)}</p></div><div><small>${t("В iCloud")}</small><p>${c.remote ? esc(c.remote.title) : (t("Удалено"))}</p><p>${esc(c.remote?.start)}</p><p>${esc(c.remote?.description)}</p></div></div><div class="modal-footer"><button class="plain" data-resolve="remote" data-id="${esc(c.id)}">${t("Оставить iCloud")}</button><button class="primary" data-resolve="local" data-id="${esc(c.id)}">${t("Оставить мою версию")}</button></div></div>`).join('') || `<p class="empty-list">${t("Все конфликты разрешены")}</p>`}`, true);
  overlays.querySelectorAll('[data-resolve]').forEach(el => el.onclick = async () => { await action(() => api.resolve(el.dataset.id, el.dataset.resolve)); await refresh(); showConflicts(); });
}
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') overlays.innerHTML = '';
  if (ev.key === 'Tab' && overlays.children.length) { const focusable = [...overlays.querySelectorAll('button,input,select,textarea')].filter(el => !el.disabled && el.getClientRects().length); const first = focusable[0], last = focusable.at(-1); if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); } else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); } }
});
if (widgetKind) { document.body.classList.add('widget-body'); document.documentElement.classList.add('widget-root'); }
api.onChange(() => action(refresh));
const startup = action(refresh);
api.onEdit?.(request => { if (!widgetKind) action(async () => { await startup; await refresh(); const date = request.date ? day(request.date) : selected; if (request.action === 'delete') confirmDeleteEvent(request.event, date); else editEvent(request.event, date); }); });
