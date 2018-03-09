# electron-print-server
A simple HTTP printing server.
Accepts commands via HTTP and prints documents that are loaded from provided URLs.

Main purpose is to allow faster (compared to Google Cloud Print, for example)
and simple (using just HTTP-requests) printing from any device in local network

> Build on [Electron](https://electronjs.org/) using [`electron-webpack`](https://github.com/electron-userland/electron-webpack).
Uses Electron native [printing feature](https://electronjs.org/docs/api/web-contents#contentsprintoptions-callback)

### Usage

After launch the application will listen for HTTP-requests on 3000 port

`GET /printers` - get list of available printers.
Returns JSON array of [`PrinterInfo`](https://electronjs.org/docs/api/structures/printer-info) objects

`GET /print?url=<url>&printer=<printer>` - print URL on specified printer.
Printer is identified by `name` field (see [`PrinterInfo`](https://electronjs.org/docs/api/structures/printer-info))

### Development

Setting up:

```bash
# clone repository
git clone https://github.com/downace/electron-print-server.git
cd electron-print-server

# install dependencies
yarn
```

Developing:

```bash
# run application in development mode
yarn dev

# compile source code and create webpack output
yarn compile

# `yarn compile` & create build with electron-builder
yarn dist

# `yarn compile` & create unpacked build with electron-builder
yarn dist:dir
```

### Road map

Important:

- [ ] Test with real printer (currently tested only on PDF output)
- [ ] Test different paper sizes (e.g. with label printer)
- [ ] Server control (currently application is still running after closing window)
- [ ] Settings GUI (settings may appear after testing)

Other:

- [ ] Better server API (maybe JSON)
- [ ] Error handling (including 4xx)
- [ ] Tray icon (with server/printing status), window minimization
- [ ] GUI for testing (better than current)

Needs discussion:

- [ ] Authentication
- [ ] Using another HTTP-method for `/print` (POST? PUT?)

Not important:

- [ ] Web GUI (control server from any device in local network, not only local)
- [ ] Refactoring and tests (not needed while app is dead simple and manual testing is easier)
- [ ] Branding (application/package name, icons, etc.)
- [ ] Normal versioning (instead of 0.0.0)
- [ ] [Automatic updates](https://electronjs.org/docs/tutorial/updates)
- [ ] Maybe better README
