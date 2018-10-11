import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { format as formatUrl } from 'url';
import express from 'express';
import os from 'os';
import debug from 'debug';
import bodyParser from 'body-parser';

const d = debug('electron-print-server');

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
    mainWindow = createMainWindow();
});

/**
 * @type {Express}
 */
const expressApp = express();
let appListener;
/**
 * @type Electron.WebContents
 */
let webContents;

expressApp.use(function(req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    next();
});
expressApp.use(bodyParser.urlencoded());

expressApp.get('/printers', (req, res) => {
    res.json(webContents ? webContents.getPrinters() : null);
});

expressApp.post('/print', (req, res) => {
    const jobs = req.body.jobs;
    d('Printing %d jobs', jobs.length);
    Promise.all(jobs.map(job => {
        return printUrl(job.url, job.printer).then(() => true, () => false);
    })).then(results => {
        res.json(results);
    });
});

ipcMain.on('get-printers', e => {
    webContents = e.sender;
    e.returnValue = webContents.getPrinters();
});

ipcMain.on('print', ({ sender }, { url, printer }) => {
    webContents = sender;
    printUrl(url, printer).then(() => {
        webContents.send('print-result', true);
    }, () => {
        webContents.send('print-result', false);
    });
});

ipcMain.on('get-network-interfaces', e => {
    webContents = e.sender;
    e.returnValue = os.networkInterfaces();
});

ipcMain.on('start-server', ({ sender }, { hostname, port }) => {
    d('Starting server...');
    webContents = sender;
    appListener = expressApp.listen(port, hostname, () => {
        d('Server started on %o', appListener.address());
        webContents.send('server-started', appListener.address());
    });
});

ipcMain.on('stop-server', ({ sender }) => {
    d('Stopping server...');
    webContents = sender;
    if (!appListener) {
        d('Server is not started');
        webContents.send('server-stopped');
        return;
    }
    appListener.close(() => {
        d('Server stopped');
        webContents.send('server-stopped');
        appListener = null;
    });
});

function printUrl(url, printer) {
    if (!webContents) {
        return Promise.reject('No web contents');
    }
    d('Printing URL %s on printer %s', url, printer);
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
                w.close();
            });
        });
    });
}
