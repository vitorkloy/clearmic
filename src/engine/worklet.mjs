// AudioWorklet: roda na thread de áudio em tempo real. Mic -> RNNoise -> saída.
import './shim.mjs'; // precisa vir antes do RNNoise
import { Rnnoise } from '../vendor/rnnoise.js';
import { FrameDenoiser } from './denoiser.mjs';
let rn = null;
Rnnoise.load().then((r) => { rn = r; });

class ClearmicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.den = null; // criado quando o WASM terminar de carregar (passa direto até lá)
    this.enabled = true;
    this.port.onmessage = (e) => { if ('enabled' in e.data) { this.enabled = e.data.enabled; if (this.den) this.den.enabled = this.enabled; } };
    this.tick = 0;
  }
  process(inputs, outputs) {
    const inp = inputs[0]?.[0], out = outputs[0]?.[0];
    if (!inp || !out) return true;
    if (!this.den && rn) { this.den = new FrameDenoiser(rn.createDenoiseState(), rn.frameSize); this.den.enabled = this.enabled; }
    if (this.den) this.den.process(inp, out); else out.set(inp);
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    if (++this.tick % 30 === 0 && this.den) this.port.postMessage({ vad: this.den.vad });
    return true;
  }
}
registerProcessor('clearmic-denoise', ClearmicProcessor);
