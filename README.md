# electron-print-server

### ⚠️ Deprecated ⚠️

Project is archived and will not recieve any updates.  
Use one of the [forks](https://github.com/vast-ru/electron-print-server/forks?include=active%2Carchived%2Cinactive%2Cnetwork&page=1&period=&sort_by=stargazer_counts) (or make your own),
or consider migrating to [Go Print Server](https://github.com/downace/go-print-server)

----

A simple HTTP printing server.
Accepts commands via HTTP (or HTTPS) and prints documents that are loaded from provided URLs.

Main purpose is to allow faster (compared to Google Cloud Print, for example)
and simple printing from any device in local network

### Server API

- `GET /printers` - get list of available printers. Returns JSON array of
[`PrinterInfo`](https://electronjs.org/docs/api/structures/printer-info) objects

- `POST /print` - print specified URLS. Request body should have following format:

    ```json5
    {
      "jobs": [{
        "url": "https://example.test/some/document.html",
        "printer": "Some PDF Printer",
        "settings": {
          "duplex": "short", // "long" | "simplex" 
          "copies": 2,
          "orientation": "portrait" // "landscape"
        }
      }]
    }
    ```
    Printer is identified by `name` field
    (see [`PrinterInfo`](https://electronjs.org/docs/api/structures/printer-info)).
    Returns array of booleans indicating printing result (success or fail).

### Development

> [`electron-builder`](https://www.electron.build) is used, so refer to its docs for more details about building

Setting up:

```bash
# clone repository
git clone https://github.com/downace/electron-print-server.git
# or
git clone git@github.com:downace/electron-print-server.git

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

# build application for production
# (any electron-builder arguments can be passed, see electron-builder docs for details)
yarn dist

# create unpacked build with electron-builder
yarn dist:dir
```

It's recommended to use a [Docker image](https://www.electron.build/multi-platform-build#docker)
to build application for production. You can use `./bin/docker` to run docker container
and use `yarn dist` inside of it

> If you encounter this error when using `yarn` inside Docker container:
>
> ```
> error upath@1.0.4: The engine "node" is incompatible with this module. Expected version ">=4 <=9"
> ```
>
> run `yarn` with `--ignore-engines` key:
>
> ```
> yarn --ignore-engines add -D some-package
> ```

### Road map

Important:

- [x] Test with real printer (currently tested only on PDF output)
- [x] Test different paper sizes (e.g. with label printer)
- [x] Server control (currently application is still running after closing window)
- [x] Settings GUI (settings may appear after testing)
- [ ] Additional printing settings (e.g. Sumatra PDF `-print-settings`)

Other:

- [x] Better server API (maybe JSON)
- [ ] Error handling (including 4xx)
- [x] Tray icon (with server/printing status), window minimization
- [x] GUI for testing (better than current)

Needs discussion:

- [ ] Authentication
- [x] Using another HTTP-method for `/print` (POST? PUT?)
- [ ] More debugging options
- [ ] Disallow multiple running instances

Not important:

- [ ] Web GUI (control server from any device in local network, not only local)
- [ ] Refactoring and tests (not needed while app is dead simple and manual testing is easier)
- [ ] Branding (application/package name, icons, etc.)
- [x] Normal versioning (instead of 0.0.0)
- [ ] [Automatic updates](https://electronjs.org/docs/tutorial/updates)
- [ ] Maybe better README
