import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { format as formatUrl } from 'url';
import express from 'express';

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


const expressApp = express();
let webContents;

expressApp.get('/printers', (req, res) => {
    let result = [];
    if (webContents) {
        result = webContents.getPrinters();
    }
    res.json(result);
});

expressApp.get('/print', (req, res) => {
    printUrl(req.query.url, req.query.printer).then(() => {
        res.send('ok');
    }, () => {
        res.status(500).send('fail');
    });
});

expressApp.listen(3000, () => {
    console.log('listening');
});

ipcMain.on('get-printers', ({ sender }) => {
    webContents = sender;
    webContents.send('printers', webContents.getPrinters());
});

ipcMain.on('print', ({ sender }, { printer, url }) => {
    webContents = sender;
    printUrl(url, printer).then(() => {
        webContents.send('print-result', true);
    }, () => {
        webContents.send('print-result', false);
    });
});

ipcMain.on('start-server', () => {

});

function printUrl(url, printer) {
    if (!webContents) {
        return Promise.reject('No web contents');
    }
    const w = new BrowserWindow({
        show: false,
    });
    w.loadURL(url);

    return new Promise((resolve, reject) => {
        w.webContents.on('did-finish-load', () => {
            w.webContents.print({ silent: true, deviceName: printer }, (success) => {
                if (success) {
                    resolve();
                } else {
                    reject();
                }
            });
        });
    });
}
