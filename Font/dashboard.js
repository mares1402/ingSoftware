document.addEventListener('DOMContentLoaded', async () => {
  // Lee sesión
  const raw = sessionStorage.getItem('user');
  if (!raw) return forceLogout();

  let user;
  try {
    user = JSON.parse(raw);
  } catch (e) {
    console.error('user corrupto en sessionStorage', e);
    return forceLogout();
  }

  // Validaciones básicas que detectan manipulación del objeto user
  // Ajusta los campos según tu esquema real
  const hasRequiredFields = user && (user.id || user.userId) && (user.nombre || user.name) && (user.tipo !== undefined);
  if (!hasRequiredFields) return forceLogout();

  // Acepta tipo como número o string; normaliza
  const tipo = Number(user.tipo ?? user.tipo_usuario ?? -1);
  if (Number.isNaN(tipo)) return forceLogout();

  // Opcional: proteger rutas por rol. Ejemplo: páginas admin solo tipo === 2
  const path = window.location.pathname.split('/').pop().toLowerCase(); // p.e. "admin.html"
  const adminPaths = ['admin.html', 'manage.html']; // adapta según tus archivos
  if (adminPaths.includes(path) && tipo !== 2) return forceLogout();

  // Opcional y recomendado: validar el token en backend para detectar manipulación remota
  // Si guardas un token en sessionStorage (p.e. user.token), valida con el servidor:
  if (user.token) {
    try {
      const res = await fetch('/api/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({ check: true })
      });
      if (!res.ok) return forceLogout();
      const body = await res.json();
      if (!body.valid) return forceLogout();
    } catch (err) {
      console.error('Error validando token', err);
      return forceLogout();
    }
  }

  // Si llegaste aquí, la sesión parece válida: continúa cargando la UI normalmente

  // Función que borra sesión y redirige al index/login
  function forceLogout() {
    sessionStorage.removeItem('user');
    localStorage.removeItem('user'); // si usas localStorage en algún lado
    // opcional: borrar cookies de sesión (si las usas)
    // document.cookie = 'session=; Max-Age=0; path=/;';

    // redirige a la página pública (index o login)
    window.location.replace('index.html'); // replace evita dejar historial para "ir atrás"
  }

  // Adicional: detectar cambios de URL por manipulación de hash / history
  // y volver a validar si la ruta cambia
  window.addEventListener('popstate', () => { /* podrías volver a ejecutar validaciones */ });
  window.addEventListener('hashchange', () => { /* idem */ });
});

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