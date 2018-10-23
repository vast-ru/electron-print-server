<template>
    <div>
        <div>
            <h3>Настройки сервера</h3>
            <select v-model="serverIp">
                <option v-for="ip in availableIps" :value="ip">{{ ip }}</option>
            </select>
            <input type="text" v-model="serverPort" placeholder="3030"/>
            <button @click="startServer()" :disabled="!serverIp">On</button>
            <button @click="stopServer()" >Off</button>
            <div>Статус: {{ serverStatus }}</div>
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
    </div>
</template>

<script>
    import { ipcRenderer } from 'electron';
    import flatten from 'lodash/flatten';

    export default {
        data() {
            return {
                availableIps     : [],
                serverIp         : null,
                serverPort       : 3030,
                serverStatus     : '',

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
        },
        destroyed() {
            this.stopServer();
        },
        methods: {
            updatePrinters() {
                this.availablePrinters = ipcRenderer.sendSync('get-printers');
            },
            initMainProcessListeners() {
                ipcRenderer.on('server-started', (e, { address, port }) => {
                    this.serverStatus = `Запущен на ${address}:${port}`;
                });
                ipcRenderer.on('server-stopped', e => {
                    this.serverStatus = 'Остановлен';
                });
            },
            updateNetworkInterfaces() {
                const interfaces = ipcRenderer.sendSync('get-network-interfaces');
                this.availableIps = flatten(Object.values(interfaces))
                    .filter(addr => addr.family === "IPv4" && !addr.internal)
                    .map(addr => addr.address);
            },
            print() {
                ipcRenderer.send('print', { printer: this.printer, url: this.urlToPrint });
                ipcRenderer.once('print-result', (e, { success, error }) => {
                    this.printResult = success ? 'ok' : 'fail: ' + JSON.stringify(error);
                });
            },
            startServer() {
                ipcRenderer.send('start-server', { port: this.serverPort, hostname: this.serverIp });
            },
            stopServer() {
                ipcRenderer.send('stop-server');
            },
        },
    };
</script>
