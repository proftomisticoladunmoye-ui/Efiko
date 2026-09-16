// EFIKO — performance modes (Full / Smart / Lite). The low-bandwidth mission made concrete:
// the learner (or the network) decides how much the app spends on media, animation and
// requests. Three modes:
//   full  — everything: rich visuals, animation, autoplay-capable media, prefetch.
//   smart — balanced; resolves to full or lite automatically from the live network + device.
//   lite  — genuinely trimmed: text-first, no decorative media, minimal animation, fewer
//           background requests. For 2G/3G, data-saver, limited data or low-end phones.
//
// The chosen mode is stored per-device. The *effective* mode (what the UI actually applies) is
// reflected onto <html data-mode="…"> so CSS can respond, and broadcast so components can defer
// heavy work. Everything degrades gracefully when the Network Information API is absent.
import { useEffect, useState } from 'react';

export const MODES = ['full', 'smart', 'lite'];
export const MODE_LABELS = { full: 'Full', smart: 'Smart', lite: 'Lite' };
const KEY = 'efiko-perf-mode';
const listeners = new Set();

export function getMode() {
  try { const m = localStorage.getItem(KEY); return MODES.includes(m) ? m : 'smart'; } catch { return 'smart'; }
}

export function setMode(m) {
  if (!MODES.includes(m)) return;
  try { localStorage.setItem(KEY, m); } catch { /* ignore */ }
  apply();
  emit();
}

const conn = () =>
  (typeof navigator !== 'undefined' &&
    (navigator.connection || navigator.mozConnection || navigator.webkitConnection)) || null;

// Live network + device signals (any may be missing on a given browser).
export function netInfo() {
  const c = conn();
  return {
    saveData: !!(c && c.saveData),
    effectiveType: (c && c.effectiveType) || null, // 'slow-2g' | '2g' | '3g' | '4g'
    downlink: c && typeof c.downlink === 'number' ? c.downlink : null, // Mbps
    deviceMemory: typeof navigator !== 'undefined' && navigator.deviceMemory ? navigator.deviceMemory : null,
    cores: typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : null
  };
}

// Is this a constrained environment — poor network, data-saver, or a low-end device?
export function isConstrained() {
  const n = netInfo();
  if (n.saveData) return true;
  if (n.effectiveType && /^(slow-2g|2g|3g)$/.test(n.effectiveType)) return true;
  if (n.downlink !== null && n.downlink > 0 && n.downlink < 1.5) return true;
  if (n.deviceMemory !== null && n.deviceMemory <= 1) return true;
  return false;
}

// The mode actually applied to the UI. In smart mode this tracks the live environment.
export function effectiveMode() {
  const m = getMode();
  if (m === 'smart') return isConstrained() ? 'lite' : 'full';
  return m;
}

export function apply() {
  try { document.documentElement.dataset.mode = effectiveMode(); } catch { /* SSR/no-DOM */ }
}

function emit() {
  const eff = effectiveMode();
  listeners.forEach((fn) => { try { fn(eff); } catch { /* ignore */ } });
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Call once at boot: reflect the mode immediately and keep smart mode in step with the network.
export function initPerfMode() {
  apply();
  const c = conn();
  if (c && c.addEventListener) c.addEventListener('change', () => { apply(); emit(); });
}

// React binding. Returns the chosen mode, the effective mode, a setter, and whether the
// environment currently looks constrained (used to suggest Lite).
export function usePerfMode() {
  const [mode, setModeState] = useState(getMode);
  const [effective, setEffective] = useState(effectiveMode);
  useEffect(() => subscribe(() => { setModeState(getMode()); setEffective(effectiveMode()); }), []);
  return { mode, effective, setMode, constrained: isConstrained() };
}
