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
        document.getElementById('errorMsg').textContent = "Usuario no registrado.";
      } else if (result.caso === 2) {
        document.getElementById('errorMsg').textContent = "Contraseña incorrecta.";
      } else {
        document.getElementById('errorMsg').textContent = result.mensaje || "Error desconocido.";
      }
      return;
    }

    window.location.href = '/dashboard';

    // Guardar info del usuario en sessionStorage
    sessionStorage.setItem('user', JSON.stringify(result.user));

  } catch (error) {
    console.error(error);
    document.getElementById('errorMsg').textContent = "Error de conexión con el servidor.";
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