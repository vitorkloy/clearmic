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
npm run dist       # instaladores do sistema atual em build-out/
```

### Resultado do teste offline

Fala de 15 s com ruído branco, zumbido de 60/180 Hz e ruído grave tipo ventoinha, SNR de entrada de 5 dB:

| Métrica | Valor |
|---|---|
| SNR de saída | **11,6 dB** (+6,6 dB) |
| Ruído nas pausas | **−43 dB** |
| Velocidade (WASM, 1 núcleo) | 8× tempo real (cerca de 12% de um núcleo) |

## Downloads e releases

Cada push e cada PR rodam o workflow **Build** (`.github/workflows/build.yml`) no Windows, no Linux e no macOS, e deixam os instaladores como artefatos na página do Actions:

| Sistema | Arquivos |
|---|---|
| Windows | `Clearmic_X.Y.Z_x64-setup.exe` (instalador NSIS) e `Clearmic_X.Y.Z_x64-portable.exe` |
| Linux | `Clearmic_X.Y.Z_x86_64.AppImage` e `Clearmic_X.Y.Z_amd64.deb` |
| macOS | `Clearmic_X.Y.Z_x64.dmg` e `Clearmic_X.Y.Z_arm64.dmg` (sem assinatura), além dos `.zip` usados pela atualização automática |

Ao receber uma tag `v*`, o workflow cria o GitHub Release com todos os instaladores e os `latest*.yml`. O app instalado usa esses arquivos para se atualizar sozinho (electron-updater).

```bash
npm run release -- --check   # só valida
npm run release -- patch     # sobe a versão, faz o commit e cria a tag local (não envia)
git push origin main --follow-tags   # publica (somente com aprovação)
```

> macOS: o app não é assinado. Na primeira vez, abra com botão direito → **Abrir**.

## Microfone virtual no Linux e no macOS

Por enquanto o driver embutido é só para Windows. Nos outros sistemas:

- **Linux (PulseAudio ou PipeWire):** crie uma saída nula e use o monitor dela como microfone.
  ```bash
  pactl load-module module-null-sink sink_name=clearmic sink_properties=device.description=Clearmic
  pactl load-module module-remap-source master=clearmic.monitor source_name=clearmic_mic source_properties=device.description=Clearmic-Mic
  ```
  No Clearmic, escolha **Clearmic** como saída. No app de chamada, escolha **Clearmic-Mic** como microfone. No PipeWire os mesmos comandos funcionam via `pipewire-pulse`.
- **macOS:** instale o [BlackHole 2ch](https://github.com/ExistentialAudio/BlackHole) (`brew install blackhole-2ch`). No Clearmic, escolha **BlackHole 2ch** como saída. No Teams, Meet ou Discord, escolha **BlackHole 2ch** como microfone.

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
