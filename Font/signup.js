// Etiqueta flotante para el combo Género (sube al abrir y no baja)
document.querySelectorAll('.campo select').forEach(elemento => {
  const label = elemento.parentElement.querySelector('label');

  const activarLabel = () => {
    label.classList.add('label-activa');
  };

  const actualizarLabel = () => {
    if (elemento.value.trim() !== '') {
      label.classList.add('label-activa');
    }
  };

  elemento.addEventListener('focus', activarLabel);
  elemento.addEventListener('change', actualizarLabel);
  actualizarLabel();
});

// Validar entrada en tiempo real para el campo de teléfono
const campoTelefono = document.querySelector('#telefono');
campoTelefono.addEventListener('input', function () {
  this.value = this.value.replace(/\D/g, '');
});

// Validar entrada en tiempo real para nombre y apellidos
const soloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]*$/;
['name', 'apellido_paterno', 'apellido_materno'].forEach(campo => {
  const input = document.querySelector(`input[name="${campo}"]`);
  input.addEventListener('input', function () {
    if (!soloLetras.test(this.value)) {
      this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
    }
  });
});

// Validar entrada en tiempo real para la contraseña (mínimo 8, máximo 20 caracteres)
const campoPassword = document.querySelector('input[name="password"]');
const idioma = navigator.language.startsWith('es') ? 'es' : 'en';

campoPassword.addEventListener('input', function () {
  const longitud = this.value.length;

  if (longitud < 8) {
    this.setCustomValidity(
      idioma === 'es'
        ? 'Ocupas mínimo 8 caracteres.'
        : 'You need at least 8 characters.'
    );
  } else if (longitud > 20) {
    this.setCustomValidity(
      idioma === 'es'
        ? 'No debe exceder 20 caracteres.'
        : 'Must not exceed 20 characters.'
    );
  } else {
    this.setCustomValidity('');
  }

  this.reportValidity();
});

// Mostrar/ocultar contraseña
document.querySelectorAll('.toggle-password').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const campo = toggle.closest('.campo');
    const input = campo.querySelector('input');
    const icon = toggle.querySelector('i');

    if (input.type === 'password') {
      input.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      input.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  });
});

/**
 * Muestra una notificación flotante (toast) en la esquina superior derecha.
 * @param {string} mensaje El texto que se mostrará en la notificación.
 * @param {string} [tipo='error'] El tipo de notificación ('error' o 'exito').
 */
function mostrarNotificacion(mensaje, tipo = 'error') {
  const notificacion = document.createElement('div');
  notificacion.textContent = mensaje;
  notificacion.style.position = 'fixed';
  notificacion.style.top = '20px';
  notificacion.style.right = '20px';
  notificacion.style.padding = '15px 20px';
  notificacion.style.borderRadius = '8px';
  notificacion.style.color = 'white';
  notificacion.style.fontFamily = 'Arial, sans-serif';
  notificacion.style.zIndex = '1000';
  notificacion.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
  notificacion.style.opacity = '0';
  notificacion.style.transition = 'opacity 0.5s, transform 0.5s';
  notificacion.style.transform = 'translateX(100%)';
  notificacion.style.backgroundColor = tipo === 'error' ? '#dc3545' : '#28a745';
  document.body.appendChild(notificacion);
  setTimeout(() => { notificacion.style.opacity = '1'; notificacion.style.transform = 'translateX(0)'; }, 10);
  setTimeout(() => {
    notificacion.style.opacity = '0';
    notificacion.style.transform = 'translateX(100%)';
    notificacion.addEventListener('transitionend', () => notificacion.remove());
  }, 4000);
}

// Enviar formulario de registro
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const form = e.target;

  if (form.password.value !== form.confirm_password.value) {
    mostrarNotificacion("Las contraseñas no coinciden.");
    return;
  }

  const data = {
    name: form.name.value,
    apellido_paterno: form.apellido_paterno.value,
    apellido_materno: form.apellido_materno.value,
    email: form.email.value,
    password: form.password.value,
    Genero: form.Genero.value,
    telefono: form.telefono.value
  };

  try {
    const response = await fetch('/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.text();

    if (!response.ok) {
      mostrarNotificacion(result);
      return;
    }

    mostrarNotificacion("Registro exitoso. Redirigiendo a login...", "exito");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);

  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error de conexión con el servidor.");
  }
});