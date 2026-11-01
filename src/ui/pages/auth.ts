import type { User } from 'firebase/auth';
import { iniciarSesion, registrar } from '../../firebase/auth';
import { DOMINIO_UANL, MIN_PASSWORD, validarCredenciales } from '../../firebase/registro';
import { h, replace } from '../dom';

type Modo = 'entrar' | 'registro';

/** Registro e inicio de sesión. Llama a `listo` con el usuario cuando entra. */
export function authPage(listo: (user: User) => void): HTMLElement {
  let modo: Modo = 'entrar';
  const root = h('div', { class: 'auth' });

  const draw = () => {
    const error = h('p', { class: 'bad small', role: 'alert' });
    const correo = h('input', { class: 'input', type: 'email', autocomplete: 'email', required: true, placeholder: `nombre${DOMINIO_UANL}` });
    const password = h('input', {
      class: 'input',
      type: 'password',
      required: true,
      minlength: MIN_PASSWORD,
      autocomplete: modo === 'registro' ? 'new-password' : 'current-password',
    });
    const boton = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, modo === 'registro' ? 'Crear cuenta' : 'Entrar');

    const submit = async (e: Event) => {
      e.preventDefault();
      error.textContent = '';
      const motivo = validarCredenciales(correo.value, password.value);
      if (motivo) return void (error.textContent = motivo);
      boton.disabled = true;
      boton.textContent = modo === 'registro' ? 'Creando cuenta…' : 'Entrando…';
      try {
        listo(await (modo === 'registro' ? registrar : iniciarSesion)(correo.value, password.value));
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : String(err);
        boton.disabled = false;
        boton.textContent = modo === 'registro' ? 'Crear cuenta' : 'Entrar';
      }
    };

    const pestana = (m: Modo, texto: string) =>
      h('button', { class: `btn${modo === m ? ' btn-primary' : ''}`, type: 'button', onclick: () => { modo = m; draw(); } }, texto);

    replace(root,
      h('div', { class: 'brand' }, h('span', { class: 'logo', 'aria-hidden': 'true' }, '✓'), 'CampusChain'),
      h('div', { class: 'card' },
        h('div', { class: 'auth-tabs' }, pestana('entrar', 'Iniciar sesión'), pestana('registro', 'Registrarme')),
        h('form', { class: 'form', onsubmit: submit },
          h('label', { class: 'field' }, h('span', null, 'Correo institucional'), correo),
          h('label', { class: 'field' }, h('span', null, 'Contraseña'), password,
            modo === 'registro' ? h('span', { class: 'muted small' }, `Al menos ${MIN_PASSWORD} caracteres.`) : null),
          error,
          boton,
        ),
        h('p', { class: 'muted small' }, `Solo se aceptan correos que terminan en ${DOMINIO_UANL}.`),
      ),
    );
  };

  draw();
  return root;
}
