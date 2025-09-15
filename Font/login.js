document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita recargar la página

    const form = e.target;
    const data = {
        usuario: form.usuario.value,
        contrasena: form.contrasena.value
    };

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            
            if (result.caso === 1) {
                document.getElementById('errorMsg').textContent = "Correo no registrado o credenciales incorrectas.";
            } else if (result.caso === 2) {
                document.getElementById('errorMsg').textContent = "Contraseña incorrecta.";
            } else {
                document.getElementById('errorMsg').textContent = "Error desconocido.";
            }
            return;
        }

        // Si login exitoso
        document.getElementById('errorMsg').style.color = "green";
        document.getElementById('errorMsg').textContent = "Login exitoso, redirigiendo...";

        
        setTimeout(() => {
            window.location.href = "dashboard.html"; 
        }, 1500);

    } catch (error) {
        console.error(error);
        document.getElementById('errorMsg').textContent = "Error de conexión con el servidor.";
    }
});