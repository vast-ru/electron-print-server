<template>
  <div>
    <p>
      <input type="url" v-model="url"/>
      <select v-model="printer">
        <option v-for="p in printers" :value="p.name">{{ p.name }}</option>
      </select>
    </p>
    <p>
      <button @click="print()" :disabled="!isPrinterSelected">Напечатать</button>
      {{ this.printResult }}
    </p>
  </div>
</template>

<script>
    import { ipcRenderer } from 'electron';

    export default {
        data() {
            return {
                url: 'https://vk.com/mr.marmok',
                printResult: '',
                printer: null,
                printers: [],
            };
        },
        created() {
            this.updatePrinters();
        },
        computed: {
            isPrinterSelected() {
                return this.printer !== null;
            }
        },
        methods: {
            updatePrinters() {
                ipcRenderer.send('get-printers');
                ipcRenderer.on('printers', (e, printers) => {
                    this.printers = printers;
                });
            },
            print() {
                this.printResult = '';
                ipcRenderer.send('print', { printer: this.printer, url: this.url });
                ipcRenderer.on('print-result', (e, result) => {
                    this.printResult = result ? 'Успех' : 'Ошибка';
                });
            },
        },
    };
</script>
