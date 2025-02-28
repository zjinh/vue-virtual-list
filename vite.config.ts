import { resolve } from 'path';
import type { UserConfig } from 'vite';
import vue from '@vitejs/plugin-vue2';
export default function (config) {
  return {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.js'),
        name: 'vue-virtual-list',
        fileName: 'vue-virtual-list',
        cssFileName: 'vue-virtual-list',
        format: 'esm',
      },
      rollupOptions: {
        input: config.mode==='lib'?undefined:resolve(__dirname, '/index.html'),
        external: ['vue', 'vuex', 'vue-router', ],
        output: {
          globals: {
            vue: 'Vue',
            vuex: 'Vuex',
          },
        },
      },
    },
    plugins: [
      vue(),
    ],
  } as UserConfig;
}

