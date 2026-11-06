// Teste offline: mistura fala limpa + ruído, passa pelo RNNoise, mede SNR e redução de ruído.
import { readFileSync, writeFileSync } from 'node:fs';
globalThis.WorkerGlobalScope ??= function () {};
const { Rnnoise } = await import('@shiguredo/rnnoise-wasm');
import { FrameDenoiser } from '../src/engine/denoiser.mjs';

const readWav = (p) => { const b = readFileSync(p); let o = 12;
  while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4);
  const n = b.readUInt32LE(o + 4) / 2, s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = b.readInt16LE(o + 8 + i * 2) / 32768; return s; };
const writeWav = (p, s) => { const h = Buffer.alloc(44), d = Buffer.alloc(s.length * 2);
  s.forEach((v, i) => d.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2));
  h.write('RIFF'); h.writeUInt32LE(36 + d.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(48000, 24); h.writeUInt32LE(96000, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(d.length, 40);
  writeFileSync(p, Buffer.concat([h, d])); };
const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
const db = (x) => 20 * Math.log10(x + 1e-12);

const clean = readWav('test/clean.wav');
let seed = 1; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32) * 2 - 1;
// ruído: branco + zumbido 60 Hz/harmônicos + "ventoinha" grave
const noise = new Float32Array(clean.length); let lp = 0;
for (let i = 0; i < noise.length; i++) { const t = i / 48000; lp = 0.98 * lp + 0.02 * rnd();
  noise[i] = 0.5 * rnd() + 0.3 * (Math.sin(2*Math.PI*60*t) + 0.5*Math.sin(2*Math.PI*180*t)) + 3 * lp; }
const g = (rms(clean) / rms(noise)) * 10 ** (-5 / 20); // SNR de entrada = 5 dB
const noisy = clean.map((v, i) => v + g * noise[i]);

const rn = await Rnnoise.load(); const st = rn.createDenoiseState();
const den = new FrameDenoiser(st, rn.frameSize);
const out = new Float32Array(noisy.length), blk = 128; const t0 = performance.now();
for (let i = 0; i < noisy.length; i += blk) { const o = new Float32Array(Math.min(blk, noisy.length - i));
  den.process(noisy.subarray(i, i + o.length), o); out.set(o, i); }
const ms = performance.now() - t0; const lat = 3 * rn.frameSize; // 10 ms buffer + ~20 ms atraso interno do RNNoise
const aligned = out.subarray(lat), ref = clean.subarray(0, aligned.length), nin = noisy.subarray(0, aligned.length);
const snr = (y) => { let e = 0; for (let i = 0; i < ref.length; i++) e += (y[i] - ref[i]) ** 2; return db(rms(ref) / Math.sqrt(e / ref.length)); };
// segmentos sem fala (energia limpa baixa) => ruído residual
const silIdx = []; for (let i = 0; i < ref.length; i += 480) if (rms(ref.subarray(i, i + 480)) < 0.003) silIdx.push(i);
const segRms = (y) => Math.sqrt(silIdx.reduce((s, i) => s + rms(y.subarray(i, i + 480)) ** 2, 0) / silIdx.length);
writeWav('test/noisy.wav', noisy); writeWav('test/denoised.wav', out);
console.log(JSON.stringify({ seconds: (clean.length / 48000).toFixed(1), procMs: ms.toFixed(0),
  realtimeFactor: (clean.length / 48000 * 1000 / ms).toFixed(0) + 'x',
  snrInDb: snr(nin).toFixed(1), snrOutDb: snr(aligned).toFixed(1),
  noiseInPausesDb: (db(segRms(aligned)) - db(segRms(nin))).toFixed(1), pauseFrames: silIdx.length }, null, 1));
st.destroy();
