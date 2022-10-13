// @flow
import * as remote from '@electron/remote/main';
import bodyParser from 'body-parser';
import axios from 'axios';
import contentType from 'content-type';
import childProcess from 'child_process';
import debug from 'debug';
import { app, BrowserWindow, ipcMain, Menu, Tray } from 'electron';
import settings from 'electron-settings';
import express from 'express';
import { promises as fsPromises } from 'fs';
import os from 'os';
import * as path from 'path';
import tmp from 'tmp';
import { format as formatUrl } from 'url';
import packageJson from '../../package.json';
import {jsPDF} from "jspdf";

remote.initialize();

const d = debug('electron-print-server');

const isDevelopment = process.env.NODE_ENV !== 'production';

// global reference to mainWindow (necessary to prevent window from being
// garbage collected)
let mainWindow, tray;

function createMainWindow() {
    const win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        show: false,
        title: 'Print server (version ' + packageJson.version + ')',
    });

    if (isDevelopment) {
        win.webContents.openDevTools();
    }

    remote.enable(win.webContents);

    if (isDevelopment) {
        win.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`);
    } else {
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

    win.once('ready-to-show', () => {
        win.show();
    });

    return win;
}

function createTray() {
    const t = new Tray(trayIconPath());

    const menu = Menu.buildFromTemplate([
        {
            type : "normal",
            label: 'Показать/Скрыть',
            click: toggleMainWindow,
        },
        {
            type: "separator",
        },
        {
            type : "normal",
            label: 'Выход',
            click: quit,
        },
    ]);

    t.on('click', toggleMainWindow);

    t.setToolTip('Сервер печати');
    t.setContextMenu(menu);

    return t;
}

function toggleMainWindow() {
    if (mainWindow) {
        // TODO: Hide instead?
        // TODO: Recreating is slow, but it's a rare case.
        mainWindow.close();
        mainWindow = null;
    } else {
        mainWindow = createMainWindow();
    }
}

// Override default behavior: we don't want to quit when window is closed.
app.on('window-all-closed', () => {});

app.on('activate', () => {
    // on macOS it is common to re-create a window even after all windows have
    // been closed
    if (mainWindow === null) {
        mainWindow = createMainWindow();
    }
});

// create main BrowserWindow when electron is ready
app.on('ready', () => {
    const shouldShowWindow = !process.argv.includes('--silent');

    if (shouldShowWindow) {
        mainWindow = createMainWindow();
    }

    tray = createTray();

    if (settings.getSync('server.autostart')) {
        const address = settings.getSync('server.ip');
        const port = settings.getSync('server.port');
        if (address && port) {
            startServer(address, port);
        }
    }
});

/**
 * @type {Express}
 */
const expressApp = express();
let appListener;
/**
 * @type {Set<Socket>}
 */
const sockets = new Set();
/**
 * @type Electron.WebContents
 */
let webContents;

expressApp.use(function(req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', [
        'Content-Type',
    ].join(','));
    next();
});
expressApp.use(bodyParser.urlencoded());
expressApp.use(bodyParser.json());

expressApp.get('/printers', (req, res) => {
    res.json(webContents ? webContents.getPrinters() : null);
});

type Job = {
    printer: string,
    url: string,
    settings: PrintSettings,
};

expressApp.post('/print', (req, res) => {
    const jobs: Job[] = req.body.jobs;
    d('Printing %d jobs', jobs.length);
    Promise.all(jobs.map(job => {
        return printUrl(job.url, job.printer, job.settings)
            .then(() => true, () => false);
    })).then(results => {
        res.json(results);
    });
});

ipcMain.on('get-printers', e => {
    webContents = e.sender;
    e.returnValue = webContents.getPrinters();
});

ipcMain.on('test-print', ({ sender }, { paperFormat, printer, settings }) => {
    webContents = sender;
    testPrint(paperFormat, printer).then(() => {
        webContents.send('test-print-result', { success: true });
    }, error => {
        webContents.send('test-print-result', { success: false, error });
    });
});

ipcMain.on('get-network-interfaces', e => {
    webContents = e.sender;
    e.returnValue = os.networkInterfaces();
});

ipcMain.on('start-server', ({ sender }, { hostname, port }) => {
    webContents = sender;
    startServer(hostname, port).then(() => {
        webContents.send('server-state', 'running');
    });
});

ipcMain.on('stop-server', ({ sender }) => {
    d('Stopping server...');
    webContents = sender;
    if (!appListener) {
        d('Server is not started');
        webContents.send('server-state', 'stopped');
        tray.setToolTip('Сервер печати - Остановлен');
        return;
    }
    sockets.forEach(socket => {
        socket.destroy();
    });
    appListener.close(() => {
        d('Server stopped');
        webContents.send('server-state', 'stopped');
        tray.setToolTip('Сервер печати - Остановлен');
        appListener = null;
    });
});

ipcMain.on('get-server-state', e => {
    webContents = e.sender;
    if (appListener) {
        webContents.send('server-state', 'running');
    } else {
        webContents.send('server-state', 'stopped');
    }
});

function startServer(hostname, port) {
    d('Starting server...');
    return new Promise(resolve => {
        appListener = expressApp.listen(port, hostname, listenHandler);

        appListener.on('connection', socket => {
            sockets.add(socket);
            d("New connection; total length = %d", sockets.size);
            socket.on('close', () => {
                sockets.delete(socket);
                d("Connection closed; total length = %d", sockets.size);
            })
        });

        function listenHandler() {
            const addr = appListener.address();
            d('Server started on %o', addr);
            tray.setToolTip(`Сервер печати - Запущен на ${addr.address}:${addr.port}`);
            resolve();
        }
    });
}

async function testPrint(paperFormat, printer) {
    const {format, orientation, fontSize} = {
        'A4': {format: [210, 297], orientation: 'portrait', fontSize: 42},
        '43*25 мм': {format: [43, 25], orientation: 'landscape', fontSize: 10},
        '40*30 мм': {format: [40, 30], orientation: 'landscape', fontSize: 8},
        '100*148 мм': {format: [148, 100], orientation: 'landscape', fontSize: 32},
    }[paperFormat];

    const doc = new jsPDF(orientation, 'mm', format);

    const fontFile = await fsPromises.readFile(extraResourcePath('fonts', 'DejaVuSans.ttf'));

    doc.addFileToVFS('DejaVuSans.ttf', fontFile.toString('binary'));
    doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
    doc.setFontSize(fontSize);
    doc.setFont('DejaVuSans');
    doc.text('Печать с помощью сервера печати', format[0] / 2, format[1] / 2, {
        align: 'center',
        maxWidth: format[0],
    });

    return printBuffer(Buffer.from(doc.output('arraybuffer')), printer, {
        orientation,
        format: paperFormat === 'A4' ? 'A4' : format,
    }).catch(e => {
        d('Print error: %s', e.message);
        throw e;
    });
}

function printUrl(url, printer, printSettings: PrintSettings) {
    d('Loading url %s', url);

    return axios.get(url, {
        responseType: 'arraybuffer'
    }).then(r => {
        const { type } = contentType.parse(r.headers['content-type']);

        if (type === 'application/pdf') {
            d('Content type is %s, printing directly', type);
            return Promise.resolve(r.data);
        }

        d('Content type is %s, converting to PDF', type);

        const w = new BrowserWindow({
            show: false,
        });

        return w.loadURL(url, {
            userAgent: 'ElectronPrintServer / ' + packageJson.version,
        }).then(() => {
            return w.webContents.printToPDF({});
        }).catch(e => {
            d('Convert to PDF error: %s', e.message);
            throw e;
        }).finally(() => {
            w.close();
        });
    }, e => {
        d('Error loading URL:', e.message);

        if (e.response) {
            d('Raw response:', (e.response.data).toString());
        }

        throw e;
    }).then(data => {
        return printBuffer(data, printer, printSettings).catch(e => {
            d('Print error: %s', e.message);
            throw e;
        });
    });
}

async function printBuffer(buffer, printer, printSettings: PrintSettings) {
    const fileName = tmp.fileSync({
        prefix: 'print_',
        postfix: '.pdf',
    }).name;

    try {
        await fsPromises.writeFile(fileName, buffer);
    } catch (e) {
        d('PDF write error: %s', e.message);
        throw e;
    }

    return new Promise((resolve, reject) => {
        let command;
        const printerEscaped  = printer.replace('"', '\\"');
        const fileNameEscaped = fileName.replace('"', '\\"');
        // Not supporting other platforms
        // noinspection SwitchStatementWithNoDefaultBranchJS
        switch (process.platform) {
            case 'linux':
                command = [
                    'lp',
                    printSettingsToLpFormat(printSettings),
                    `-d "${printerEscaped}"`,
                    fileNameEscaped
                ].join(' ');
                break;
            case 'win32':
                command = [
                    `"${extraResourcePath(
                        process.platform,
                        process.arch,
                        'SumatraPDF.exe'
                    )}"`,
                    `-print-to "${printerEscaped}"`,
                    `-print-settings "${printSettingsToSumatraFormat(printSettings)}"`,
                    '-silent',
                    `"${fileNameEscaped}"`,
                ].join(' ');
                break;
        }
        d(`Executing: ${command}`);
        childProcess.exec(command, {}, (err, stdout) => {
            if (err) {
                d('Shell exec error: %s', err.message);
                reject(err);
                return;
            }
            resolve(stdout);
        });
    });
}

type PrintSettings = {
    duplex?: 'simplex' | 'short' | 'long',
    copies?: number,
    orientation?: 'portrait' | 'landscape',
    format: 'A4' | [number, number],
};

function printSettingsToLpFormat(printSettings: PrintSettings) {
    if (!printSettings) {
        return '';
    }
    const parts = [];
    if (printSettings.duplex) {
        parts.push('-o sides=' + {
            simplex: 'one-sided',
            short  : 'two-sided-short-edge',
            long   : 'two-sided-long-edge',
        }[printSettings.duplex]);
    }

    if (printSettings.copies && printSettings.copies > 1) {
        parts.push('-n ' + printSettings.copies);
    }

    if (printSettings.orientation) {
        parts.push('-o orientation-requested=' + {
            portrait : 3,
            landscape: 4,
        }[printSettings.orientation]);
    }

    if (printSettings.format) {
        const media = printSettings.format === 'A4'
            ? 'A4'
            : `Custom.${printSettings.format[0]}x${printSettings.format[1]}mm`;
        parts.push('-o media=' + media);
    }

    return parts.join(' ');
}

function printSettingsToSumatraFormat(printSettings: PrintSettings) {
    if (!printSettings) {
        return '';
    }
    const parts = [];
    if (printSettings.duplex) {
        parts.push({
            simplex: 'simplex',
            short  : 'duplexshort',
            long   : 'duplexlong',
        }[printSettings.duplex]);
    }

    if (printSettings.copies && printSettings.copies > 1) {
        parts.push(printSettings.copies + 'x');
    }

    if (printSettings.orientation) {
        parts.push(printSettings.orientation);
    }

    return parts.join(',');
}

function extraResourcePath(...p) {
    if (isDevelopment) {
        return path.resolve(__dirname, '../../external', ...p);
    } else {
        return path.join(process.resourcesPath, 'external', ...p);
    }
}

function trayIconPath() {
    switch (process.platform) {
        case 'linux':
            return path.join(__static, '/icons/linux/tray-icon.png');
        case 'win32':
            return path.join(__static, '/icons/win32/tray-icon.ico');
        default:
            return null;
    }
}

function quit() {
    if (appListener) {
        sockets.forEach(socket => {
            socket.destroy();
        });
        appListener.close(() => {
            app.quit();
        });
    } else {
        app.quit();
    }

}
