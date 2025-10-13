document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica para verificar la sesión de usuario ---
    const userActionsContainer = document.querySelector('.user-actions');
    fetch('/me')
        .then(response => {
            // No solo checamos si la respuesta es OK, sino que también debe ser JSON.
            if (!response.ok) {
                // Si la respuesta es 401, 403, 500, etc., lanzamos un error para ir al .catch
                return Promise.reject('No autenticado o error del servidor');
            }
            return response.json(); // Intentamos convertir la respuesta a JSON
        })
        .then(data => {
            // Si la conversión a JSON fue exitosa y el objeto 'user' existe...
            if (data && data.user) {
                userActionsContainer.innerHTML = `<a href="/dashboard" class="login-link"><i class="fa-solid fa-user"></i> Mi Perfil</a>`;
            }
        })
        .catch(error => console.error('Error al verificar la sesión de usuario:', error));
});