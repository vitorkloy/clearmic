const $ = (id) => document.getElementById(id);
const store = { get: (k) => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v) };
let ctx, stream, node, anIn, anOut, raf;

async function listDevices() {
  // pede permissão uma vez para os rótulos dos dispositivos aparecerem
  try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop()); } catch {}
  const devs = await navigator.mediaDevices.enumerateDevices();
  const fill = (sel, kind, key, prefer) => {
    sel.innerHTML = '';
    devs.filter((d) => d.kind === kind).forEach((d) => sel.add(new Option(d.label || d.deviceId, d.deviceId)));
    const saved = store.get(key), cable = [...sel.options].find((o) => prefer.test(o.text));
    if (saved && [...sel.options].some((o) => o.value === saved)) sel.value = saved;
    else if (cable) sel.value = cable.value;
  };
  fill($('input'), 'audioinput', 'in', /^$/);
  fill($('output'), 'audiooutput', 'out', /cable input|virtual|blackhole|clearmic/i);
}

async function start() {
  ctx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
  await ctx.audioWorklet.addModule(new URL('../engine/worklet.mjs', import.meta.url));
  stream = await navigator.mediaDevices.getUserMedia({ audio: {
    deviceId: { exact: $('input').value }, channelCount: 1,
    noiseSuppression: false, echoCancellation: false, autoGainControl: false } });
  const src = ctx.createMediaStreamSource(stream);
  node = new AudioWorkletNode(ctx, 'clearmic-denoise', { numberOfOutputs: 1, outputChannelCount: [2] });
  node.port.postMessage({ enabled: $('nc').checked });
  node.port.onmessage = (e) => { $('vad').textContent = Math.round(e.data.vad * 100) + '%'; };
  anIn = ctx.createAnalyser(); anOut = ctx.createAnalyser();
  src.connect(anIn); src.connect(node); node.connect(anOut); node.connect(ctx.destination);
  const sink = $('output').value;
  if (ctx.setSinkId && sink && sink !== 'default') {
    const t = new Promise((_, rej) => setTimeout(() => rej(new Error('saída não respondeu')), 3000));
    await Promise.race([ctx.setSinkId(sink), t]).catch((e) => console.warn('setSinkId:', e.message));
  }
  meter(); setUi(true);
}
async function stop() {
  cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); await ctx?.close();
  ctx = null; setUi(false); $('mIn').style.width = $('mOut').style.width = '0';
}
function meter() {
  const buf = new Float32Array(1024);
  const lvl = (a) => { a.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v;
    const db = 10 * Math.log10(s / buf.length + 1e-10); return Math.max(0, Math.min(100, (db + 60) * 100 / 60)); };
  $('mIn').style.width = lvl(anIn) + '%'; $('mOut').style.width = lvl(anOut) + '%';
  raf = requestAnimationFrame(meter);
}
function setUi(on) {
  $('toggle').textContent = on ? 'Desligar' : 'Ligar'; $('toggle').classList.toggle('on', on);
  $('status').textContent = on ? 'Ativo' : 'Desligado'; $('status').className = 'pill ' + (on ? 'on' : 'off');
  $('input').disabled = $('output').disabled = on;
}
$('toggle').onclick = () => (ctx ? stop() : start().catch((e) => { alert('Erro ao iniciar: ' + e.message); stop(); }));
$('nc').onchange = () => node?.port.postMessage({ enabled: $('nc').checked });
$('input').onchange = () => store.set('in', $('input').value);
$('output').onchange = () => store.set('out', $('output').value);
navigator.mediaDevices.ondevicechange = listDevices;
listDevices();
