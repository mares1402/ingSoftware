document.addEventListener('DOMContentLoaded', () => {
  // Intentamos leer el usuario almacenado en sessionStorage
  const raw = sessionStorage.getItem('user');
  if (!raw) {
    // No hay sesión -> redirigir al login
    window.location.href = 'login.html';
    return;
  }

  let user;
  try {
    user = JSON.parse(raw);
  } catch (e) {
    console.error('Error parseando user en sessionStorage', e);
    sessionStorage.removeItem('user');
    window.location.href = 'login.html';
    return;
  }

  // Rellenar la UI
  const avatar = document.getElementById('avatar');
  const userFullName = document.getElementById('userFullName');
  const userEmail = document.getElementById('userEmail');
  const infoText = document.getElementById('infoText');
  const adminArea = document.getElementById('adminArea');
  const btnLogout = document.getElementById('btnLogout');
  const btnEdit = document.getElementById('btnEdit');

  // Usamos nombre + paterno para mostrar el avatar (iniciales)
  const initials = ((user.nombre || '')[0] || '').toUpperCase() + ((user.paterno || '')[0] || '').toUpperCase();
  avatar.textContent = initials || 'U';

  userFullName.textContent = `${user.nombre || ''} ${user.paterno || ''} ${user.materno || ''}`.trim() || 'Usuario';
  userEmail.textContent = user.correo || '';

  infoText.innerHTML = `
    <strong>Género:</strong> ${user.genero || '—'} <br>
    <strong>Tipo:</strong> ${user.tipo === 2 ? 'Administrador' : 'Cliente'}
    ${user.tipo === 2 ? '<span class="admin-badge">ADMIN</span>' : ''}
  `;

  // Mostrar área admin si tipo == 2
  if (user.tipo === 2 || user.tipo_usuario === 2) {
    adminArea.style.display = 'block';
  }

  // Edit profile (puedes enlazar a formulario real)
  btnEdit.addEventListener('click', () => {
    alert('Aquí iría la pantalla de edición de perfil (aún no implementada).');
  });

  // Logout: limpiar sessionStorage y volver al login
  btnLogout.addEventListener('click', () => {
    sessionStorage.removeItem('user');
    window.location.href = 'login.html';
  });
});