document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/me', { credentials: 'same-origin' });
    if (!res.ok) {
      // no autenticado -> redirigir al login
      window.location.href = '/login.html';
      return;
    }
    const payload = await res.json();
    const user = payload.user;

    // Normalizar propiedades como ya tenías
    const nombre = user.nombre || user.name || '';
    const paterno = user.paterno || user.apellido_paterno || '';
    const materno = user.materno || user.apellido_materno || '';
    const correo = user.correo || user.email || '';

    const generoRaw = user.genero || user.Genero || user.gender;
    const genero = generoRaw && generoRaw.trim() ? generoRaw.trim() : '—';

    const tipo = user.tipo_usuario ? Number(user.tipo_usuario) : null;
    const esAdmin = tipo === 2;

    // UI (usa tus ids)
    const avatar = document.getElementById('avatar');
    const userFullName = document.getElementById('userFullName');
    const userEmail = document.getElementById('userEmail');
    const infoText = document.getElementById('infoText');
    const adminArea = document.getElementById('adminArea');
    const btnLogout = document.getElementById('btnLogout');
    const btnEdit = document.getElementById('btnEdit');

    const initials = (nombre[0] || '').toUpperCase() + (paterno[0] || '').toUpperCase();
    avatar.textContent = initials || 'U';

    userFullName.textContent = `${nombre} ${paterno} ${materno}`.trim() || 'Usuario';
    userEmail.textContent = correo;

    let generoHTML = `<strong>Género:</strong> `;
    if (genero === 'Masculino') generoHTML += `<span style="color:#007bff">Masculino ♂️</span>`;
    else if (genero === 'Femenino') generoHTML += `<span style="color:#e83e8c">Femenino ♀️</span>`;
    else if (genero !== '—') generoHTML += `<span style="color:#6f42c1">${genero} ⚧️</span>`;
    else generoHTML += `<span style="color:#999">—</span>`;

    infoText.innerHTML = `${generoHTML} <br><strong>Tipo:</strong> ${esAdmin ? 'Administrador' : 'Cliente'} ${esAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}`;

    if (esAdmin) {
      adminArea.style.display = 'block';
      adminArea.setAttribute('aria-hidden', 'false');
    } else {
      adminArea.style.display = 'none';
      adminArea.setAttribute('aria-hidden', 'true');
    }

    btnEdit.addEventListener('click', () => {
      alert('Aquí iría la pantalla de edición de perfil.');
    });

    btnLogout.addEventListener('click', async () => {
      await fetch('/logout', { method: 'POST' });
      window.location.href = '/login.html';
    });

  } catch (err) {
    console.error('Error al cargar datos de usuario:', err);
    window.location.href = '/login.html';
  }
});