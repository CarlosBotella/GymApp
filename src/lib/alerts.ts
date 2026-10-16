import type { Settings } from './types';

// Avisos del descanso en capas: vibración (Android), pitido (iOS y auriculares),
// notificación si la app está en segundo plano.
let ctx: AudioContext | null = null;

/** Hay que llamarlo dentro de un toque del usuario para que iOS permita el sonido */
export function primeAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* sin audio */
  }
}

function beep(freq: number, ms: number, delay = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  const t = ctx.currentTime + delay / 1000;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + ms / 1000 + 0.05);
}

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

export function warnSoon(s: Settings) {
  if (s.alert === 'none') return;
  if (s.alert !== 'sound' && canVibrate()) navigator.vibrate([80, 80, 80]);
  if (s.alert !== 'vibrate') beep(880, 120);
}

export async function restOver(s: Settings, body: string) {
  if (s.alert !== 'none') {
    if (s.alert !== 'sound' && canVibrate()) navigator.vibrate([300, 120, 300]);
    if (s.alert !== 'vibrate') {
      beep(988, 180);
      beep(1319, 260, 200);
    }
  }
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification('Descanso terminado', { body, tag: 'rest', icon: 'icon-192.png' });
      else new Notification('Descanso terminado', { body });
    } catch {
      /* sin notificaciones */
    }
  }
}

export async function askNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export function tapFeedback() {
  if (canVibrate()) navigator.vibrate(12);
}

let lock: { release: () => Promise<void> } | null = null;
export async function keepAwake(on: boolean) {
  try {
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (on && wl && !lock) lock = await wl.request('screen');
    if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch {
    lock = null;
  }
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
