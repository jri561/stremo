// @ts-check
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('stremoDesktop', {
  isElectron: true,
  platform: process.platform,
});
