const { app, BrowserWindow, dialog } = require('electron');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const log = require('electron-log');
const Store = require('electron-store');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

const store = new Store();
let mainWindow;

// GitHub repository details
const GITHUB_REPO = 'HysterChat/eval8';  // Updated repository URL
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    resizable: false,
    show: false,
    frame: false
  });

  await mainWindow.loadFile('index.html');
  mainWindow.show();
}

async function checkForUpdates() {
  try {
    log.info('Checking for updates...');
    const releaseResponse = await axios.get(GITHUB_API);
    const latestRelease = releaseResponse.data;
    
    // Find the Windows installer asset
    const installerAsset = latestRelease.assets.find(asset => 
      asset.name.endsWith('.exe') && asset.name.includes('setup')
    );

    if (!installerAsset) {
      throw new Error('No Windows installer found in latest release');
    }

    const currentVersion = store.get('installedVersion');
    if (currentVersion === latestRelease.tag_name) {
      log.info('Already on latest version');
      app.quit();
      return;
    }

    // Download directory in AppData
    const downloadDir = path.join(app.getPath('temp'), 'eval8-updates');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }

    const installerPath = path.join(downloadDir, installerAsset.name);
    
    // Download the installer
    log.info('Downloading installer...');
    const writer = fs.createWriteStream(installerPath);
    const downloadResponse = await axios({
      url: installerAsset.browser_download_url,
      method: 'GET',
      responseType: 'stream'
    });

    downloadResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    log.info('Download complete, running installer...');

    // Run the installer
    execFile(installerPath, [], (error) => {
      if (error) {
        log.error('Failed to run installer:', error);
        dialog.showErrorBox(
          'Installation Error',
          'Failed to run the installer. Please try again or download manually.'
        );
      }
      store.set('installedVersion', latestRelease.tag_name);
      app.quit();
    });

  } catch (error) {
    log.error('Update check failed:', error);
    dialog.showErrorBox(
      'Update Error',
      'Failed to check for updates. Please try again later.'
    );
    app.quit();
  }
}

app.whenReady().then(async () => {
  await createWindow();
  checkForUpdates();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} 