export type Quality = 'auto' | 'low' | 'medium' | 'high';
export interface Settings { count: number; ripple: number; speed: number; quality: Quality; sound: boolean; hidden: boolean }
export const defaults: Settings = { count: 18, ripple: 1, speed: 1, quality: 'auto', sound: false, hidden: false };
export function readSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem('kin-pond-v1') || '{}') as Partial<Settings>;
    const clamp = (n: unknown, min: number, max: number, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
    return { count: Math.round(clamp(s.count, 5, 50, 18)), ripple: clamp(s.ripple, 0, 2, 1), speed: clamp(s.speed, .3, 2, 1), quality: ['auto','low','medium','high'].includes(s.quality ?? '') ? s.quality! : 'auto', sound: s.sound === true, hidden: s.hidden === true };
  } catch { return { ...defaults }; }
}
export function saveSettings(s: Settings) { try { localStorage.setItem('kin-pond-v1', JSON.stringify(s)); } catch { /* Private browsing can disable storage. */ } }
