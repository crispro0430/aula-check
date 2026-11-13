'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * Lee un valor que solo existe en el navegador (p. ej. `window.location`) sin
 * `setState` dentro de `useEffect`. Durante SSR e hidratación devuelve `serverValue`
 * y React vuelve a renderizar con el valor real del cliente, evitando mismatches.
 * `read` debe devolver un valor estable (primitivo) entre llamadas.
 */
export function useBrowserValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => serverValue);
}

/** `true` solo en el cliente tras hidratar (útil para portales con `document.body`). */
export function useIsClient(): boolean {
  return useBrowserValue(() => true, false);
}
