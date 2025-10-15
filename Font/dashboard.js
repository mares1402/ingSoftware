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
    const btnHome = document.getElementById('btnHome');

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

      // --- Lógica para el Modal de Administración ---
      const adminButtons = document.querySelectorAll('.btn-admin');
      const modal = document.getElementById('adminModal');
      const modalTitle = document.getElementById('modalTitle');
      const modalBody = document.getElementById('modalBody');
      const closeModalBtn = document.getElementById('closeModalBtn');
      const modalOverlay = document.getElementById('modalOverlay');

      const openModal = async (panelName, title) => {
        modal.hidden = false;
        document.body.style.overflow = 'hidden'; // Evita scroll de fondo
        modalTitle.textContent = title;
        modalBody.innerHTML = '<p>Cargando...</p>';

        try {
          const response = await fetch(`/admin/partials/${panelName}.html`);
          // Verificar si la petición fue exitosa (ej. no fue un 404)
          if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
          }

          modalBody.innerHTML = await response.text();
        } catch (error) {
          modalBody.innerHTML = '<p>Error al cargar el contenido.</p>';
          console.error('Error fetching partial:', error);
        }
      };

      const closeModal = () => {
        modal.hidden = true;
        document.body.style.overflow = ''; // Restaura scroll
      };

      closeModalBtn.addEventListener('click', closeModal);
      modalOverlay.addEventListener('click', closeModal);

      adminButtons.forEach(button => {
        button.addEventListener('click', () => {
          const panelMap = {
            btnAdminUsers: { file: 'admin-users', title: 'Gestión de Usuarios' },
            btnAdminProducts: { file: 'admin-products', title: 'Gestión de Productos' },
            btnAdminSuppliers: { file: 'admin-suppliers', title: 'Gestión de Proveedores' }
          };
          const panelInfo = panelMap[button.id];
          if (panelInfo) openModal(panelInfo.file, panelInfo.title);
        });
      });
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

    btnHome.addEventListener('click', () => {
      window.location.href = '/';
    });

  } catch (err) {
    console.error('Error al cargar datos de usuario:', err);
    window.location.href = '/login.html';
  }
});