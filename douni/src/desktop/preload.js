const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('shakeAPI', {
  getSensorData: () => ipcRenderer.invoke('get-sensor-data'),
});
