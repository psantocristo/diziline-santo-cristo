// PWA registration + Web Push helpers
// Safe to call on any environment — auto-skips dev / Lovable preview / iframes.

export const VAPID_PUBLIC_KEY =
  'BCsikLei5KuZvrsE6Yymk-TgjToHpS73HmT6jhYYUhCIJLbjiOcW1vEr4iabqI0L2ReA2ilEA_IritFTHLCRoLk';

const PREVIEW_HOST_PATTERNS = [
  /\.lovableproject\.com$/i,
  /\.lovableproject-dev\.com$/i,
  /\.lovable\.app$/i,
  /\.beta\.lovable\.dev$/i,
];

export function isPreviewOrDev(): boolean {
  if (typeof window === 'undefined') return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith('id-preview--') || host.startsWith('preview--')) return true;
  if (PREVIEW_HOST_PATTERNS.some((re) => re.test(host))) return true;
  if (new URL(window.location.href).searchParams.get('sw') === 'off') return true;
  return false;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (isPreviewOrDev()) {
    // Cleanup any stale SW registrations in preview
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(regs.filter((r) => r.active?.scriptURL.endsWith('/sw.js')).map((r) => r.unregister()));
    } catch {}
    return null;
  }
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (e) {
    console.warn('[PWA] SW registration failed', e);
    return null;
  }
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // @ts-ignore iOS Safari
    window.navigator.standalone === true
  );
}

export function detectPlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  if (isIOS()) return 'ios';
  if (/Android/i.test(navigator.userAgent)) return 'android';
  return 'desktop';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function subscribePush(): Promise<PushSubscriptionJSON | null> {
  if (!pushSupported()) throw new Error('Seu navegador não suporta notificações push.');
  if (isIOS() && !isStandalone()) {
    throw new Error(
      'No iPhone/iPad, instale o app na tela inicial primeiro: toque em Compartilhar → "Adicionar à Tela de Início".'
    );
  }
  const reg = (await navigator.serviceWorker.ready) || (await registerServiceWorker());
  if (!reg) throw new Error('Service worker não disponível.');

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permissão de notificação negada.');

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }
  return sub.toJSON();
}

export async function unsubscribePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}
