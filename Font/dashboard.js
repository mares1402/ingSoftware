document.addEventListener('DOMContentLoaded', async () => {
  // FORZAR RECARGA SI SE VUELVE CON EL BOTÓN "ATRÁS" DESPUÉS DE CERRAR SESIÓN
  // Esto previene que el navegador muestre una versión en caché de la página.
  window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
      window.location.reload();
    }
  });

  try {
    const res = await fetch('/me', { credentials: 'same-origin' });
    if (!res.ok) {
      // no autenticado -> redirigir al login
      window.location.href = '/Font/login.html';
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

      const openModal = (templateId, title) => {
        modal.hidden = false;
        document.body.style.overflow = 'hidden'; // Evita scroll de fondo
        modalTitle.textContent = title;

        const template = document.getElementById(templateId);
        if (template) {
          modalBody.innerHTML = template.innerHTML;
        } else {
          modalBody.innerHTML = '<p>Error: No se encontró la plantilla del panel.</p>';
          console.error(`No se encontró el template con id: ${templateId}`);
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
          const templateId = button.dataset.template;
          const panelTitle = button.dataset.panelTitle;
          if (templateId && panelTitle) {
            openModal(templateId, panelTitle);
          }
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
      window.location.href = '/'; // Redirigir a la página de inicio (index.html)
    });

    btnHome.addEventListener('click', () => {
      window.location.href = '/';
    });

  } catch (err) {
    console.error('Error al cargar datos de usuario:', err);
    window.location.href = '/Font/login.html';
  }
});