const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('calmo', { platform: process.platform, version: process.env.npm_package_version || '0.1.0' });
