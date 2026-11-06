# Clearmic

Cancelamento de ruído do microfone para Windows, no estilo do Krisp. Roda só na CPU, sem GPU e sem NVIDIA Broadcast.

## Como funciona

```
Microfone ──► AudioWorklet (RNNoise WASM, frames de 10 ms) ──► dispositivo de saída
                                                              (CABLE Input / microfone virtual)
Teams / Meet / Discord ◄── "CABLE Output" como microfone
```

- **Console:** Electron e HTML/JS puro, sem framework, pra ficar leve. Tem seletor de entrada e saída, botão ligar/desligar, chave do cancelamento, medidores antes/depois e indicador de voz.
- **Motor:** [RNNoise](https://github.com/xiph/rnnoise) compilado para WebAssembly ([@shiguredo/rnnoise-wasm](https://github.com/shiguredo/rnnoise-wasm)), rodando na thread de áudio em tempo real (`src/engine/worklet.mjs`). O usuário não instala nada além do app.
- **Latência:** cerca de 30 ms (10 ms de buffer e 20 ms do próprio RNNoise).
- **Monorepo:** o motor (`src/engine`) é independente da interface e é testado sozinho em Node (`scripts/test-dsp.mjs`).

## Rodar

```bash
npm install
npm start          # abre o console
npm run test:dsp   # teste offline: gera test/noisy.wav e test/denoised.wav e mede
npm run dist       # instalador NSIS + versão portátil (Windows)
```

### Resultado do teste offline

Fala de 15 s com ruído branco, zumbido de 60/180 Hz e ruído grave tipo ventoinha, SNR de entrada de 5 dB:

| Métrica | Valor |
|---|---|
| SNR de saída | **11,6 dB** (+6,6 dB) |
| Ruído nas pausas | **−43 dB** |
| Velocidade (WASM, 1 núcleo) | 8× tempo real (cerca de 12% de um núcleo) |

## Microfone virtual no Windows

O Windows não deixa um app comum criar um microfone. Precisa de um driver de áudio virtual.

| Opção | Prós | Contras |
|---|---|---|
| **VB-CABLE** (VB-Audio) | Assinado, estável, muito usado | Donationware: **embutir no instalador exige licença** da VB-Audio. Sem ela, o usuário instala à parte. |
| **Virtual-Audio-Driver** (VirtualDrivers, open source) | Pode ser redistribuído, dá pra embutir no instalador | Precisa conferir a assinatura e a estabilidade com Teams/Discord |
| Driver próprio (SysVAD/WDK) | Controle total | Assinatura EV e attestation da Microsoft: caro e lento |

**Plano:** o MVP usa VB-CABLE se ele já estiver instalado (o app detecta "CABLE Input" sozinho). Na v0.2, o instalador NSIS passa a trazer o driver open source, instalado em silêncio com `pnputil`.

## Roadmap

- [x] Pipeline mic → RNNoise → saída, console pt-BR, teste offline
- [ ] Bandeja do sistema, iniciar com o Windows, lembrar o estado ligado
- [ ] Instalador com o driver virtual embutido
- [ ] Ajuste de intensidade (mistura seco/molhado) e gate pelo VAD
- [ ] Motor opcional DeepFilterNet (melhor qualidade, mais CPU)
- [ ] Medir CPU/RAM no Windows; se o Electron pesar, migrar a interface para Tauri
