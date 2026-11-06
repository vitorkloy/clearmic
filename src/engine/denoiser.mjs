// Núcleo do pipeline: adapta blocos de qualquer tamanho para frames de 480 amostras
// (10 ms @ 48 kHz) exigidos pelo RNNoise. Usado tanto no AudioWorklet quanto nos testes.
export class FrameDenoiser {
  constructor(state, frameSize = 480) {
    this.state = state;
    this.n = frameSize;
    this.inBuf = new Float32Array(frameSize);
    this.inLen = 0;
    this.outQ = new Float32Array(frameSize * 4);
    this.outLen = frameSize; // 10 ms de latência fixa (silêncio inicial)
    this.enabled = true;
    this.vad = 0;
  }
  process(input, output) {
    for (let i = 0; i < input.length; i++) {
      this.inBuf[this.inLen++] = input[i];
      if (this.inLen === this.n) {
        const f = this.inBuf;
        if (this.enabled) {
          for (let k = 0; k < this.n; k++) f[k] *= 32768; // RNNoise espera escala PCM16
          this.vad = this.state.processFrame(f);
          for (let k = 0; k < this.n; k++) f[k] /= 32768;
        }
        this.outQ.set(f, this.outLen);
        this.outLen += this.n;
        this.inLen = 0;
      }
    }
    const m = Math.min(output.length, this.outLen);
    output.set(this.outQ.subarray(0, m));
    this.outQ.copyWithin(0, m, this.outLen);
    this.outLen -= m;
    if (m < output.length) output.fill(0, m);
  }
}
