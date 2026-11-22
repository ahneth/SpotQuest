// Version: 1.1.0 | Last Modified: 2026-11-23 01:15 HKT | Build: 20261123_0115
// Module: js/audioSynth.js — Zero-Asset Web Audio API Synth Cues with Soft Gain Limiter (Aria Vance-Sato 14 & Kai Lindqvist 17)
(function (global) {
  'use strict';
  let audioCtx = null;
  let muted = false;

  function ensureCtx() {
    if (muted) return null;
    const Ctx = global.AudioContext || global.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) {
      try { audioCtx = new Ctx(); } catch (_e) { return null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playCue(cueName = 'tap') {
    if (muted) return { ok: true, muted: true, cue: cueName };
    const ctx = ensureCtx();
    if (!ctx) return { ok: true, muted: false, headless: true, cue: cueName };
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.16, now);
      if (cueName === 'unlock') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.30);
      } else if (cueName === 'shutter') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(920, now);
        osc.frequency.exponentialRampToValueAtTime(380, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.09);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(640, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.06);
      }
      return { ok: true, muted: false, cue: cueName };
    } catch (_err) {
      return { ok: true, muted: false, cue: cueName };
    }
  }

  function setMuted(flag) { muted = Boolean(flag); return muted; }
  function isMuted() { return muted; }

  global.SpotAudio = Object.freeze({ playCue, setMuted, isMuted });
})(typeof window !== 'undefined' ? window : globalThis);
