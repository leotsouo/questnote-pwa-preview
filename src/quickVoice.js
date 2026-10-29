/**
 * Quick voice entry: one tap starts listening, only 停止 saves. Anything that is not a deliberate
 * stop (the 60 s cap, the engine ending by itself, errors, empty speech) hands the text to the typed
 * form instead. This file is the only place that talks to the recognition engine, so a native
 * recognizer can replace it later without touching the sheet or the save flow.
 */
import { speechText } from './taskVoiceInput.js';

export const QUICK_VOICE_MAX_MS = 60000;

/**
 * states: idle (not listening) → listening → finishing → done. Callbacks:
 * onState(state, liveText), onSave(text), onFallback(text, reason), onCancel().
 */
export function createQuickVoiceSession({
  Recognition = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition,
  maxMs = QUICK_VOICE_MAX_MS,
  onState = () => {},
  onSave = () => {},
  onFallback = () => {},
  onCancel = () => {},
  setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer = (id) => globalThis.clearTimeout(id),
} = {}) {
  let state = 'idle';
  let recognition = null;
  let text = '';
  let error = '';
  let reason = '';
  let timer = null;

  function setState(next) {
    state = next;
    onState(state, text);
  }
  function clearCap() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }
  function detach(session) {
    session.onstart = null;
    session.onresult = null;
    session.onerror = null;
    session.onend = null;
  }
  function finish() {
    clearCap();
    recognition = null;
    const heard = text.trim();
    setState('done');
    if (reason === 'stop' && !error && heard) onSave(heard);
    else onFallback(heard, error || (reason === 'stop' ? 'empty' : reason || 'ended'));
  }

  function start() {
    if (state === 'listening' || state === 'finishing') return;
    if (!Recognition) {
      setState('done');
      onFallback('', 'unsupported');
      return;
    }
    let session;
    try { session = new Recognition(); }
    catch {
      setState('done');
      onFallback('', 'unsupported');
      return;
    }
    text = '';
    error = '';
    reason = '';
    recognition = session;
    session.lang = 'zh-TW';
    session.continuous = true;
    session.interimResults = true;
    session.maxAlternatives = 1;
    session.onstart = () => {
      if (recognition === session && state !== 'listening') setState('listening');
    };
    session.onresult = (event) => {
      if (recognition !== session) return;
      text = speechText(event.results);
      onState(state, text);
    };
    session.onerror = (event) => {
      if (recognition !== session) return;
      error = event.error || 'error';
    };
    session.onend = () => {
      if (recognition !== session) return;
      finish();
    };
    try {
      session.start();
    } catch {
      // The system refused to start without a tap; the sheet shows a big mic to press instead.
      detach(session);
      recognition = null;
      setState('idle');
      return;
    }
    setState('listening');
    timer = setTimer(() => {
      if (state !== 'listening') return;
      reason = 'timeout';
      setState('finishing');
      try { session.stop(); } catch { finish(); }
    }, maxMs);
  }

  function stop() {
    if (state !== 'listening' || !recognition) return;
    clearCap();
    reason = 'stop';
    setState('finishing');
    try { recognition.stop(); } catch { finish(); }
  }

  function cancel() {
    if (state === 'done') return;
    clearCap();
    const session = recognition;
    recognition = null;
    if (session) {
      detach(session);
      try { session.abort(); } catch { /* The engine may already have ended. */ }
    }
    setState('done');
    onCancel();
  }

  return { start, stop, cancel, get state() { return state; } };
}
