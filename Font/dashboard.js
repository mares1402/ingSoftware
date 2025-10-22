document.addEventListener('DOMContentLoaded', async () => {
  // Evitar cache al usar botón "Atrás"
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });

  try {
    // Obtener datos del usuario
    const res = await fetch('/me', { credentials: 'same-origin' });
    if (!res.ok) return window.location.href = '/Font/login.html';

    const { user } = await res.json();
    const nombre = user.nombre || '';
    const paterno = user.paterno || '';
    const materno = user.materno || '';
    const correo = user.correo || '';
    const genero = (user.genero || '').trim() || '—';
    const tipo = Number(user.tipo_usuario || 1);
    const esAdmin = tipo === 2;

    // Actualizar UI
    const avatar = document.getElementById('avatar');
    avatar.textContent = (nombre[0] || '').toUpperCase() + (paterno[0] || '').toUpperCase() || 'U';

    document.getElementById('userFullName').textContent = `${nombre} ${paterno} ${materno}`.trim() || 'Usuario';
    document.getElementById('userEmail').textContent = correo;

    let generoHTML = `<strong>Género:</strong> `;
    if (genero === 'Masculino') generoHTML += `<span style="color:#007bff">Masculino ♂️</span>`;
    else if (genero === 'Femenino') generoHTML += `<span style="color:#e83e8c">Femenino ♀️</span>`;
    else generoHTML += `<span style="color:#6f42c1">${genero} ⚧️</span>`;

    document.getElementById('infoText').innerHTML =
      `${generoHTML} <br><strong>Tipo:</strong> ${esAdmin ? 'Administrador' : 'Cliente'} ${esAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}`;

    // Panel de administración
    const adminArea = document.getElementById('adminArea');
    if (esAdmin) adminArea.style.display = 'block';
    else adminArea.style.display = 'none';

    // Modal
    const modal = document.getElementById('adminModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modalOverlay = document.getElementById('modalOverlay');

    const closeModal = () => {
      modal.hidden = true;
      document.body.style.overflow = '';
      modalBody.innerHTML = '<p>Cargando...</p>';
    };

    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);

    // Función general para cargar paneles
    const openPanel = async (archivo, title) => {
      modal.hidden = false;
      document.body.style.overflow = 'hidden';
      modalTitle.textContent = title;

      try {
        const resp = await fetch(`/api/admin/panel/${archivo}`, { credentials: 'same-origin' });
        if (!resp.ok) throw new Error('No se pudo cargar el archivo HTML');
        modalBody.innerHTML = await resp.text();

        // Cargar datos según panel
        if (archivo === 'admin-users.html') loadUsuarios();
        if (archivo === 'admin-products.html') loadProductos();
        if (archivo === 'admin-suppliers.html') loadProveedores();
      } catch (err) {
        modalBody.innerHTML = `<p>Error cargando panel: ${err.message}</p>`;
        console.error(err);
      }
    };

    // --- Carga de datos dinámicos ---
    async function loadUsuarios() {
      try {
        const res = await fetch('/api/admin/usuarios', { credentials: 'same-origin' });
        const usuarios = await res.json();

        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        usuarios.forEach(u => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${u.id_usuario}</td>
            <td>${u.nombre}</td>
            <td>${u.paterno}</td>
            <td>${u.materno}</td>
            <td>${u.correo}</td>
            <td>${u.telefono}</td>
            <td>${u.genero}</td>
            <td>${u.tipo_usuario === 2 ? 'Administrador' : 'Cliente'}</td>
            <td>
              <button class="btn-edit-user" data-id="${u.id_usuario}"><i class="fa-solid fa-pen"></i></button>
              <button class="btn-delete-user" data-id="${u.id_usuario}"><i class="fa-solid fa-trash"></i></button>
            </td>
          `;
          tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-delete-user').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            if (confirm('¿Eliminar usuario?')) {
              await fetch(`/usuarios/${id}`, { method: 'DELETE' });
              loadUsuarios();
            }
          });
        });

        document.querySelectorAll('.btn-edit-user').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            alert('Aquí abrirías el formulario de edición para ID ' + id);
          });
        });
      } catch (err) {
        console.error(err);
        alert('Error cargando usuarios: ' + err.message);
      }
    }

    async function loadProductos() {
      try {
        const res = await fetch('/api/admin/productos', { credentials: 'same-origin' });
        const productos = await res.json();

        const tbody = document.querySelector('#productsTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        productos.forEach(p => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${p.id_producto}</td>
            <td>${p.nombre_producto}</td>
            <td>${p.categoria}</td>
          `;
          tbody.appendChild(tr);
        });
      } catch (err) {
        console.error(err);
        alert('Error cargando productos: ' + err.message);
      }
    }

    async function loadProveedores() {
      try {
        const res = await fetch('/api/admin/proveedores', { credentials: 'same-origin' });
        const proveedores = await res.json();

        const tbody = document.querySelector('#suppliersTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        proveedores.forEach(p => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${p.id_proveedor}</td>
            <td>${p.nombre_proveedor}</td>
            <td>${p.telefono}</td>
            <td>${p.correo}</td>
            <td>${p.direccion}</td>
          `;
          tbody.appendChild(tr);
        });
      } catch (err) {
        console.error(err);
        alert('Error cargando proveedores: ' + err.message);
      }
    }

    // Botones de paneles
    document.querySelectorAll('.btn-admin').forEach(btn => {
      btn.addEventListener('click', () => {
        const archivo = btn.dataset.file;
        const title = btn.dataset.panelTitle;
        if (archivo && title) openPanel(archivo, title);
      });
    });

    // Botones generales
    document.getElementById('btnEdit').addEventListener('click', () => {
      alert('Aquí iría la edición de perfil.');
    });

    document.getElementById('btnLogout').addEventListener('click', async () => {
      await fetch('/logout', { method: 'POST' });
      window.location.href = '/';
    });

    document.getElementById('btnHome').addEventListener('click', () => {
      window.location.href = '/';
    });

  } catch (err) {
    console.error('Error al cargar datos de usuario:', err);
    window.location.href = '/Font/login.html';
  }
});
