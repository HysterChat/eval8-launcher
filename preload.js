const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld(
  'launcher', {
    getVersion: () => process.env.npm_package_version
  }
); 