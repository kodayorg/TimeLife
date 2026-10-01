const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('calendarU', {
  state: () => ipcRenderer.invoke('state'),
  events: (from, to) => ipcRenderer.invoke('events', from, to),
  saveEvent: (event, scope) => ipcRenderer.invoke('save-event', event, scope),
  eventMenu: event => ipcRenderer.invoke('event-menu', event),
  deleteEvent: (event, scope) => ipcRenderer.invoke('delete-event', event, scope),
  settings: patch => ipcRenderer.invoke('settings', patch),
  connect: account => ipcRenderer.invoke('connect', account),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  sync: () => ipcRenderer.invoke('sync'),
  resolve: (id, choice) => ipcRenderer.invoke('resolve', id, choice),
  openApp: request => ipcRenderer.invoke('open-app', request),
  closeWidget: () => ipcRenderer.invoke('close-widget'),
  openLegal: name => ipcRenderer.invoke('open-legal', name),
  openApple: () => ipcRenderer.invoke('open-apple'),
  onChange: callback => { const fn = () => callback(); ipcRenderer.on('changed', fn); return () => ipcRenderer.removeListener('changed', fn); },
  onEdit: callback => { const fn = (_, request) => callback(request); ipcRenderer.on('edit-request', fn); return () => ipcRenderer.removeListener('edit-request', fn); }
});
