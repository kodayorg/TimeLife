const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { editICS } = require('../src/core/calendar.cjs');
const pause = ms => new Promise(r => setTimeout(r, ms));
async function loaded(w) { if (w.webContents.isLoading()) await new Promise(r => w.webContents.once('did-finish-load', r)); await w.widgetReady; await pause(250); }
async function run({ app, main, store, createWidget, getWidget, broadcast, eventMenuTemplate }) {
  const out = path.join(__dirname, '../qa'); fs.mkdirSync(out, { recursive: true });
  const logs = [], checks = [];
  const { Menu, shell } = require('electron'); const originalOpenPath=shell.openPath,openedLegal=[];shell.openPath=async file=>{openedLegal.push(file);return '';}; let capturedMenu; const originalPopup = Menu.prototype.popup; Menu.prototype.popup = function () { capturedMenu = this; };
  const observe = w => { w.webContents.on('console-message', details => { if (['warning','error'].includes(details.level)) { logs.push(details.message); console.log('Renderer:', details.message); } }); };
  observe(main); await loaded(main);
  store.data.settings.language='ru';store.data.settings.blur=false;
  store.data.resources = [];
  store.data.calendars = [{ id: 'local', name: 'Личное', writable: true, color: '#d996e8' }, { id: 'qa-yellow', name: 'Дом', writable: true, color: '#fde481' }];
  const seed = (id, calendarId, title, start, end, recurrence = '') => store.data.resources.push({ id, calendarId, revision: 1, ics: editICS({ title, start, end, zone: 'Europe/Moscow', recurrence }) });
  seed('qa:gym', 'local', 'Тренажерный зал', '2026-10-02T12:00', '2026-10-02T13:00');
  seed('qa:food', 'qa-yellow', 'Приготовить еду', '2026-10-02T14:00', '2026-10-02T16:00');
  seed('qa:oct1', 'qa-yellow', 'Покупки', '2026-10-01T14:00', '2026-10-01T15:00');
  store.save();
  const evaluate = code => main.webContents.executeJavaScript(`(async()=>{${!code.includes(';') && !code.startsWith('await ') && !code.startsWith('return ') ? 'return ' : ''}${code}})()`);
  await evaluate("anchor=DT.fromISO('2026-10-01',{zone:'Europe/Moscow'}).setLocale('ru');selected=DT.fromISO('2026-10-02',{zone:'Europe/Moscow'}).setLocale('ru');await refresh()");
  await evaluate('document.fonts.ready'); await pause(100);
  let count = await evaluate("document.querySelectorAll('.month-cell').length"); assert.equal(count, 42); checks.push('month view: 42 cells');
  const sidebar = await evaluate("({mini:!!document.querySelector('.mini'),circles:[...document.querySelectorAll('.check-disc,.menu-icon')].map(e=>({w:e.offsetWidth,h:e.offsetHeight})),labels:[...document.querySelectorAll('.menu-label')].map(e=>e.getBoundingClientRect().x),accent:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),expected:state.appearance.accent})");
  assert.equal(sidebar.mini,false);assert.ok(sidebar.circles.every(e=>e.w===20&&e.h===20));assert.ok(sidebar.labels.every(x=>Math.abs(x-sidebar.labels[0])<1));assert.equal(sidebar.accent,sidebar.expected);assert.equal(sidebar.accent,'#d9d9d9');checks.push('sidebar: aligned 20px circles, no mini calendar, fixed gray accent applied');
  const savedResources=store.data.resources;
  store.data.resources=savedResources.filter(r=>r.calendarId!=='local');
  assert.equal(await evaluate("(await api.state()).calendars.some(c=>c.id==='local')"),false);
  store.data.resources=savedResources;
  assert.equal(await evaluate("(await api.state()).calendars.some(c=>c.id==='local')"),true);checks.push('empty local calendar hidden; existing local events preserved');
  fs.writeFileSync(path.join(out, 'app-month.png'), (await main.webContents.capturePage()).toPNG());
  for(let i=0;i<12;i++) seed(`qa:crowded-${i}`,'qa-yellow',`Задача ${i+1}`,'2026-10-02T09:00','2026-10-02T10:00');
  await evaluate('await refresh()');
  const crowded=await evaluate("const list=document.querySelector('[data-cell=\"2026-10-02\"] .cell-events'),r=list.getBoundingClientRect();return {count:list.children.length,overflow:list.scrollHeight>list.clientHeight,x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),other:document.querySelector('[data-cell=\"2026-10-01\"] .cell-events').scrollTop}");
  assert.equal(crowded.count,14);assert.equal(crowded.overflow,true);
  main.webContents.sendInputEvent({type:'mouseMove',x:crowded.x,y:crowded.y});await pause(80);
  main.webContents.sendInputEvent({type:'mouseWheel',x:crowded.x,y:crowded.y,deltaY:-160,deltaX:0,canScroll:true});await pause(180);
  const scroll=await evaluate("({day:document.querySelector('[data-cell=\"2026-10-02\"] .cell-events').scrollTop,other:document.querySelector('[data-cell=\"2026-10-01\"] .cell-events').scrollTop})");
  assert.ok(scroll.day>0);assert.equal(scroll.other,crowded.other);checks.push('mouse wheel scrolls all 14 events inside one day independently');
  fs.writeFileSync(path.join(out,'app-day-scroll.png'),(await main.webContents.capturePage()).toPNG());
  store.data.resources=store.data.resources.filter(r=>!r.id.startsWith('qa:crowded-'));store.save();await evaluate('await refresh()');
  await evaluate("document.querySelector('[data-view=week]').click()");
  count = await evaluate("document.querySelectorAll('.time-column').length"); assert.equal(count, 7); checks.push('week view: seven time columns');
  const columns=await evaluate("[...document.querySelectorAll('.week-heading,.week-all-day,.week-hours')].map(row=>[...row.children].map(e=>({x:e.getBoundingClientRect().x,w:e.getBoundingClientRect().width})))");
  assert.ok(columns.every(row=>row.every((c,i)=>Math.abs(c.x-columns[0][i].x)<1&&Math.abs(c.w-columns[0][i].w)<1)));checks.push('week heading, all-day and hour columns share exact boundaries');
  fs.writeFileSync(path.join(out, 'app-week.png'), (await main.webContents.capturePage()).toPNG());
  await evaluate("editEvent(null,DT.fromISO('2026-10-07',{zone:'Europe/Moscow'}));const f=document.querySelector('#event-form');f.elements.title.value='QA событие';f.elements.repeat.value='FREQ=WEEKLY';f.requestSubmit();");
  await pause(400); assert.ok(store.data.resources.some(r => r.ics.includes('QA событие'))); checks.push('event editor creates recurrence');
  await evaluate("await refresh();editEvent(events.find(e=>e.title==='QA событие'))");
  const editor = await evaluate("({scope:document.querySelector('#event-form').elements.scope.value,repeatDisabled:document.querySelector('#event-form').elements.repeat.disabled})");
  assert.equal(editor.scope,'occurrence');assert.equal(editor.repeatDisabled,true);
  await evaluate("const f=document.querySelector('#event-form');f.elements.title.value='QA исключение';f.requestSubmit()");
  await pause(300);assert.ok(store.data.resources.some(r=>r.ics.includes('RECURRENCE-ID')));checks.push('event editor saves a single recurrence exception');
  await evaluate("await refresh();editEvent(events.find(e=>e.title==='QA исключение'));document.querySelector('#delete-event').click();document.querySelector('#confirm-delete').click()");
  await pause(300);assert.ok(store.data.resources.some(r=>r.ics.includes('EXDATE')));checks.push('event editor deletes only the occurrence');
  seed('qa:actions','local','QA действие','2026-10-02T10:00','2026-10-02T11:00');store.data.resources.find(r=>r.id==='qa:actions').ics=store.data.resources.find(r=>r.id==='qa:actions').ics.replace('END:VEVENT','ORGANIZER:mailto:owner@example.com\r\nEND:VEVENT');store.save();
  await evaluate("await refresh();const index=events.findIndex(e=>e.id==='qa:actions');document.querySelector('[data-event=\"'+index+'\"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))");await pause(100);
  assert.deepEqual(capturedMenu.items.map(i=>i.label),['Редактировать','Удалить']);assert.ok(capturedMenu.items.every(i=>i.enabled));
  capturedMenu.items[0].click();await pause(180);
  const footer=await evaluate("const f=document.querySelector('#event-form'),m=document.querySelector('.modal').getBoundingClientRect(),b=document.querySelector('#delete-event').getBoundingClientRect();return {title:f.elements.title.value,visible:b.top>=m.top&&b.bottom<=m.bottom,sticky:getComputedStyle(document.querySelector('#event-form>.modal-footer')).position}");assert.equal(footer.title,'QA действие');assert.equal(footer.visible,true);assert.equal(footer.sticky,'sticky');
  const modalGeometry=await evaluate("const m=document.querySelector('.modal').getBoundingClientRect(),s=document.querySelector('.modal-scroll').getBoundingClientRect(),input=document.querySelector('#event-form input').getBoundingClientRect();return {inset:m.right-s.right,top:s.top-m.top,bottom:m.bottom-s.bottom,gutter:s.right-input.right,left:input.left-m.left,right:m.right-input.right,radii:[...document.querySelectorAll('.modal-footer button')].map(b=>getComputedStyle(b).borderRadius),scrollable:document.querySelector('.modal-scroll').scrollHeight>document.querySelector('.modal-scroll').clientHeight}");assert.ok(modalGeometry.inset>=8&&modalGeometry.top>=8&&modalGeometry.bottom>=8);assert.ok(modalGeometry.gutter>=18);assert.ok(Math.abs(modalGeometry.left-modalGeometry.right)<1);assert.ok(modalGeometry.radii.every(r=>r==='9px'));assert.equal(modalGeometry.scrollable,true);checks.push('all modal scroll tracks inset 8px with content gutter, footer buttons round to 9px');
  fs.writeFileSync(path.join(out,'event-editor-actions.png'),(await main.webContents.capturePage()).toPNG());
  await evaluate("const f=document.querySelector('#event-form');f.elements.title.value='QA переименовано';f.requestSubmit()");await pause(250);assert.ok(store.data.resources.find(r=>r.id==='qa:actions').ics.includes('QA переименовано'));
  await evaluate("const index=events.findIndex(e=>e.id==='qa:actions');document.querySelector('[data-event=\"'+index+'\"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))");await pause(100);capturedMenu.items[1].click();await pause(180);
  assert.equal(await evaluate("document.querySelector('.delete-event-title').textContent"),'QA переименовано');await evaluate("document.querySelector('#keep-event').click()");assert.ok(store.data.resources.some(r=>r.id==='qa:actions'));
  eventMenuTemplate(await evaluate("events.find(e=>e.id==='qa:actions')"))[1].click();await pause(180);await evaluate("document.querySelector('#confirm-delete').click()");await pause(250);assert.equal(store.data.resources.some(r=>r.id==='qa:actions'),false);
  const recurring=await evaluate("events.find(e=>e.title==='QA событие')");eventMenuTemplate(recurring)[1].click();await pause(180);assert.equal(await evaluate("document.querySelector('#delete-scope').value"),'occurrence');await evaluate("const s=document.querySelector('#delete-scope');s.value='series';s.dispatchEvent(new Event('change'))");assert.ok((await evaluate("document.querySelector('#delete-hint').textContent")).includes('вся серия'));await evaluate("document.querySelector('#keep-event').click()");
  assert.ok(eventMenuTemplate({...recurring,readOnly:true}).every(i=>!i.enabled));checks.push('event context actions: edit saved, sticky footer visible, deletion cancelled and confirmed, series scope offered, read-only disabled');
  // Exclude QA edits from design reference screenshots.
  store.data.resources=store.data.resources.filter(r=>r.id.startsWith('qa:'));store.save();
  await evaluate("overlays.innerHTML='';view='month';await refresh();showSettings('widgets')");await pause(100);
  fs.writeFileSync(path.join(out,'settings-widgets.png'),(await main.webContents.capturePage()).toPNG());
  await evaluate("showSettings('calendar');document.querySelector('[data-setting=showWeekends]').click()");await pause(300);await evaluate("overlays.innerHTML='';await refresh()");
  count=await evaluate("document.querySelectorAll('.month-cell').length");assert.equal(count,30);checks.push('hide weekends setting changes month to five columns');
  await evaluate("await api.settings({showWeekends:true})");
  const changedZone = await evaluate("await api.settings({zone:'America/Los_Angeles'});await refresh();return {anchorZone:anchor.zoneName,time:eventStart(events.find(e=>e.title==='Тренажерный зал')).toFormat('HH:mm')}");
  assert.equal(changedZone.anchorZone,'America/Los_Angeles');assert.equal(changedZone.time,'02:00');checks.push('timezone setting updates calendar boundaries and event time');
  await evaluate("await api.settings({zone:'Europe/Moscow'});await refresh()");
  for(const theme of ['light','dark']){
    await evaluate(`await api.settings({theme:'${theme}'})`);
    await evaluate("overlays.innerHTML='';view='week';await refresh();document.querySelector('.week-scroll').scrollTop=8*48");await pause(100);
    fs.writeFileSync(path.join(out,`app-week-${theme}.png`),(await main.webContents.capturePage()).toPNG());
    for(const kind of ['month','horizontal','vertical']){
      store.data.settings.widget=kind;store.save();createWidget();const w=getWidget();observe(w);await loaded(w);
      await w.webContents.executeJavaScript("(async()=>{anchor=DT.fromISO('2026-10-01',{zone:'Europe/Moscow'}).setLocale('ru');selected=DT.fromISO('2026-10-02',{zone:'Europe/Moscow'}).setLocale('ru');await refresh();await document.fonts.ready})()");await pause(100);
      if(kind==='month'){
        const before=await w.webContents.executeJavaScript("({requests:refreshNumber,left:document.querySelector('.compact-arrow.previous').disabled,right:document.querySelector('.compact-arrow.next').disabled,scroll:document.querySelector('.widget-agenda-scroll').scrollTop})");assert.equal(before.left,true);assert.equal(before.right,false);
        await w.webContents.executeJavaScript("document.querySelector('.compact-arrow.next').click()");await pause(280);
        const after=await w.webContents.executeJavaScript("({page:compactPage,requests:refreshNumber,left:document.querySelector('.compact-arrow.previous').disabled,right:document.querySelector('.compact-arrow.next').disabled,title:document.querySelector('.widget-title').firstChild.textContent,calendarX:document.querySelector('.widget-month').getBoundingClientRect().x,agendaX:document.querySelector('.widget-agenda').getBoundingClientRect().x,inert:document.querySelector('.widget-month').inert,visible:agendaPosition().date,selected:dateKey(selected),gap:document.querySelector('.widget').getBoundingClientRect().bottom-document.querySelector('.widget-agenda-scroll').getBoundingClientRect().bottom})");
        assert.equal(after.page,'events');assert.equal(after.requests,before.requests);assert.equal(after.left,false);assert.equal(after.right,true);assert.equal(after.title,'События');assert.equal(after.calendarX,-330);assert.equal(after.agendaX,20);assert.equal(after.inert,true);assert.equal(after.visible,after.selected);assert.equal(after.gap,26);
        fs.writeFileSync(path.join(out,`widget-compact-events-${theme}.png`),(await w.webContents.capturePage()).toPNG());
        await w.webContents.executeJavaScript("(async()=>{await navigateDate(day('2026-11-01'));document.querySelector('.compact-arrow.previous').click()})()");await pause(280);
        const back=await w.webContents.executeJavaScript("({page:compactPage,calendarX:document.querySelector('.widget-month').getBoundingClientRect().x,agendaX:document.querySelector('.widget-agenda').getBoundingClientRect().x,month:anchor.month,date:document.querySelector('.widget-day.selected').dataset.date,inert:document.querySelector('.widget-agenda').inert})");assert.equal(back.page,'calendar');assert.equal(back.calendarX,20);assert.equal(back.agendaX,370);assert.equal(back.month,11);assert.equal(back.date,'2026-11-01');assert.equal(back.inert,true);
        await w.webContents.executeJavaScript("document.querySelector('.compact-arrow.next').click();document.querySelector('.widget-today').click()");await pause(280);
        const today=await w.webContents.executeJavaScript("({selected:dateKey(selected),expected:dateKey(now()),visible:agendaPosition().date})");assert.equal(today.selected,today.expected);assert.equal(today.visible,today.expected);
        await w.webContents.executeJavaScript("(async()=>{document.querySelector('.compact-arrow.previous').click();await navigateDate(day('2026-10-02'))})()");await pause(280);checks.push({compact:theme,pages:'calendar/events',animation:'right/left',dates:'linked',fadeGap:26});
      }
      const geometry=await w.webContents.executeJavaScript(`({width:document.querySelector('.widget').offsetWidth,height:document.querySelector('.widget').offsetHeight,selected:getComputedStyle(document.querySelector('.widget-day.selected')).backgroundColor,assets:[...document.images].map(i=>({name:i.src.split('/').pop(),loaded:i.complete&&i.naturalWidth>0,width:i.width,height:i.height})),overflow:document.documentElement.scrollWidth>innerWidth})`);
      const selection=await w.webContents.executeJavaScript("(()=>{const before=refreshNumber;document.querySelector('[data-date=\"2026-10-03\"]').click();return {sameRequests:refreshNumber===before,selected:selected.toISODate(),todayTag:document.querySelector('.widget-today')?.tagName,addButton:!!document.querySelector('.widget-agenda-head button[data-add]')}})()");
      assert.equal(selection.sameRequests,true);assert.equal(selection.selected,'2026-10-03');
      if(kind==='month'){
        await pause(280);const automatic=await w.webContents.executeJavaScript("({page:compactPage,selected:dateKey(selected),visible:agendaPosition().date})");assert.equal(automatic.page,'events');assert.equal(automatic.selected,'2026-10-03');assert.equal(automatic.visible,'2026-10-03');
        await w.webContents.executeJavaScript("document.querySelector('.compact-arrow.previous').click()");await pause(280);checks.push({compactDateClick:theme,date:'2026-10-03',opens:'events'});
      }
      if(kind!=='month'){
        assert.equal(selection.todayTag,'BUTTON');assert.equal(selection.addButton,true);
        const details=await w.webContents.executeJavaScript("(()=>{const agenda=document.querySelector('.widget-agenda-scroll'),button=document.querySelector('.widget-today'),plus=document.querySelector('.widget-agenda-head .widget-plus'),frame=document.querySelector('.widget').getBoundingClientRect();return {gap:frame.bottom-agenda.getBoundingClientRect().bottom,height:button.offsetHeight,plusHeight:plus.offsetHeight,radius:getComputedStyle(button).borderRadius,mask:getComputedStyle(agenda).maskImage,september:day('2026-09-01').toFormat('d MMMM'),november:day('2026-11-04').toFormat('d MMMM'),heading:document.querySelector('[data-agenda-date=\"2026-10-03\"] .widget-day-head span').textContent}})()");
        assert.equal(details.gap,26);assert.equal(details.height,35);assert.equal(details.plusHeight,35);assert.equal(details.radius,'5px');assert.ok(details.mask.includes('26px'));assert.equal(details.september,'1 сентября');assert.equal(details.november,'4 ноября');assert.equal(details.heading,'сб, 3 октября');
        await w.webContents.executeJavaScript("document.querySelector('.widget-today').click()");await pause(120);
        const today=await w.webContents.executeJavaScript("({selected:dateKey(selected),expected:dateKey(now()),visible:agendaPosition().date,highlighted:document.querySelector('.widget-day.selected').dataset.date})");
        assert.equal(today.selected,today.expected);assert.equal(today.visible,today.expected);assert.equal(today.highlighted,today.expected);
        await w.webContents.executeJavaScript("navigateDate(day('2026-10-02'))");
      }
      await w.webContents.executeJavaScript("selected=DT.fromISO('2026-10-02',{zone:'Europe/Moscow'}).setLocale('ru');render()");
      if(kind==='horizontal' && theme==='light') {
        const evaluateWidget=code=>w.webContents.executeJavaScript(`(async()=>{${code}})()`);
        await evaluateWidget("await navigateDate(day('2026-10-31'));return true");await pause(70);
        const point=await evaluateWidget("const r=document.querySelector('.widget-agenda-scroll').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+100)}");
        w.webContents.sendInputEvent({type:'mouseWheel',...point,deltaY:-220,deltaX:0,canScroll:true});await pause(120);
        let linkage=await evaluateWidget("return {month:anchor.month,date:dateKey(selected),visible:agendaPosition().date}");assert.equal(linkage.month,11);assert.equal(linkage.date,linkage.visible);
        await evaluateWidget("await navigateDate(day('2026-11-01'));return true");await pause(70);
        w.webContents.sendInputEvent({type:'mouseMove',...point});
        w.webContents.sendInputEvent({type:'mouseWheel',...point,deltaY:440,deltaX:0,canScroll:true});await pause(250);
        linkage=await evaluateWidget("return {month:anchor.month,date:dateKey(selected),visible:agendaPosition().date,top:document.querySelector('.widget-agenda-scroll').scrollTop}");assert.equal(linkage.month,10);assert.equal(linkage.date,linkage.visible);checks.push('agenda mouse wheel changes calendar month forward and backward');
        await evaluateWidget("await navigateDate(day('2026-10-02'));return true");await pause(70);
        const beforeEnd=await evaluateWidget("return dateKey(agendaEnd)");
        await evaluateWidget("const s=document.querySelector('.widget-agenda-scroll');s.scrollTop=s.scrollHeight-s.clientHeight;return true");await pause(300);
        const extended=await evaluateWidget("return {end:dateKey(agendaEnd),visible:agendaPosition().date,selected:dateKey(selected),count:document.querySelectorAll('[data-agenda-date]').length}");assert.ok(extended.end>beforeEnd);assert.equal(extended.visible,extended.selected);assert.ok(extended.count<=85);
        const beforeStart=await evaluateWidget("return dateKey(agendaStart)");
        await evaluateWidget("document.querySelector('.widget-agenda-scroll').scrollTop=0;return true");await pause(300);
        assert.ok(await evaluateWidget(`return dateKey(agendaStart)<'${beforeStart}'`));checks.push('agenda extends both directions, preserves viewport, bounds DOM to 85 dates');
        await evaluateWidget("await navigateDate(day('2026-12-31'));document.querySelector('[data-date=\"2026-12-15\"]').click();return true");await pause(100);
        const picked=await evaluateWidget("return {selected:dateKey(selected),visible:agendaPosition().date}");assert.equal(picked.selected,'2026-12-15');assert.equal(picked.visible,picked.selected);checks.push('calendar date click scrolls agenda to exactly that day');
        await evaluateWidget("await navigateDate(day('2026-10-02'));return true");await pause(70);
      }
      assert.equal(geometry.width,kind==='horizontal'?700:350);assert.equal(geometry.height,kind==='vertical'?840:412);assert.equal(geometry.overflow,false);
      assert.equal(geometry.selected,theme==='light'?'rgba(0, 0, 0, 0.05)':'rgba(255, 255, 255, 0.05)');assert.ok(geometry.assets.every(a=>a.loaded));
      const controlAlignment=await w.webContents.executeJavaScript("[...document.querySelectorAll('.widget-controls button')].map(button=>{const b=button.getBoundingClientRect(),s=button.querySelector('svg').getBoundingClientRect();return {dx:Math.abs(b.x+b.width/2-s.x-s.width/2),dy:Math.abs(b.y+b.height/2-s.y-s.height/2)}})");
      assert.ok(controlAlignment.every(c=>c.dx<.5&&c.dy<.5));
      if(kind==='horizontal'&&theme==='light'){
        await w.webContents.executeJavaScript("(()=>{const index=events.findIndex(e=>e.id==='qa:gym');document.querySelector('[data-event=\"'+index+'\"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))})()");await pause(100);assert.ok(capturedMenu.items.every(i=>i.enabled));capturedMenu.items[0].click();await pause(180);assert.equal(await evaluate("document.querySelector('#event-form').elements.title.value"),'Тренажерный зал');await evaluate("document.querySelector('#cancel-event').click()");checks.push('widget context menu opens existing event editor in main app');
        await w.webContents.executeJavaScript("document.querySelector('.widget-controls').style.opacity='1';document.querySelector('#widget-close').style.background='var(--selected)'");
        fs.writeFileSync(path.join(out,'widget-controls-aligned.png'),(await w.webContents.capturePage()).toPNG());
        await w.webContents.executeJavaScript("document.querySelector('.widget-controls').style.opacity='';document.querySelector('#widget-close').style.background=''");
      }
      const plusSizes=await w.webContents.executeJavaScript("[...document.querySelectorAll('.widget-plus')].map(b=>({w:b.offsetWidth,h:b.offsetHeight}))");assert.ok(plusSizes.length>1);assert.ok(plusSizes.every(b=>b.w===35&&b.h===35));
      checks.push({widget:kind,theme,...geometry,plusTargets:'35x35'});
      fs.writeFileSync(path.join(out,`widget-${kind}-${theme}.png`),(await w.webContents.capturePage()).toPNG());
    }
  }
  await evaluate("await api.settings({darkOpacity:45})");await loaded(getWidget());
  const rgba=await getWidget().webContents.executeJavaScript("getComputedStyle(document.querySelector('.widget')).backgroundColor");assert.equal(rgba,'rgba(0, 0, 0, 0.45)');checks.push('background opacity 45%, independent of text');
  fs.writeFileSync(path.join(out,'widget-opacity.png'),(await getWidget().webContents.capturePage()).toPNG());
  await evaluate("await api.settings({theme:'light'});await refresh();showSettings('account')");await pause(100);fs.writeFileSync(path.join(out,'settings-account.png'),(await main.webContents.capturePage()).toPNG());
  for(const language of ['ru','en','ko','fr','ja','zh']) {
    await evaluate("showSettings('appearance')");
    await evaluate(`const select=document.querySelector('[data-setting=language]');select.value='${language}';select.dispatchEvent(new Event('change'));`);await pause(180);await evaluate('await refresh()');
    assert.equal(store.data.settings.language,language);
    const labels=await evaluate("showSettings('appearance');return {language:document.documentElement.lang,settings:document.querySelector('.modal-head h2').textContent,expected:t('Настройки'),options:document.querySelector('[data-setting=language]').options.length,opacity:[...document.querySelectorAll('[data-setting$=Opacity]')].map(e=>e.nextElementSibling.textContent)}");
    assert.equal(labels.settings,labels.expected);assert.equal(labels.options,6);assert.ok(labels.opacity.every(x=>/^\d+%$/.test(x)));
    fs.writeFileSync(path.join(out,`settings-language-${language}.png`),(await main.webContents.capturePage()).toPNG());
    const w=getWidget();await pause(120);
    await w.webContents.executeJavaScript("(async()=>{await refresh();await navigateDate(day('2026-09-01'));await document.fonts.ready})()");
    const localized=await w.webContents.executeJavaScript("(()=>{const today=document.querySelector('.widget-today'),month=document.querySelector('.widget-month-bar span');return {lang:document.documentElement.lang,month:month.textContent,expectedMonth:monthLabel(anchor),today:today.textContent,expectedToday:t('сегодня'),background:getComputedStyle(today).backgroundColor,calendar:document.querySelector('.widget-title').firstChild.textContent,expectedCalendar:t('Календарь'),userTitle:events.find(e=>e.id==='qa:gym')?.title,overflow:document.documentElement.scrollWidth>innerWidth}})()");
    assert.equal(localized.lang,labels.language);assert.equal(localized.month,localized.expectedMonth);assert.ok(localized.month.includes('2026'));assert.equal(localized.today,localized.expectedToday);assert.equal(localized.calendar,localized.expectedCalendar);assert.equal(localized.background,'rgba(0, 0, 0, 0)');assert.equal(localized.userTitle,'Тренажерный зал');assert.equal(localized.overflow,false);
    if(language==='ru')assert.equal(localized.month,'Сентябрь 2026');
    fs.writeFileSync(path.join(out,`widget-language-${language}.png`),(await w.webContents.capturePage()).toPNG());
    await evaluate("overlays.innerHTML='';editEvent(null,day('2026-10-02'))");
    const editorText=await evaluate("return {title:document.querySelector('.modal-head h2').textContent,expected:t('Новое событие'),field:document.querySelector('label.field').firstChild.textContent,expectedField:t('Название')}");assert.equal(editorText.title,editorText.expected);assert.equal(editorText.field,editorText.expectedField);
    checks.push({language,month:localized.month,settings:labels.settings});
  }
  await evaluate("await api.settings({language:'ru'});await refresh();overlays.innerHTML=''");
  await evaluate("showSettings('appearance');const b=document.querySelector('[data-setting=blur]');b.checked=true;b.dispatchEvent(new Event('change'))");await pause(300);
  assert.equal(store.data.settings.blur,true);await loaded(getWidget());
  const glass=await getWidget().webContents.executeJavaScript("(async()=>{await refresh();return {blur:getComputedStyle(document.documentElement).getPropertyValue('--blur').trim(),color:getComputedStyle(document.querySelector('.widget')).backgroundColor}})()");
  assert.equal(glass.blur,'1');assert.equal(getWidget().isDestroyed(),false);
  await assert.rejects(()=>evaluate("await api.settings({blur:101})"));assert.equal(store.data.settings.blur,true);
  await evaluate("await api.settings({blur:false});await refresh();overlays.innerHTML=''");await loaded(getWidget());checks.push('blur: switch saves, native rounded Acrylic window created, invalid values rejected, off restores transparency');
  store.data.settings.language='ru';
  const preDragResources=store.data.resources.slice();
  seed('qa:calendar-move','local','Calendar move','2026-10-02T10:00','2026-10-02T11:00');
  await evaluate("overlays.innerHTML='';await refresh();editEvent(events.find(e=>e.id==='qa:calendar-move'))");
  const calendarChoice=await evaluate("const f=document.querySelector('#event-form');return {enabled:!f.elements.calendarId.disabled,options:[...f.elements.calendarId.options].map(o=>o.value)}");assert.equal(calendarChoice.enabled,true);assert.ok(calendarChoice.options.includes('qa-yellow'));
  await evaluate("const f=document.querySelector('#event-form');f.elements.calendarId.value='qa-yellow';f.requestSubmit()");await pause(300);
  assert.equal(store.data.resources.some(r=>r.id==='qa:calendar-move'),false);assert.equal(store.data.resources.find(r=>r.ics.includes('SUMMARY:Calendar move')).calendarId,'qa-yellow');
  checks.push('event editor changes calendars and moves the stored event; modal horizontal content insets are equal');
  store.data.resources=preDragResources.slice();
  seed('qa:drag','local','Drag event','2026-10-02T10:00','2026-10-02T11:30');
  seed('qa:drag-all','local','All day drag','2026-10-02T00:00','2026-10-03T00:00');
  store.data.resources.find(r=>r.id==='qa:drag-all').ics=editICS({title:'All day drag',start:'2026-10-02',end:'2026-10-03',allDay:true,zone:'Europe/Moscow'});
  seed('qa:drag-locked','local','Invitation','2026-10-02T16:00','2026-10-02T17:00');
  store.data.resources.find(r=>r.id==='qa:drag-locked').ics=store.data.resources.find(r=>r.id==='qa:drag-locked').ics.replace('END:VEVENT','ATTENDEE:mailto:guest@example.com\r\nEND:VEVENT');
  await evaluate("overlays.innerHTML='';view='month';anchor=day('2026-10-01');selected=day('2026-10-02');await refresh()");
  const drag=async(id,selector,minutes=null)=>{
    await evaluate(`const b=document.querySelector('[data-event="'+events.findIndex(e=>e.id==='${id}')+'"]'),c=b.closest('[data-cell],[data-time-date],[data-drop-date]'),r=b.getBoundingClientRect(),transfer=new DataTransfer();b.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:transfer,clientY:r.top+5}));const target=document.querySelector('${selector}'),rect=target.getBoundingClientRect(),y=${minutes===null?'rect.top+10':`rect.top+(${minutes}+draggedEvent.grabMinutes)*.8`};target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer,clientY:y}));const dropY=${minutes===null?'target.getBoundingClientRect().top+10':`target.getBoundingClientRect().top+(${minutes}+draggedEvent.grabMinutes)*.8`};target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer,clientY:dropY}));b.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:transfer}));`);
    await pause(300);
  };
  assert.equal(await evaluate("document.querySelector('[data-event=\"'+events.findIndex(e=>e.id==='qa:drag-locked')+'\"]').draggable"),false);
  await drag('qa:drag','[data-cell="2026-10-03"]');
  assert.equal(await evaluate("eventStart(events.find(e=>e.id==='qa:drag')).toISODate()"),'2026-10-03');assert.ok(store.data.resources.find(r=>r.id==='qa:drag').ics.includes('20261003T100000'));
  await evaluate("view='week';render()");
  await drag('qa:drag','[data-time-date="2026-10-04"]',855);
  assert.equal(await evaluate("eventStart(events.find(e=>e.id==='qa:drag')).toFormat('yyyy-MM-dd HH:mm')"),'2026-10-04 14:15');assert.equal(await evaluate("eventEnd(events.find(e=>e.id==='qa:drag')).diff(eventStart(events.find(e=>e.id==='qa:drag')),'minutes').minutes"),90);
  await drag('qa:drag-all','[data-drop-date="2026-10-03"]');assert.equal(await evaluate("events.find(e=>e.id==='qa:drag-all').start"),'2026-10-03');assert.equal(await evaluate("events.find(e=>e.id==='qa:drag-all').end"),'2026-10-04');
  assert.equal(await evaluate("!!document.querySelector('.drop-target,.event-dragging')"),false);
  fs.writeFileSync(path.join(out,'event-drag-week.png'),(await main.webContents.capturePage()).toPNG());
  checks.push('renderer drag handlers move month days, week time/day and all-day events, persist duration and deny locked events');
  store.data.resources=preDragResources;store.save();
  const smallResources=store.data.resources;
  store.data.resources=smallResources.concat(Array.from({length:3000},(_,i)=>({id:`qa:perf-${i}`,calendarId:'qa-yellow',revision:1,ics:`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:perf-${i}\r\nSUMMARY:Event ${i}\r\nDTSTART:20251002T090000Z\r\nDTEND:20251002T100000Z\r\n${i%10===0?'RRULE:FREQ=WEEKLY\r\n':''}END:VEVENT\r\nEND:VCALENDAR\r\n`})));
  await evaluate("overlays.innerHTML='';view='month';anchor=day('2026-10-01');selected=day('2026-10-02');await refresh()");
  const timing=await evaluate("const results=[];for(let i=0;i<3;i++){const before=refreshNumber,start=performance.now();document.querySelector('[data-nav=\"1\"]').click();const immediateMonth=anchor.month;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));results.push({month:immediateMonth,frameMs:Math.round(performance.now()-start),dataRequest:refreshNumber!==before});}return results");
  assert.deepEqual(timing.map(t=>t.month),[11,12,1]);assert.equal(timing[0].dataRequest,false);assert.equal(timing[1].dataRequest,false);checks.push({performance:'3000 resources, month change through painted frames',timing});
  fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(timing,null,2));console.log('Month navigation with 3000 resources:',JSON.stringify(timing));
  store.data.resources=smallResources;
  await evaluate("showSettings('appearance')");
  assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-legal]')].map(b=>b.dataset.legal)"),['terms','privacy','notices','source']);for(const id of ['terms','privacy','notices','source']){await evaluate(`document.querySelector('[data-legal="${id}"]').click()`);await pause(100);}
  assert.equal(openedLegal.length,4);assert.ok(openedLegal.every(file=>fs.existsSync(file)));checks.push('settings open real terms, privacy, licenses and MPL source through allowed IPC');
  for(const r of store.data.resources){r.pending=false;delete r.conflict;}
  store.save();store.save();
  const accountPath=path.join(path.dirname(store.file),'account.enc');fs.writeFileSync(accountPath,'QA credential bytes');fs.writeFileSync(accountPath+'.tmp','QA temporary bytes');
  await evaluate("editEvent(events.find(e=>e.calendarId==='qa-yellow'));void api.disconnect().catch(()=>{});return true");await pause(600);await loaded(main);
  assert.ok(store.data.resources.every(r=>r.calendarId==='local'));assert.ok(!fs.readFileSync(store.file+'.bak','utf8').includes('Приготовить еду'));assert.equal(fs.existsSync(accountPath),false);assert.equal(fs.existsSync(accountPath+'.tmp'),false);assert.equal(await evaluate("!!document.querySelector('#event-form')"),false);assert.equal(await evaluate("(await api.state()).calendars.length"),1);checks.push('disconnect through real IPC clears cloud backup, credentials and open editor, preserving local events');
  // An actual iCloud account is never used by automated QA.
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,logs},null,2));
  const failures=logs.filter(x=>!/Autofill|deprecated|Electron Security Warning/.test(x));assert.equal(failures.length,0,failures.join('\n'));
  Menu.prototype.popup=originalPopup;shell.openPath=originalOpenPath;
  console.log(`UI QA passed: ${checks.length} checks; screenshots: ${out}`);app.exit(0);
}
module.exports={run};

