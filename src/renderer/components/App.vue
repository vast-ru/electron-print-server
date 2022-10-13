<template>
    <div>
        <div>
            <h3>Статус: {{ serverStateText }}</h3>
            <button
                @click="startServer()"
                v-if="serverState === 'stopped'"
                :disabled="!serverIp"
            >Запуск</button>
            <button
                v-if="serverState === 'running'"
                @click="stopServer()"
            >Стоп</button>
            <div v-if="serverState === 'running'">
                <button @click="copyAddress()">Скопировать адрес</button>
            </div>
        </div>

        <div>
            <h3>Проверка печати</h3>
            <p>
                <label>
                    Принтер
                    <select v-model="printer">
                        <option v-for="p in availablePrinters" :value="p.name">{{ p.name }}</option>
                    </select>
                </label>
            </p>
            <p>
                <label>
                    Размер бумаги
                    <select v-model="paperFormat">
                        <option v-for="size in paperFormats" :value="size">{{ size }}</option>
                    </select>
                </label>
            </p>
            <button @click="print()" :disabled="!printer || !paperFormat">Напечатать</button>
            {{ printResult }}
        </div>

        <p>
            <button @click="extras = !extras">Расширенные настройки</button>
        </p>
        <div v-if="extras">
            <h3>Расширенные настройки</h3>
            <p>
                <label>
                    <input type="checkbox" v-model="serverAutostart"/>
                    Автозапуск сервера при старте приложения
                </label>
            </p>
            <div>
                <label>
                    Адрес
                    <select v-model="serverIp" :disabled="serverState === 'running'">
                        <option v-for="ip in availableIps" :value="ip">{{ ip }}</option>
                    </select>
                </label>
            </div>
            <div>
                <label>
                    Порт
                    <input type="text" v-model="serverPort" placeholder="3030"/>
                </label>
            </div>
        </div>
    </div>
</template>

<script>
    import { clipboard, ipcRenderer } from 'electron';
    import settings from 'electron-settings';
    import flatten from 'lodash/flatten';

    const getSetting = (path, def) => {
      return settings.hasSync(path) ? settings.getSync(path) : def;
    };

    export default {
        data() {
            return {
                availableIps   : [],
                serverIp       : getSetting('server.ip', 'localhost'),
                serverPort     : getSetting('server.port', 3030),
                serverState    : '',
                serverAutostart: getSetting('server.autostart', true),
                extras         : false,

                availablePrinters: [],
                paperFormats     : [
                    'A4',
                    '43*25 мм',
                    '40*30 мм',
                    '100*148 мм',
                ],
                paperFormat      : 'A4',
                printer          : null,
                printResult      : '',
            };
        },
        created() {
            this.initMainProcessListeners();
            this.updateNetworkInterfaces();
            this.updatePrinters();
            this.updateServerState();
        },
        destroyed() {
            this.stopServer();
        },
        computed: {
            serverStateText() {
                switch (this.serverState) {
                    case 'running':
                        return `Запущен на ${this.serverAddress}`;
                    case 'stopped':
                        return 'Остановлен';
                    default:
                        return 'Неизвестен';
                }
            },
            serverAddress() {
                return `${this.serverIp}:${this.serverPort}`;
            },
        },
        watch: {
            serverIp(ip) {
                settings.setSync('server.ip', ip);
            },
            serverPort(port) {
                settings.setSync('server.port', port);
            },
            serverAutostart(autostart) {
                settings.setSync('server.autostart', autostart);
            },
        },
        methods: {
            updatePrinters() {
                this.availablePrinters = ipcRenderer.sendSync('get-printers');
            },
            initMainProcessListeners() {
                ipcRenderer.on('server-state', (e, state) => {
                    this.serverState = state;
                });
            },
            updateNetworkInterfaces() {
                const interfaces = ipcRenderer.sendSync('get-network-interfaces');
                this.availableIps = flatten(Object.values(interfaces))
                    .filter(addr => addr.family === "IPv4")
                    .map(addr => addr.address)
                    .map(addr => addr === '127.0.0.1' ? 'localhost' : addr);
            },
            updateServerState() {
                ipcRenderer.send('get-server-state');
            },
            print() {
                  ipcRenderer.send('test-print', { printer: this.printer, paperFormat: this.paperFormat });
                  ipcRenderer.once('test-print-result', (e, { success, error }) => {
                      this.printResult = success ? 'ok' : 'fail: ' + JSON.stringify(error);
                  });
            },
            startServer() {
                ipcRenderer.send('start-server', {
                    port     : this.serverPort,
                    hostname : this.serverIp,
                });
            },
            stopServer() {
                ipcRenderer.send('stop-server');
            },
            copyAddress() {
                clipboard.writeText(this.serverAddress);
            },
        },
    };
</script>
