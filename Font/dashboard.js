document.addEventListener('DOMContentLoaded', async () => {
  // Evitar cache al usar "Atrás"
  window.addEventListener('pageshow', e => { if (e.persisted) window.location.reload(); });

  try {
    // --- Obtener datos del usuario ---
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

    // --- Actualizar UI ---
    document.getElementById('avatar').textContent =
      (nombre[0] || '').toUpperCase() + (paterno[0] || '').toUpperCase() || 'U';
    document.getElementById('userFullName').textContent = `${nombre} ${paterno} ${materno}`.trim() || 'Usuario';
    document.getElementById('userEmail').textContent = correo;

    // --- Lógica del Dashboard ---
    const userContent = document.getElementById('user-content');
    const adminControls = document.getElementById('admin-controls');
    const adminActions = document.querySelector('.admin-actions');
    const adminContentArea = document.getElementById('admin-content-area');
    const modalContainer = document.getElementById('modal-container');

    // Contenido para usuario normal
    let generoHTML = `<strong>Género:</strong> `;
    if (genero === 'Masculino') generoHTML += `<span style="color:#007bff">Masculino ♂️</span>`;
    else if (genero === 'Femenino') generoHTML += `<span style="color:#e83e8c">Femenino ♀️</span>`;
    else generoHTML += `<span style="color:#6f42c1">${genero} ⚧️</span>`;

    userContent.innerHTML = `<p>${generoHTML}</p>`;

    // Función para mostrar un panel de admin
    const showAdminPanel = async (panelName, button) => {
      document.querySelectorAll('.btn-admin.active').forEach(btn => btn.classList.remove('active'));
      if (button) button.classList.add('active');
      
      adminContentArea.innerHTML = '<p>Cargando...</p>';
      try {
        const resp = await fetch(`/api/admin/panel/${panelName}`, { credentials: 'same-origin' });
        if (!resp.ok) throw new Error(`No se pudo cargar el panel ${panelName}`);
        adminContentArea.innerHTML = `<div class="admin-panel">${await resp.text()}</div>`;
        
        // Cargar datos y modales correspondientes
        if (panelName === 'admin-users.html') {
          await loadModal('modal-editar-usuario.html');
          loadUsuarios();
        }
        if (panelName === 'admin-products.html') {
          await loadModal('modal-editar-producto.html');
          loadProductos();
        }
        if (panelName === 'admin-suppliers.html') {
          await loadModal('modal-editar-proveedor.html');
          await loadModal('modal-agregar-proveedor.html');
          loadProveedores();
        }
      } catch (err) {
        adminContentArea.innerHTML = `<p>Error cargando el panel: ${err.message}</p>`;
        console.error(err);
      }
    };

    // Función para cargar un modal HTML en el contenedor
    const loadModal = async (modalFile) => {
      const resp = await fetch(`/api/admin/panel/${modalFile}`, { credentials: 'same-origin' });
      if (resp.ok) {
        const modalHtml = await resp.text();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = modalHtml;
        const modalElement = tempDiv.firstChild;
        if (modalElement && !document.getElementById(modalElement.id)) {
          modalContainer.appendChild(modalElement);
          // Añadir listeners para cerrar el modal
          modalElement.querySelector('.modal-close-btn, .modal-overlay')?.addEventListener('click', () => {
            modalElement.style.display = 'none';
          });
        }
      }
    };

    if (esAdmin) {
      adminControls.style.display = 'block';
      userContent.innerHTML += `<p><strong>Tipo:</strong> Administrador <span class="admin-badge">ADMIN</span></p>`;

      const adminPanels = [
        { file: 'admin-users.html', title: 'Usuarios', icon: 'fa-users' },
        { file: 'admin-products.html', title: 'Productos', icon: 'fa-box-archive' },
        { file: 'admin-suppliers.html', title: 'Proveedores', icon: 'fa-dolly' }
      ];

      adminPanels.forEach(panel => {
        const button = document.createElement('button');
        button.className = 'btn-admin';
        button.innerHTML = `<i class="fa-solid ${panel.icon}"></i> ${panel.title}`;
        button.onclick = () => showAdminPanel(panel.file, button);
        adminActions.appendChild(button);
      });

      // Mostrar el primer panel por defecto
      if (adminActions.firstChild) adminActions.firstChild.click();
    }

    async function cargarCategoriasSelect() {
      const resp = await fetch('/api/admin/categorias');
      const categorias = await resp.json();
      const select = document.getElementById('edit-producto-categoria');
      select.innerHTML = '';
      categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id_categoria;
        option.textContent = cat.nombre_categoria;
        select.appendChild(option);
      });
    }

    // --- Función para cargar usuarios ---
    async function loadUsuarios() {
      try {
        const res = await fetch('/api/admin/usuarios', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('No se pudieron obtener los usuarios');
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
            <td>${u.materno || '-'}</td>
            <td>${u.correo}</td>
            <td>${u.telefono || '-'}</td>
            <td>${u.genero || '-'}</td>
            <td>${u.tipo_usuario === 2 ? 'Administrador' : 'Cliente'}</td>
            <td>
              <button class="btn-edit-user" data-id="${u.id_usuario}"><i class="fa-solid fa-pen"></i></button>
              <button class="btn-delete-user" data-id="${u.id_usuario}"><i class="fa-solid fa-trash"></i></button>
            </td>
          `;
          tbody.appendChild(tr);
        });

        // Abrir modal de edición
        tbody.querySelectorAll('.btn-edit-user').forEach(btn => {
          btn.addEventListener('click', () => openEditUserModal(btn.dataset.id));
        });

        // Eliminar usuario
        tbody.querySelectorAll('.btn-delete-user').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (confirm('¿Seguro que deseas eliminar este usuario?')) {
              try {
                const res = await fetch(`/api/admin/usuarios/${btn.dataset.id}`, { 
                  method: 'DELETE', 
                  credentials: 'same-origin' 
                });
                if (!res.ok) throw new Error('No se pudo eliminar el usuario');
                loadUsuarios();
              } catch (err) {
                console.error(err);
                alert('Error al eliminar usuario.');
              }
            }
          });
        });

      } catch (err) {
        console.error(err);
        alert('Error cargando usuarios: ' + err.message);
      }
    }

    // --- Cargar productos ---
    async function loadProductos() {
    try {
      const res = await fetch('/api/admin/productos', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('No se pudieron obtener los productos');
      const productos = await res.json();

      // 🔹 Seleccionar el cuerpo de la tabla
      const tablaBody = document.querySelector('#productsTable tbody');
      if (!tablaBody) throw new Error('No se encontró la tabla de productos en el DOM');

      tablaBody.innerHTML = '';

      productos.forEach(p => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
          <td>${p.id_producto}</td>
          <td>${p.nombre_producto}</td>
          <td>${p.nombre_categoria || '-'}</td>
          <td>
            <button class="btn-edit-product" data-id="${p.id_producto}">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-delete-product" data-id="${p.id_producto}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        `;
        tablaBody.appendChild(fila);
      });

        // --- Botón editar ---
        tablaBody.querySelectorAll('.btn-edit-product').forEach(btn => {
          btn.addEventListener('click', () => openEditProductModal(btn.dataset.id));
        });

        // --- Botón eliminar ---
        tablaBody.querySelectorAll('.btn-delete-product').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (confirm('¿Seguro que deseas eliminar este producto?')) {
              await fetch(`/api/admin/productos/${btn.dataset.id}`, {
                method: 'DELETE',
                credentials: 'same-origin'
              });
              loadProductos();
            }
          });
        });

      } catch (err) {
        console.error(err);
        alert('Error cargando productos: ' + err.message);
      }
    }
    
    // --- Cargar Proveedores ---
    async function loadProveedores() {
      try {
        const res = await fetch('/api/admin/proveedores', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('No se pudieron obtener los proveedores');
        const proveedores = await res.json();

        const tbody = document.querySelector('#suppliersTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        proveedores.forEach(p => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${p.id_proveedor}</td>
            <td>${p.nombre_proveedor}</td>
            <td>${p.telefono || '-'}</td>
            <td>${p.correo || '-'}</td>
            <td>${p.direccion || '-'}</td>
            <td>
              <button class="btn-edit-supplier" data-id="${p.id_proveedor}"><i class="fa-solid fa-pen"></i></button>
              <button class="btn-delete-supplier" data-id="${p.id_proveedor}"><i class="fa-solid fa-trash"></i></button>
            </td>
          `;
          tbody.appendChild(tr);
        });

        // --- Botón editar ---
        tbody.querySelectorAll('.btn-edit-supplier').forEach(btn => {
          btn.addEventListener('click', () => openEditSupplierModal(btn.dataset.id));
        });

        // --- Botón eliminar ---
        tbody.querySelectorAll('.btn-delete-supplier').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (confirm('¿Seguro que deseas eliminar este proveedor?')) {
              await fetch(`/api/admin/proveedores/${btn.dataset.id}`, {
                method: 'DELETE',
                credentials: 'same-origin'
              });
              loadProveedores();
            }
          });
        });

        // --- 🆕 Botón agregar ---
        const btnAdd = document.querySelector('.btn-add-new');
        if (btnAdd) {
          btnAdd.addEventListener('click', () => openAddSupplierModal());
        }
      } catch (err) {
        console.error(err);
        alert('Error cargando proveedores: ' + err.message);
      }
    }

    // --- Función para abrir modal de usuario ---
    async function openEditUserModal(id) {
      try {
        const res = await fetch(`/api/admin/usuarios/${id}`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Usuario no encontrado');
        const u = await res.json();

        const modal = document.getElementById('modal-editar');
        modal.style.display = 'flex';

        document.getElementById('edit-id').value = u.id_usuario;
        document.getElementById('edit-nombre').value = u.nombre;
        document.getElementById('edit-paterno').value = u.paterno;
        document.getElementById('edit-materno').value = u.materno || '';
        document.getElementById('edit-correo').value = u.correo;
        document.getElementById('edit-telefono').value = u.telefono || '';
        document.getElementById('edit-genero').value = u.genero || 'M';
        document.getElementById('edit-tipo').value = u.tipo_usuario;

        // --- Listener correcto, solo uno ---
        const form = document.getElementById('form-editar');
        form.onsubmit = async e => {
          e.preventDefault();

          const id = document.getElementById('edit-id').value;
          const data = {
            nombre: document.getElementById('edit-nombre').value,
            paterno: document.getElementById('edit-paterno').value,
            materno: document.getElementById('edit-materno').value,
            correo: document.getElementById('edit-correo').value,
            telefono: document.getElementById('edit-telefono').value,
            genero: document.getElementById('edit-genero').value,
            tipo_usuario: Number(document.getElementById('edit-tipo').value)
          };

          console.log("Datos a enviar al backend:", data);

          try {
            const res = await fetch(`/api/admin/usuarios/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify(data)
            });

            const result = await res.json();
            console.log("Respuesta del backend:", result);

            if (res.ok) {
              alert('✅ Usuario modificado correctamente');
              modal.style.display = 'none';
              loadUsuarios();
            } else {
              alert('❌ Error al actualizar usuario: ' + (result.mensaje || 'Error desconocido'));
            }
          } catch (err) {
            console.error(err);
            alert('❌ Error inesperado al actualizar usuario: ' + err.message);
          }
        };

      } catch (err) {
        console.error(err);
        alert('Error al cargar datos del usuario.');
      }
    }

    // --- Abrir modal de edición de producto ---
    async function openEditProductModal(id) {
      try {
        const res = await fetch(`/api/admin/productos/${id}`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Producto no encontrado');
        const p = await res.json();

        // Obtener categorías dinámicamente
        const catRes = await fetch('/api/admin/categorias', { credentials: 'same-origin' });
        if (!catRes.ok) throw new Error('No se pudieron obtener las categorías');
        const categorias = await catRes.json();

        const modal = document.getElementById('modal-editar-producto');
        modal.style.display = 'flex';

        document.getElementById('edit-producto-id').value = p.id_producto;
        document.getElementById('edit-producto-nombre').value = p.nombre_producto;

        // --- Llenar dinámicamente el select de categorías ---
        const select = document.getElementById('edit-producto-categoria');
        select.innerHTML = '';

        categorias.forEach(c => {
          const option = document.createElement('option');
          option.value = c.id_categoria;
          option.textContent = c.nombre_categoria;
          if (p.id_categoria === c.id_categoria) option.selected = true;
          select.appendChild(option);
        });

        const form = document.getElementById('form-editar-producto');
        form.onsubmit = async e => {
          e.preventDefault();

          const data = {
            nombre_producto: document.getElementById('edit-producto-nombre').value,
            id_categoria: document.getElementById('edit-producto-categoria').value
          };

          const resp = await fetch(`/api/admin/productos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(data)
          });

          const result = await resp.json();
          if (resp.ok) {
            alert('✅ Producto actualizado correctamente');
            modal.style.display = 'none';
            loadProductos();
          } else {
            alert('❌ Error al actualizar producto: ' + (result.mensaje || 'Error desconocido'));
          }
        };
      } catch (err) {
        console.error(err);
        alert('Error al cargar datos del producto.');
      }
    }

    // --- Abrir modal de edición de proveedor ---
    async function openEditSupplierModal(id) {
      try {
        const res = await fetch(`/api/admin/proveedores/${id}`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Proveedor no encontrado');
        const p = await res.json();

        const modal = document.getElementById('modal-editar-proveedor');
        modal.style.display = 'flex';

        document.getElementById('edit-proveedor-id').value = p.id_proveedor;
        document.getElementById('edit-nombre').value = p.nombre_proveedor;
        document.getElementById('edit-telefono').value = p.telefono || '';
        document.getElementById('edit-correo').value = p.correo || '';
        document.getElementById('edit-direccion').value = p.direccion || '';

        const form = document.getElementById('form-editar-proveedor');
        form.onsubmit = async e => {
          e.preventDefault();

          const data = {
            nombre_proveedor: document.getElementById('edit-nombre').value,
            telefono: document.getElementById('edit-telefono').value,
            correo: document.getElementById('edit-correo').value,
            direccion: document.getElementById('edit-direccion').value
          };

          const resp = await fetch(`/api/admin/proveedores/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(data)
          });

          const result = await resp.json();
          if (resp.ok) {
            alert('✅ Proveedor actualizado correctamente');
            modal.style.display = 'none';
            loadProveedores();
          } else {
            alert('❌ Error al actualizar proveedor: ' + (result.mensaje || 'Error desconocido'));
          }
        };
      } catch (err) {
        console.error(err);
        alert('Error al cargar datos del proveedor.');
      }
    }

    // --- Modal de añadir proveedor
    async function openAddSupplierModal() {
    const modal = document.getElementById('modal-agregar-proveedor');
    modal.style.display = 'flex';

    const form = document.getElementById('form-agregar-proveedor');
    form.reset();

    form.onsubmit = async e => {
      e.preventDefault();

      const data = {
        nombre_proveedor: document.getElementById('nuevo-proveedor-nombre').value,
        telefono: document.getElementById('nuevo-proveedor-telefono').value,
        correo: document.getElementById('nuevo-proveedor-correo').value,
        direccion: document.getElementById('nuevo-proveedor-direccion').value
      };

      try {
        const res = await fetch('/api/admin/proveedores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(data)
        });

        const result = await res.json();
        if (res.ok) {
          alert('✅ Proveedor agregado correctamente');
          modal.style.display = 'none';
          loadProveedores();
        } else {
          alert('❌ Error al agregar proveedor: ' + (result.mensaje || 'Error desconocido'));
        }
      } catch (err) {
        console.error(err);
        alert('Error al agregar proveedor: ' + err.message);
      }
    };
  }

    // Botones generales
    document.getElementById('btnEdit').addEventListener('click', () => {
      alert('Aquí iría la edición de perfil.');
    });

    const logoutFunction = async (e) => {
      e.preventDefault(); // Prevenir la navegación si es un enlace
      await fetch('/logout', { method: 'POST' });
      window.location.href = '/';
    };

    // Asignar la función de logout a ambos botones
    document.getElementById('btnLogout').addEventListener('click', logoutFunction);

    document.getElementById('btnHome').addEventListener('click', () => {
      window.location.href = '/';
    });

  } catch (err) {
    console.error('Error al cargar datos de usuario:', err);
    window.location.href = '/Font/login.html';
  }
});
