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

  // Normalizar propiedades
  const nombre = user.nombre || user.name || user.nameUser || '';
  const paterno = user.paterno || user.apellido_paterno || user.apellido || '';
  const materno = user.materno || user.apellido_materno || '';
  const correo = user.correo || user.email || user.username || '';

  // Género con limpieza
  const generoRaw = user.genero || user.Genero || user.gender;
  const genero = generoRaw && generoRaw.trim() ? generoRaw.trim() : '—';

  // Tipo de usuario
  const tipoRaw = user.tipo || user.tipo_usuario || user.role || user.userType || null;
  const tipo = tipoRaw === null ? null : Number(tipoRaw);
  const esAdmin = tipo === 2;

  // Iniciales
  const initials = (nombre[0] || '').toUpperCase() + (paterno[0] || '').toUpperCase();
  avatar.textContent = initials || 'U';

  userFullName.textContent = `${nombre} ${paterno} ${materno}`.trim() || 'Usuario';
  userEmail.textContent = correo;

  // Estilo visual para género
  let generoHTML = `<strong>Género:</strong> `;
  if (genero === 'Masculino') {
    generoHTML += `<span style="color:#007bff">Masculino ♂️</span>`;
  } else if (genero === 'Femenino') {
    generoHTML += `<span style="color:#e83e8c">Femenino ♀️</span>`;
  } else if (genero !== '—') {
    generoHTML += `<span style="color:#6f42c1">${genero} ⚧️</span>`;
  } else {
    generoHTML += `<span style="color:#999">—</span>`;
  }

  // Mostrar info
  infoText.innerHTML = `
    ${generoHTML} <br>
    <strong>Tipo:</strong> ${esAdmin ? 'Administrador' : 'Cliente'}
    ${esAdmin ? '<span class="admin-badge" aria-hidden="true">ADMIN</span>' : ''}
  `;

  // Mostrar área admin
  if (esAdmin) {
    adminArea.style.display = 'block';
    adminArea.setAttribute('aria-hidden', 'false');
  } else {
    adminArea.style.display = 'none';
    adminArea.setAttribute('aria-hidden', 'true');
  }

  // Botones
  btnEdit.addEventListener('click', () => {
    alert('Aquí iría la pantalla de edición de perfil.');
  });

  btnLogout.addEventListener('click', () => {
    sessionStorage.removeItem('user');
    window.location.href = 'login.html';
  });
});