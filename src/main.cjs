const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, safeStorage, shell, screen, dialog, nativeTheme } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { Store } = require('./core/store.cjs');
const { roundedWidgetRegion } = require('./core/widget-shape.cjs');
const { CalDAV } = require('./core/caldav.cjs');
const { expand } = require('./core/calendar.cjs');
const { disconnectLocalAccount } = require('./core/privacy.cjs');
const { EventService } = require('./core/event-service.cjs');
const eventCache = new EventService();
const { translate } = require('./ui/i18n.js');
const nativeText = key => translate(key, store?.data.settings.language || 'ru');
const { DateTime } = require('luxon');
const smoke = process.argv.includes('--smoke');
const sizing = process.argv.includes('--qa-sizing');
const qa = process.argv.includes('--qa') || smoke || sizing;
if (qa) app.setPath('userData', smoke ? path.join(app.getPath('temp'), 'calendar-u-smoke-' + process.pid) : path.join(__dirname, '../qa/data'));
// Preserve the existing profile and its DPAPI key after the product rename.
else app.setPath('userData', path.join(app.getPath('appData'), 'Calendar U'));
app.setName('TimeLife');
if (!app.requestSingleInstanceLock()) { app.quit(); } else {
  app.on('second-instance', () => showApp());
  app.whenReady().then(start).catch(error => { dialog.showErrorBox('TimeLife', error.message); app.quit(); });
}
let store, main, widget, tray, timer, quitting = false, account = null, syncError = null, syncing = false;
let operations = Promise.resolve();
function serial(fn) { const p = operations.then(fn); operations = p.catch(() => {}); return p; }
function broadcast() { for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('changed'); }
function secureWindow({ beforeShow, ...options }) {
  const win = new BrowserWindow({ icon: path.join(__dirname, 'assets/icon.png'), show: false, ...options, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false, offscreen: qa && !sizing } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.widgetReady = new Promise((resolve, reject) => { win.once('ready-to-show', async () => { try { if (beforeShow) await beforeShow(win); if (!qa && !win.isDestroyed()) win.show(); resolve(); } catch(e) { reject(e); } }); });
  win.widgetReady.catch(error => { if (!win.isDestroyed()) console.error(error); });
  return win;
}
function showApp() {
  if (!main || main.isDestroyed()) {
    main = secureWindow({ width: 1280, height: 840, minWidth: 960, minHeight: 650, title: 'TimeLife', backgroundColor: '#f6f6f6', autoHideMenuBar: true });
    main.loadFile(path.join(__dirname, 'ui/index.html'));
    main.on('close', e => { if (!quitting && !qa) { e.preventDefault(); main.hide(); } });
  } else if (!qa) { main.show(); main.focus(); }
}
function openEventRequest(request) {
  showApp(); if (!request) return;
  const send = () => { if (main && !main.isDestroyed()) main.webContents.send('edit-request', request); };
  if (main.webContents.isLoading()) main.webContents.once('did-finish-load', send); else send();
}
function eventMenuTemplate(event) {
  const resource = store.data.resources.find(r => r.id === event?.id && r.calendarId === event?.calendarId && !r.deleted);
  const calendar = store.data.calendars.find(c => c.id === event?.calendarId);
  const locked = !resource || !calendar?.writable || Boolean(resource.conflict || event.readOnly);
  return [
    { label: nativeText('Редактировать'), enabled: !locked, click: () => openEventRequest({ event, action: 'edit' }) },
    { label: nativeText('Удалить'), enabled: !locked, click: () => openEventRequest({ event, action: 'delete' }) }
  ];
}
function createWidget() {
  if (widget && !widget.isDestroyed()) widget.destroy(); widget = null;
  const blurEnabled = Boolean(store.data.settings.blur);
  const kind = store.data.settings.widget; if (kind === 'none') return;
  const sizes = { month: [350, 412], horizontal: [700, 412], vertical: [350, 840] };
  const [width, height] = sizes[kind];
  const work = screen.getPrimaryDisplay().workArea;
  let bounds = store.data.settings.widgetPosition || { x: work.x + work.width - width - 30, y: work.y + 30 };
  const visible = screen.getAllDisplays().some(d => bounds.x >= d.workArea.x && bounds.y >= d.workArea.y && bounds.x + 50 < d.workArea.x + d.workArea.width && bounds.y + 50 < d.workArea.y + d.workArea.height);
  if (!visible) bounds = { x: work.x + 30, y: work.y + 30 };
  let requestedWidth = width + (blurEnabled ? 16 : 0), requestedHeight = height + (blurEnabled ? 8 : 0);
  const beforeShow = async win => {
    if (!blurEnabled) return;
    if (win.isDestroyed()) return;
    // Wait for the initial native DPI resize before measuring Chromium's viewport.
    await new Promise(resolve => setTimeout(resolve, 100));
    // Native border metrics can differ after a per-monitor DPI conversion.
    for (let attempt = 0; attempt < 8 && !win.isDestroyed(); attempt++) {
      const actual = await win.webContents.executeJavaScript('({width:innerWidth,height:innerHeight})');
      const dx = width - actual.width, dy = height - actual.height;
      if (!dx && !dy) break;
      requestedWidth += dx; requestedHeight += dy;
      win.setSize(requestedWidth, requestedHeight);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // Keep the native frame style stable while moving; reject user resizing below.
  };
  widget = secureWindow({ beforeShow, width, height, x: Math.round(bounds.x), y: Math.round(bounds.y), frame: false, useContentSize: true, thickFrame: blurEnabled, transparent: !blurEnabled, backgroundMaterial: blurEnabled ? 'acrylic' : 'none', roundedCorners: true, resizable: blurEnabled, maximizable: false, minimizable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: store.data.settings.widgetTop, backgroundColor: '#00000000', title: 'TimeLife — виджет' });
  // Reapply client dimensions after Windows initializes the Acrylic/non-layered window.
  // Electron 41 subtracts the hidden Windows frame (16x8 DIP) in this mode.
  if (blurEnabled) widget.setSize(requestedWidth, requestedHeight);
  else widget.setContentSize(width, height);
  // Transparent windows use a custom 20px region; Acrylic uses DWM rounded corners.
  const targetWidget = widget;
  // Changing WS_THICKFRAME after sizing makes Windows shrink the client area on move.
  targetWidget.on('will-resize', event => event.preventDefault());
  const applyShape = () => { if (targetWidget.isDestroyed()) return; if (!blurEnabled) targetWidget.setShape(roundedWidgetRegion(width, height, 20)); };
  applyShape();
  widget.on('resize', applyShape);
  widget.once('ready-to-show', applyShape);
  widget.loadFile(path.join(__dirname, 'ui/index.html'), { query: { widget: kind } });
  let geometryReady = false, repairingSize = false, sizeRepair;
  targetWidget.widgetReady.then(() => { geometryReady = true; }).catch(() => {});
  const preserveSize = () => {
    if (!blurEnabled || !geometryReady || repairingSize || targetWidget.isDestroyed()) return;
    clearTimeout(sizeRepair);
    sizeRepair = setTimeout(async () => {
      if (targetWidget.isDestroyed()) return;
      repairingSize = true;
      try {
        const actual = await targetWidget.webContents.executeJavaScript('({width:innerWidth,height:innerHeight})');
        if (actual.width !== width || actual.height !== height) {
          // Reapply the absolute size, rather than reusing rounded bounds from a move.
          targetWidget.setSize(requestedWidth, requestedHeight);
        }
      } catch (error) { if (!targetWidget.isDestroyed()) console.error(error); }
      finally { repairingSize = false; }
    }, 20);
  };
  targetWidget.on('resize', preserveSize);
  targetWidget.on('moved', preserveSize);
  targetWidget.on('closed', () => clearTimeout(sizeRepair));

  let savePosition;
  widget.on('moved', () => { clearTimeout(savePosition); savePosition = setTimeout(() => { if (!targetWidget.isDestroyed()) serial(() => { if (targetWidget.isDestroyed()) return; const [x, y] = targetWidget.getPosition(); store.data.settings.widgetPosition = { x, y }; store.save(); }); }, 250); });
  widget.on('closed', () => clearTimeout(savePosition));
}
function resetTimer() { clearInterval(timer); timer = setInterval(() => { if (account) serial(sync).catch(() => {}); }, store.data.settings.syncMinutes * 60000); timer.unref(); }
function publicState() {
  const hasCloud = store.data.calendars.some(c => c.id !== 'local');
  const hasLocalEvents = store.data.resources.some(r => r.calendarId === 'local' && !r.deleted);
  const calendars = store.data.calendars.filter(c => c.id !== 'local' || !hasCloud || hasLocalEvents);
  return { settings: store.data.settings, calendars, appearance: systemAppearance(), lastSync: store.data.lastSync, connected: Boolean(account), email: account?.email || '', syncing, syncError,
    pending: store.data.resources.filter(x => x.pending).length,
    conflicts: store.data.resources.filter(x => x.conflict).map(x => ({ id: x.id, deleted: Boolean(x.deleted), local: summarize(x.ics), remote: x.conflict.remote ? summarize(x.conflict.remote) : null })) };
}
function systemAppearance() { return { accent: '#d9d9d9', source: 'fixed' }; }
function summarize(ics) { const { parse } = require('./core/calendar.cjs'); try { const c = parse(ics).getFirstSubcomponent('vevent'); return { title: c.getFirstPropertyValue('summary') || 'Без названия', start: c.getFirstPropertyValue('dtstart')?.toString(), description: c.getFirstPropertyValue('description') || '' }; } catch { return { title: 'Событие', description: '' }; } }
async function sync() {
  if (!account) return publicState();
  syncing = true; syncError = null; broadcast();
  try { await store.synchronize(new CalDAV(account)); }
  catch (e) { syncError = e.name === 'TimeoutError' || e.name === 'TypeError' ? 'Нет связи с iCloud. Изменения сохранены на компьютере и будут отправлены при восстановлении связи.' : e.message; }
  finally { syncing = false; broadcast(); }
  return publicState();
}
const accountFile = () => path.join(app.getPath('userData'), 'account.enc');
async function saveAccount(value) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows не предоставила защищённое хранилище пароля');
  const encrypted = safeStorage.encryptString(JSON.stringify(value));
  fs.writeFileSync(accountFile() + '.tmp', encrypted); fs.renameSync(accountFile() + '.tmp', accountFile());
}
function checkSettings(patch) {
  const allowed = ['language', 'theme', 'lightOpacity', 'darkOpacity', 'blur', 'zone', 'firstDay', 'hour12', 'weekNumbers', 'showWeekends', 'widget', 'widgetTop', 'autoStart', 'syncMinutes', 'hiddenCalendars'];
  const s = { ...store.data.settings }; for (const [k, v] of Object.entries(patch)) if (allowed.includes(k)) s[k] = v;
  if (!['ru', 'en', 'ko', 'fr', 'ja', 'zh'].includes(s.language)) throw new Error('Некорректный язык');
  if (!['light', 'dark'].includes(s.theme) || !['none', 'month', 'horizontal', 'vertical'].includes(s.widget)) throw new Error('Некорректные настройки');
  if (![0, 1, 6].includes(Number(s.firstDay)) || !DateTime.now().setZone(s.zone).isValid) throw new Error('Некорректный часовой пояс или начало недели');
  for (const key of ['lightOpacity', 'darkOpacity']) if (!Number.isFinite(Number(s[key])) || s[key] < 0 || s[key] > 100) throw new Error('Некорректная прозрачность');
  if (![1, 5, 10, 15, 30].includes(Number(s.syncMinutes))) throw new Error('Некорректный интервал обновления');
  if (!Array.isArray(s.hiddenCalendars) || s.hiddenCalendars.some(x => typeof x !== 'string')) throw new Error('Некорректный список календарей');
  for (const k of ['blur', 'hour12', 'weekNumbers', 'showWeekends', 'widgetTop', 'autoStart']) if (typeof s[k] !== 'boolean') throw new Error('Некорректная настройка');
  return s;
}
async function start() {
  store = new Store(app.getPath('userData'));
  nativeTheme.themeSource = store.data.settings.theme;
  if (fs.existsSync(accountFile())) { try { account = JSON.parse(safeStorage.decryptString(fs.readFileSync(accountFile()))); } catch { syncError = 'Не удалось прочитать сохранённый пароль. Подключите iCloud заново.'; } }
  Menu.setApplicationMenu(null);
  for (const [channel, fn] of Object.entries({
    'state': () => publicState(),
    'events': (_, from, to) => { if (!DateTime.fromISO(from).isValid || !DateTime.fromISO(to).isValid || DateTime.fromISO(to).diff(DateTime.fromISO(from), 'days').days > 400) throw new Error('Некорректный диапазон дат'); return eventCache.get(store.data.resources.filter(r => store.data.calendars.some(c => c.id === r.calendarId) && !store.data.settings.hiddenCalendars.includes(r.calendarId)), from, to); },
    'save-event': (_, input, scope) => serial(() => { const id = store.upsert(input, scope); broadcast(); if (account) serial(sync); return id; }),
    'delete-event': (_, input, scope) => serial(() => { store.remove(input, scope); broadcast(); if (account) serial(sync); }),
    'settings': (_, patch) => serial(() => { const s = checkSettings(patch), changed = s.widget !== store.data.settings.widget || Boolean(s.blur) !== Boolean(store.data.settings.blur); store.data.settings = s; nativeTheme.themeSource = s.theme; store.save(); if (changed) createWidget(); else if (widget) widget.setAlwaysOnTop(s.widgetTop); if (!qa) app.setLoginItemSettings({ openAtLogin: s.autoStart, args: ['--background'] }); updateNativeMenu(); resetTimer(); broadcast(); return publicState(); }),
    'connect': (_, value) => serial(async () => { const email = String(value.email || '').trim(), password = String(value.password || '').trim(); if (!email || !password) throw new Error('Введите Apple Account и пароль приложения'); if (account && account.email !== email) throw new Error('Сначала отключите текущий аккаунт'); const next = { email, password }; const calendars = await new CalDAV(next).discover(); await saveAccount(next); account = next; store.data.calendars = store.data.calendars.filter(c => c.id === 'local').concat(calendars); store.save(); await sync(); return publicState(); }),
    'disconnect': () => serial(async () => {
      await disconnectLocalAccount(store, accountFile(), eventCache);
      account = null; syncError = null;
      // Reload every renderer to discard open editors and event snapshots.
      for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.reload();
      broadcast();
    }),
    'sync': () => serial(sync),
    'resolve': (_, id, choice) => serial(() => { store.resolve(id, choice); broadcast(); if (account) serial(sync); }),
    'open-app': (_, request) => openEventRequest(request),
    'event-menu': (sender, event) => { const owner = BrowserWindow.fromWebContents(sender.sender); Menu.buildFromTemplate(eventMenuTemplate(event)).popup({ window: owner }); },
    'close-widget': () => serial(() => { store.data.settings.widget = 'none'; store.save(); createWidget(); broadcast(); }),
    'open-legal': (_, name) => {
      const allowed = { terms: 'terms.html', privacy: 'privacy.html', notices: 'THIRD-PARTY-NOTICES.txt', source: 'open-source' };
      if (!Object.hasOwn(allowed, name)) throw new Error('Недопустимый источник запроса');
      return shell.openPath(path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '../distribution'), 'legal', allowed[name]));
    },
    'open-apple': () => shell.openExternal('https://account.apple.com/')
  })) ipcMain.handle(channel, (event, ...args) => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    if (channel === 'events' && (!sender || ![main, widget].includes(sender))) return { events: [], errors: [] };
    if (!sender || ![main, widget].includes(sender) || !event.senderFrame.url.startsWith('file:')) throw new Error('Недопустимый источник запроса');
    return fn(event, ...args);
  });
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets/icon.png')));
  tray.setToolTip('TimeLife');
  updateNativeMenu();
  tray.on('double-click', showApp);
  if (!process.argv.includes('--background') || store.data.settings.widget === 'none') showApp();
  createWidget(); resetTimer();
  if (account && !qa) serial(sync);
  if (sizing) { try { await require('../scripts/widget-sizing.cjs').run({app,store,createWidget,getWidget:()=>widget}); } catch(e) { console.error(e); app.exit(1); } } else if (smoke) await runSmoke(); else if (qa) await runQA();
}
app.on('before-quit', () => { quitting = true; clearInterval(timer); });
app.on('window-all-closed', () => {});
function updateNativeMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([{ label: nativeText('Открыть TimeLife'), click: showApp }, { label: nativeText('Показать виджет'), click: () => { if (widget) widget.show(); else { store.data.settings.widget = 'month'; store.save(); createWidget(); broadcast(); } } }, { label: nativeText('Синхронизировать'), click: () => serial(sync) }, { type: 'separator' }, { label: nativeText('Выход'), click: () => { quitting = true; app.quit(); } }]));
  if (widget) widget.setTitle(nativeText('TimeLife — виджет'));
}
async function runQA() {
  try { await require('../scripts/qa.cjs').run({ app, main, store, createWidget, getWidget: () => widget, broadcast, eventMenuTemplate }); }
  catch (e) { console.error(e); app.exit(1); }
}
async function runSmoke() {
  const assert = require('node:assert/strict');
  try {
    if (main.webContents.isLoading()) await new Promise(r => main.webContents.once('did-finish-load', r));
    store.upsert({ calendarId: 'local', title: 'Проверка сборки', start: '2026-10-02T12:00', end: '2026-10-02T13:00', zone: 'Europe/Moscow' }, 'series');
    const count = await main.webContents.executeJavaScript("(async()=>{await refresh();await document.fonts.ready;return document.querySelectorAll('.month-cell').length})()");
    assert.equal(count, 42);
    store.data.settings.widget = 'horizontal'; createWidget();
    await new Promise(r => widget.webContents.once('did-finish-load', r));
    const geometry = await widget.webContents.executeJavaScript("(async()=>{await refresh();await document.fonts.ready;return {width:document.querySelector('.widget').offsetWidth,images:[...document.images].every(i=>i.complete&&i.naturalWidth>0),fonts:document.fonts.check('36px Comfortaa')}})()");
    assert.equal(geometry.width, 700); assert.ok(geometry.images); assert.ok(geometry.fonts);
    const protectedValue = safeStorage.encryptString('calendar-u-smoke'); assert.equal(safeStorage.decryptString(protectedValue), 'calendar-u-smoke');
    console.log('Packaged smoke passed: calendar, widgets, fonts, assets, Windows password encryption.'); app.exit(0);
  } catch (e) { console.error(e); app.exit(1); }
}
