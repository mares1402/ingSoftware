document.addEventListener('DOMContentLoaded', () => {
  const raw = sessionStorage.getItem('user');
  if (!raw) {
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

  const avatar = document.getElementById('avatar');
  const userFullName = document.getElementById('userFullName');
  const userEmail = document.getElementById('userEmail');
  const infoText = document.getElementById('infoText');
  const adminArea = document.getElementById('adminArea');
  const btnLogout = document.getElementById('btnLogout');
  const btnEdit = document.getElementById('btnEdit');

  // Normalizar propiedades que puedan venir con nombres distintos
  const nombre = user.nombre || user.name || user.nameUser || '';
  const paterno = user.paterno || user.apellido_paterno || user.apellido || '';
  const materno = user.materno || user.apellido_materno || '';
  const correo = user.correo || user.email || user.username || '';
  const genero = user.genero || user.Genero || user.gender || '—';

  // Determinar tipo numérico robustamente (acepta string o número)
  const tipoRaw = user.tipo ?? user.tipo_usuario ?? user.role ?? user.userType ?? null;
  const tipo = tipoRaw === null ? null : Number(tipoRaw);

  // Iniciales y UI básica
  const initials = (nombre[0] || '').toUpperCase() + (paterno[0] || '').toUpperCase();
  avatar.textContent = initials || 'U';

  userFullName.textContent = `${nombre} ${paterno} ${materno}`.trim() || 'Usuario';
  userEmail.textContent = correo;

  // Mostrar tipo y badge cuando tipo === 2 (Administrador)
  const esAdmin = tipo === 2;
  infoText.innerHTML = `
    <strong>Género:</strong> ${genero} <br>
    <strong>Tipo:</strong> ${esAdmin ? 'Administrador' : 'Cliente'}
    ${esAdmin ? '<span class="admin-badge" aria-hidden="true">ADMIN</span>' : ''}
  `;

  // Mostrar/ocultar área de administración
  if (esAdmin) {
    adminArea.style.display = 'block';
    adminArea.setAttribute('aria-hidden', 'false');
  } else {
    adminArea.style.display = 'none';
    adminArea.setAttribute('aria-hidden', 'true');
  }

  // Botones
  btnEdit.addEventListener('click', () => {
    // Reemplaza con la navegación o lógica de edición real
    alert('Aquí iría la pantalla de edición de perfil.');
  });

  btnLogout.addEventListener('click', () => {
    sessionStorage.removeItem('user');
    window.location.href = 'login.html';
  });
});