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
            // Mostramos mensaje según el caso
            if (result.caso === 1) {
                document.getElementById('errorMsg').textContent = "Usuario no registrado.";
            } else if (result.caso === 2) {
                document.getElementById('errorMsg').textContent = "Contraseña incorrecta.";
            } else {
                document.getElementById('errorMsg').textContent = result.mensaje || "Error desconocido.";
            }
            return;
        }

        // Guardamos info del usuario
        sessionStorage.setItem('user', JSON.stringify(result.user));

        // Redirección según tipo_usuario
        if (result.user.tipo_usuario === 2) {
            window.location.href = "admin-dashboard.html";
        } else {
            window.location.href = "dashboard.html";
        }

    } catch (error) {
        console.error(error);
        document.getElementById('errorMsg').textContent = "Error de conexión con el servidor.";
    }
});