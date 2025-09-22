// script para manejar la visibilidad de las etiquetas en los campos del formulario
document.querySelectorAll('.campo input, .campo select').forEach(elemento => {
    const label = elemento.parentElement.querySelector('label');

    const actualizarLabel = () => {
        if (elemento.value.trim() !== '') {
            label.classList.add('label-oculto');
        } else {
            label.classList.remove('label-oculto');
        }
    };

    actualizarLabel();
    elemento.addEventListener('input', actualizarLabel);
    elemento.addEventListener('change', actualizarLabel);
});

// Validar entrada en tiempo real para el campo de teléfono
const campoTelefono = document.querySelector('input[name="telefono"]');
campoTelefono.addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, ''); // Elimina todo lo que no sea dígito
});

document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;

    // Validar contraseñas antes de enviar
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

        const result = await response.text(); // el backend devuelve texto en /signup

        if (!response.ok) {
            document.getElementById('signupMsg').style.color = "red";
            document.getElementById('signupMsg').textContent = result;
            return;
        }

        // Registro exitoso
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