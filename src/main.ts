import './styles.css';
import type { User } from 'firebase/auth';
import { createRealSource } from './data/realSource';
import { cerrarSesion, mensajeFirebase, sesionGuardada } from './firebase/auth';
import { createHub } from './hub/hub';
import type { Sesion } from './shared/types';
import { mountApp } from './ui/app';
import { h } from './ui/dom';
import { authPage } from './ui/pages/auth';
import { loading } from './ui/parts';

const root = document.getElementById('app')!;

/*
 * `pnpm dev --mode mock`: datos de ejemplo, sin Host, sin red y sin Firebase, para trabajar la
 * interfaz. En `pnpm build` MODE es «production», así que src/mocks no entra al bundle.
 */
if (import.meta.env.MODE === 'mock') {
  void (async () => {
    const [{ createMockHub }, { createMockSource }, { SESION_DEMO }] = await Promise.all([
      import('./mocks/mockHub'),
      import('./mocks/mockSource'),
      import('./mocks/fixtures'),
    ]);
    mountApp(root, createMockHub(), createMockSource(), SESION_DEMO, () => location.reload());
  })();
} else {
  const sesion = (user: User): Sesion => ({ uid: user.uid, email: user.email ?? '' });

  // Sin sesión de Firebase solo se ve el registro / inicio de sesión.
  const entrar = (user: User) => {
    const hub = createHub();
    const actual = sesion(user);
    // Al salir se recarga la página: así no quedan la sesión del Host ni los listeners de la app.
    mountApp(root, hub, createRealSource(hub, actual), actual, () => void cerrarSesion().finally(() => location.reload()));
    void hub.start();
  };

  root.replaceChildren(loading('Revisando tu sesión…'));
  sesionGuardada()
    .then((user) => (user ? entrar(user) : root.replaceChildren(authPage(entrar))))
    .catch((error) => root.replaceChildren(
      h('p', { class: 'bad small', role: 'alert' }, `No se pudo revisar tu sesión: ${mensajeFirebase(error)}`),
      authPage(entrar),
    ));
}
