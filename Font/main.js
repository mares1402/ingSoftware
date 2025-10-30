document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica para verificar la sesión de usuario ---
    const userActionsContainer = document.querySelector('.user-actions');
    fetch('/me', { credentials: 'same-origin' }) // ✅ importante para enviar la cookie
        .then(response => {
            if (!response.ok) {
                return Promise.reject('No autenticado o error del servidor');
            }
            return response.json();
        })
        .then(data => {
            if (data && data.user) {
                userActionsContainer.innerHTML = `<a href="/dashboard" class="login-link"><i class="fa-solid fa-user"></i> Mi Perfil</a>`;
            }
        })
        .catch(error => console.error('Error al verificar la sesión de usuario:', error));
});