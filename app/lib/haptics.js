/**
 * Light haptic helpers — no-op on web / if plugin unavailable.
 */

async function withHaptics(fn) {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    await fn({ Haptics, ImpactStyle, NotificationType });
  } catch {
    /* ignore */
  }
}

export function hapticLight() {
  return withHaptics(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }));
}

export function hapticMedium() {
  return withHaptics(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Medium }));
}

export function hapticSuccess() {
  return withHaptics(({ Haptics, NotificationType }) =>
    Haptics.notification({ type: NotificationType.Success })
  );
}

export function hapticError() {
  return withHaptics(({ Haptics, NotificationType }) =>
    Haptics.notification({ type: NotificationType.Error })
  );
}

export function hapticSelection() {
  return withHaptics(({ Haptics }) => Haptics.selectionChanged());
}
