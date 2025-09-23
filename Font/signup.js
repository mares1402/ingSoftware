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

campoPassword.addEventListener('input', function () {
  const longitud = this.value.length;

  if (longitud < 8) {
    this.setCustomValidity('minlength');
  } else if (longitud > 20) {
    this.setCustomValidity('maxlength');
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

// Enviar formulario de registro
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const form = e.target;

  if (form.password.value !== form.confirm_password.value) {
    document.getElementById('signupMsg').style.color = "red";
    document.getElementById('signupMsg').textContent = "Las contraseñas no coinciden.";
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
      document.getElementById('signupMsg').style.color = "red";
      document.getElementById('signupMsg').textContent = result;
      return;
    }

    document.getElementById('signupMsg').style.color = "green";
    document.getElementById('signupMsg').textContent = "Registro exitoso. Redirigiendo a login...";

    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);

  } catch (error) {
    console.error(error);
    document.getElementById('signupMsg').style.color = "red";
    document.getElementById('signupMsg').textContent = "Error de conexión con el servidor.";
  }
});