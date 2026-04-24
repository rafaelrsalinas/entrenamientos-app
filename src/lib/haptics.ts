/**
 * Pequeño wrapper sobre la Vibration API con presets tipo iOS.
 * Silencioso si el dispositivo no soporta o el usuario lo silencia.
 */

type Kind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const PATTERNS: Record<Kind, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 35,
  success: [15, 40, 15],
  warning: [30, 60, 30],
  error: [40, 30, 40, 30, 40],
};

export function haptic(kind: Kind = 'light') {
  try {
    navigator.vibrate?.(PATTERNS[kind]);
  } catch {
    /* ignore */
  }
}
