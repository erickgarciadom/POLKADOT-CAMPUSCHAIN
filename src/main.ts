import './styles.css';
import type { User } from 'firebase/auth';
import { cerrarSesion, mensajeFirebase, sesionGuardada } from './firebase/auth';
import { createHub } from './hub/hub';
import { mountApp } from './ui/app';
import { h } from './ui/dom';
import { authPage } from './ui/pages/auth';
import { loading } from './ui/parts';

const root = document.getElementById('app')!;

// Sin sesión de Firebase solo se ve el registro / inicio de sesión.
const entrar = (user: User) => {
  const hub = createHub();
  // Al salir se recarga la página: así no quedan la sesión del Host ni los listeners de la app.
  mountApp(root, hub, user, () => void cerrarSesion().finally(() => location.reload()));
  void hub.start();
};

root.replaceChildren(loading('Revisando tu sesión…'));
sesionGuardada()
  .then((user) => (user ? entrar(user) : root.replaceChildren(authPage(entrar))))
  .catch((error) => root.replaceChildren(
    h('p', { class: 'bad small', role: 'alert' }, `No se pudo revisar tu sesión: ${mensajeFirebase(error)}`),
    authPage(entrar),
  ));
