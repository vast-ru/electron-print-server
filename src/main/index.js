'use strict';

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { format as formatUrl } from 'url';

const isDevelopment = process.env.NODE_ENV !== 'production';

// global reference to mainWindow (necessary to prevent window from being
// garbage collected)
let mainWindow;

function createMainWindow() {
    const win = new BrowserWindow();

    if (isDevelopment) {
        win.webContents.openDevTools();
    }

    if (isDevelopment) {
        win.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`);
    }
    else {
        win.loadURL(formatUrl({
            pathname: path.join(__dirname, 'index.html'),
            protocol: 'file',
            slashes:  true,
        }));
    }

    win.on('closed', () => {
        mainWindow = null;
    });

    win.webContents.on('devtools-opened', () => {
        win.focus();
        setImmediate(() => {
            win.focus();
        });
    });

    return win;
}

// quit application when all windows are closed
app.on('window-all-closed', () => {
    // on macOS it is common for applications to stay open until the user
    // explicitly quits
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // on macOS it is common to re-create a window even after all windows have
    // been closed
    if (mainWindow === null) {
        mainWindow = createMainWindow();
    }
});

// create main BrowserWindow when electron is ready
app.on('ready', () => {
    mainWindow = createMainWindow()
});


ipcMain.on('get-printers', e => {
    e.sender.send('printers', e.sender.getPrinters());
});

ipcMain.on('print', (e, { printer, url }) => {
    const w = new BrowserWindow({
       show: false,
    });
    w.loadURL(url);
    w.webContents.on('did-finish-load', () => {
        w.webContents.print({ silent: true, deviceName: printer }, (success) => {
            e.sender.send('print-result', success);
        });
    });
});
