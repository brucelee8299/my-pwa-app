// 声音：Web Audio 合成的钢琴音色 + 音效；可选连接 MIDI 电子琴
let ctx = null;
let enabled = true;
export const setSoundEnabled = (on) => { enabled = on; };

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
/** 在用户第一次点击时调用，解锁 iOS 上的声音 */
export function unlockAudio() { if (enabled) ac(); }

function tone(freq, { when = 0, dur = 1.4, vol = 0.32, type = 'piano' } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + when;
  const out = c.createGain();
  out.connect(c.destination);
  if (type === 'piano') {
    // 三个泛音叠加 + 快起音 + 指数衰减，听起来接近钢琴
    const decay = Math.max(0.5, dur * (1.2 - Math.min(0.7, freq / 1500)));
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(12000, freq * 8), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 2), t + decay);
    lp.connect(out);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    out.gain.exponentialRampToValueAtTime(vol * 0.4, t + 0.15);
    out.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12], [4.01, 'sine', 0.05]].forEach(([mul, wave, g]) => {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = wave;
      o.frequency.value = freq * mul;
      og.gain.value = g;
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(t + decay + 0.05);
    });
  } else {
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

export function playFreq(freq, opts) { if (enabled) tone(freq, opts); }
export function playMelody(freqs, gap = 0.32) {
  if (!enabled) return;
  freqs.forEach((f, i) => tone(f, { when: i * gap, dur: 1.1, vol: 0.26 }));
}

export function sfx(kind) {
  if (!enabled) return;
  const S = {
    ok: () => { tone(1568, { type: 'sine', dur: 0.12, vol: 0.08 }); tone(2093, { type: 'sine', when: 0.07, dur: 0.18, vol: 0.08 }); },
    bad: () => tone(147, { type: 'square', dur: 0.22, vol: 0.05 }),
    combo: () => [1047, 1319, 1568].forEach((f, i) => tone(f, { type: 'sine', when: i * 0.05, dur: 0.15, vol: 0.07 })),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { when: i * 0.11, dur: 0.9, vol: 0.22 })),
    lose: () => [392, 330, 262].forEach((f, i) => tone(f, { when: i * 0.22, dur: 0.6, vol: 0.2 })),
    hit: () => tone(98, { type: 'triangle', dur: 0.25, vol: 0.25 }),
  };
  S[kind]?.();
}

// ---------- MIDI 电子琴 ----------
export const midiSupported = () => typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess;
export async function connectMidi(onNote) {
  const access = await navigator.requestMIDIAccess();
  const bind = () => {
    let n = 0;
    access.inputs.forEach((input) => {
      n += 1;
      input.onmidimessage = (e) => {
        const [st, note, vel] = e.data;
        if ((st & 0xf0) === 0x90 && vel > 0) onNote(note);
      };
    });
    return n;
  };
  access.onstatechange = bind;
  return bind();
}
