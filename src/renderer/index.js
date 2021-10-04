import { app } from '@electron/remote';
import settings from 'electron-settings';
import Vue from 'vue';
import App from './components/App';

settings.configure({ dir: app.getPath('userData') });

Vue.config.devtools = false;
Vue.config.productionTip = false;

new Vue({
  components: { App },
  template: `<App/>`,
}).$mount('#app');
