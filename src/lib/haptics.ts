type Pattern = 'tap' | 'select' | 'success' | 'warn' | 'error' | 'heavy';

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  select: 12,
  success: [12, 40, 22],
  warn: [24, 60, 24],
  error: [40, 50, 40, 50, 60],
  heavy: 45,
};

let enabled = true;
export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

export function haptic(pattern: Pattern = 'tap') {
  if (!enabled) return;
  try {
    navigator.vibrate?.(PATTERNS[pattern]);
  } catch {
    /* Safari kann das (noch) nicht – kein Problem. */
  }
}
