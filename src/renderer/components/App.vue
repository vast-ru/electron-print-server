<template>
    <div>
        <div>
            <h3>Настройки сервера</h3>
            <select v-model="serverIp" :disabled="serverState === 'running'">
                <option v-for="ip in availableIps" :value="ip">{{ ip }}</option>
            </select>
            <input type="text" v-model="serverPort" placeholder="3030"/>
            <label title="Использовать защищенное соединение">
                <input type="checkbox"
                    v-model="serverHttps"
                    :disabled="serverState === 'running'"
                />
                HTTPS
            </label>
            <button
                @click="startServer()"
                :disabled="serverState === 'running' || !serverIp || (serverHttps && (!httpsCert || !httpsCertKey))"
            >On</button>
            <button
                @click="stopServer()"
                :disabled="serverState !== 'running'"
            >Off</button>
            <div>
                Статус: {{ serverStateText }}
                <button v-if="serverState === 'running'" @click="copyAddress()">Скопировать адрес</button>
            </div>
            <div>
                <label>
                    <input type="checkbox" v-model="serverAutostart"/>
                    Автозапуск сервера при старте приложения
                </label>
            </div>
        </div>

        <div>
            <h3>Проверка печати</h3>
            <input type="text" v-model="urlToPrint">
            <select v-model="printer">
                <option v-for="p in availablePrinters" :value="p.name">{{ p.name }}</option>
            </select>
            <button @click="print()" :disabled="printer === null">Напечатать</button>
            {{ printResult }}
        </div>

        <div v-if="serverHttps">
            <h3>HTTPS</h3>
            <p>
                Сертификат (файл .crt)<br/>
                <textarea rows="4" cols="64"
                    v-model="httpsCert"
                    placeholder="Вставьте содержимое файла .crt"
                ></textarea>
            </p>
            <p>
                Ключ сертификата (файл .key)<br/>
                <textarea rows="4" cols="64"
                    v-model="httpsCertKey"
                    placeholder="Вставьте содержимое файла .key"
                ></textarea>
            </p>
        </div>
    </div>
</template>

<script>
    import { clipboard, ipcRenderer } from 'electron';
    import settings from 'electron-settings';
    import flatten from 'lodash/flatten';

    export default {
        data() {
            return {
                availableIps   : [],
                serverIp       : settings.get('server.ip', null),
                serverPort     : settings.get('server.port', 3030),
                serverHttps    : settings.get('server.https.enabled', false),
                httpsCert      : settings.get('server.https.cert', ''),
                httpsCertKey   : settings.get('server.https.certKey', ''),
                serverState    : '',
                serverAutostart: settings.get('server.autostart', false),

                availablePrinters: [],
                printer          : null,
                urlToPrint       : 'https://vast.ru',
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
                settings.set('server.ip', ip);
            },
            serverPort(port) {
                settings.set('server.port', port);
            },
            serverHttps(useHttps) {
                settings.set('server.https.enabled', useHttps);
            },
            httpsCert(cert) {
                settings.set('server.https.cert', cert);
            },
            httpsCertKey(key) {
                settings.set('server.https.certKey', key);
            },
            serverAutostart(autostart) {
                settings.set('server.autostart', autostart);
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
                    .filter(addr => addr.family === "IPv4" && !addr.internal)
                    .map(addr => addr.address)
                    .concat('localhost');
            },
            updateServerState() {
                ipcRenderer.send('get-server-state');
            },
            print() {
                ipcRenderer.send('print', { printer: this.printer, url: this.urlToPrint });
                ipcRenderer.once('print-result', (e, { success, error }) => {
                    this.printResult = success ? 'ok' : 'fail: ' + JSON.stringify(error);
                });
            },
            startServer() {
                ipcRenderer.send('start-server', {
                    port        : this.serverPort,
                    hostname    : this.serverIp,
                    httpsSettings: {
                        useHttps    : this.serverHttps,
                        httpsCert   : this.httpsCert,
                        httpsCertKey: this.httpsCertKey,
                    },
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
