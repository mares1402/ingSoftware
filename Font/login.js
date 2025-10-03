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

// Enviar formulario de login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const form = e.target;
  const data = {
    usuario: form.usuario.value,
    password: form.password.value
  };

  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      // Mostrar mensaje de error según el caso
      if (result.caso === 1) {
        mostrarNotificacion("Usuario no registrado.");
      } else if (result.caso === 2) {
        mostrarNotificacion("Contraseña incorrecta.");
      } else {
        mostrarNotificacion(result.mensaje || "Error desconocido.");
      }
      return;
    }

    window.location.href = '/dashboard';

    // Guardar info del usuario en sessionStorage
    sessionStorage.setItem('user', JSON.stringify(result.user));

  } catch (error) {
    console.error(error);
    mostrarNotificacion("Error de conexión con el servidor.");
  }
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