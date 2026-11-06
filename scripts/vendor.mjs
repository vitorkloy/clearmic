import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('src/vendor', { recursive: true });
copyFileSync('node_modules/@shiguredo/rnnoise-wasm/dist/rnnoise.js', 'src/vendor/rnnoise.js');
