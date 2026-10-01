/**
 * ASTRAEA の声の加工 (ブラウザ版)。
 *   声づくりで使っている ffmpeg の加工を、Web Audio (OfflineAudioContext) で同じ順番に再現する。
 *     aresample=48000 → highpass 110Hz → EQ 3.2kHz +3dB (Q1.2) → EQ 9kHz +2dB (Q1)
 *     → 重ね声: +0.6% を 11ms 遅らせて 0.35 / −0.6% を 17ms 遅らせて 0.30 (元の声と 3 つを足す)
 *     → aecho 0.8:0.5:6|38:0.22|0.10 → aecho 0.9:0.6:70|120:0.12|0.07 → 無音 0.25 秒 → loudnorm -20.5 LUFS
 *   EQ・重ね声・反響はどれも線形なので、ffmpeg と順番を入れ替えても結果は同じ。
 *   音程ずらしは playbackRate で行う (0.6% なので長さの差は 15 秒で 0.09 秒。コーラスとしては同じに聞こえる)。
 *   ffmpeg の rubberband は高音を少し足し、低音の残り方も違うので、聞き比べて次の補正を入れている:
 *     highpass を 2 段 (110Hz + 150Hz)、9kHz を +4dB、4.5kHz 以上を +3dB (high shelf)。
 *   同じ Kokoro の生音声を両方で加工して比べ、150Hz 以上の帯域の差は ±1.8dB 以内、音量の差は 0.1dB 以内。
 *   音量そろえは loudnorm の代わりに、平均 RMS を -20.5dB にしてピークを -4dB にやわらかく抑える。
 * ※ ブラウザ専用 (サーバーでは使わない)。
 */

const SR = 48000;
const TARGET_RMS_DB = -20.5; // ffmpeg 版 (loudnorm -20.5 LUFS) と同じ文で聞き比べて合わせた値
const PEAK_LIMIT = Math.pow(10, -4 / 20); // TP=-4
// ffmpeg 版との聞き比べ (帯域ごとのエネルギー) で合わせた値
const HI_FREQ = 9000, HI_GAIN = 4;
const SHELF_FREQ = 4500, SHELF_GAIN = 3;

type Ctx = OfflineAudioContext;

function echo(ctx: Ctx, input: AudioNode, inGain: number, outGain: number, taps: [number, number][]): AudioNode {
  // ffmpeg aecho: out = (in*inGain + Σ delayed(in)*decay) * outGain
  const sum = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = inGain;
  input.connect(dry).connect(sum);
  for (const [ms, decay] of taps) {
    const d = ctx.createDelay(1);
    d.delayTime.value = ms / 1000;
    const g = ctx.createGain();
    g.gain.value = decay;
    input.connect(d).connect(g).connect(sum);
  }
  const out = ctx.createGain();
  out.gain.value = outGain;
  sum.connect(out);
  return out;
}

/** 生の Kokoro の音 (Float32Array, 24kHz など) → ASTRAEA の声 (AudioBuffer, 48kHz モノラル) */
export async function astraeaFx(raw: Float32Array, rawRate: number): Promise<AudioBuffer> {
  const padSec = 0.25 + 0.2; // apad 0.25 秒 + 反響の余韻
  const len = Math.ceil((raw.length / rawRate + padSec) * SR);
  const ctx = new OfflineAudioContext(1, len, SR);
  const buf = ctx.createBuffer(1, raw.length, rawRate);
  buf.getChannelData(0).set(raw);

  // 重ね声 (元 1.0 / +0.6% 11ms 0.35 / −0.6% 17ms 0.30)
  const mix = ctx.createGain();
  const voices: [number, number, number][] = [[1, 0, 1], [1.006, 11, 0.35], [0.994, 17, 0.3]];
  for (const [rate, ms, vol] of voices) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(mix);
    src.start(ms / 1000);
  }

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 110; hp.Q.value = Math.SQRT1_2;
  const hp2 = ctx.createBiquadFilter(); // ffmpeg 版と聞き比べて低音の残り方を合わせるため 2 段
  hp2.type = "highpass"; hp2.frequency.value = 150; hp2.Q.value = Math.SQRT1_2;
  const eq1 = ctx.createBiquadFilter();
  eq1.type = "peaking"; eq1.frequency.value = 3200; eq1.Q.value = 1.2; eq1.gain.value = 3;
  const eq2 = ctx.createBiquadFilter();
  eq2.type = "peaking"; eq2.frequency.value = HI_FREQ; eq2.Q.value = 1; eq2.gain.value = HI_GAIN;
  // ffmpeg の rubberband は高音を少し足す (ブラウザの音程ずらしには無い)。その分を補う
  const shelf = ctx.createBiquadFilter();
  shelf.type = "highshelf"; shelf.frequency.value = SHELF_FREQ; shelf.gain.value = SHELF_GAIN;
  mix.connect(hp).connect(hp2).connect(eq1).connect(eq2).connect(shelf);

  const e1 = echo(ctx, shelf, 0.8, 0.5, [[6, 0.22], [38, 0.1]]);
  const e2 = echo(ctx, e1, 0.9, 0.6, [[70, 0.12], [120, 0.07]]);
  e2.connect(ctx.destination);

  const out = await ctx.startRendering();
  normalize(out.getChannelData(0));
  return out;
}

/** 平均の大きさを今の声にそろえ、ピークを −4dB までにやわらかく抑える */
export function normalize(x: Float32Array): void {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (Math.abs(v) > 1e-4) { sum += v * v; n++; } // 無音は数えない
  }
  if (!n) return;
  const rmsDb = 10 * Math.log10(sum / n);
  const gain = Math.pow(10, (TARGET_RMS_DB - rmsDb) / 20);
  const knee = PEAK_LIMIT * 0.7;
  for (let i = 0; i < x.length; i++) {
    let v = x[i] * gain;
    const a = Math.abs(v);
    if (a > knee) {
      // knee を超えた分を tanh で丸めて PEAK_LIMIT を超えないようにする
      const over = (a - knee) / (PEAK_LIMIT - knee);
      v = Math.sign(v) * (knee + (PEAK_LIMIT - knee) * Math.tanh(over));
    }
    x[i] = v;
  }
}

/** AudioBuffer → WAV (16bit PCM)。保存・比較用 */
export function toWav(b: AudioBuffer): Blob {
  const ch = b.getChannelData(0);
  const data = new DataView(new ArrayBuffer(44 + ch.length * 2));
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); data.setUint32(4, 36 + ch.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true);
  data.setUint32(24, b.sampleRate, true); data.setUint32(28, b.sampleRate * 2, true);
  data.setUint16(32, 2, true); data.setUint16(34, 16, true); w(36, "data"); data.setUint32(40, ch.length * 2, true);
  for (let i = 0; i < ch.length; i++) data.setInt16(44 + i * 2, Math.max(-1, Math.min(1, ch[i])) * 0x7fff, true);
  return new Blob([data], { type: "audio/wav" });
}
