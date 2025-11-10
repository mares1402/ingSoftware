document.addEventListener('DOMContentLoaded', async () => {
  // Evitar cache al usar "Atrás"
  window.addEventListener('pageshow', e => { if (e.persisted) window.location.reload(); });

  /**
   * Muestra una notificación flotante (toast) en la esquina superior derecha.
   * @param {string} mensaje El texto que se mostrará en la notificación.
   * @param {string} [tipo='error'] El tipo de notificación ('error' o 'exito').
   */
  function mostrarNotificacion(mensaje, tipo = 'error') {
    const notificacion = document.createElement('div');
    notificacion.textContent = mensaje;
    notificacion.className = `toast-notification ${tipo}`;
    
    // Añadir icono
    const icon = document.createElement('i');
    icon.className = tipo === 'exito' ? 'fa-solid fa-check-circle' : 'fa-solid fa-exclamation-circle';
    notificacion.prepend(icon);

    document.body.appendChild(notificacion);

    // Animar entrada y salida
    setTimeout(() => notificacion.classList.add('show'), 10);
    setTimeout(() => {
      notificacion.classList.remove('show');
      notificacion.addEventListener('transitionend', () => notificacion.remove());
    }, 4000);
  }

  /**
   * Muestra un modal de confirmación genérico.
   * @param {string} titulo El título del modal.
   * @param {string} mensaje El mensaje de confirmación.
   * @param {function} onConfirm El callback a ejecutar si el usuario confirma.
   */
  function mostrarConfirmacion(titulo, mensaje, onConfirm) {
    // Reutilizar el modal si ya existe
    let modal = document.getElementById('generic-confirm-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'generic-confirm-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
          <h3 class="modal-title"></h3>
          <p class="modal-message"></p>
          <div class="modal-actions">
            <button class="btn-confirm">Sí, eliminar</button>
            <button class="btn-cancel">Cancelar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // Configurar contenido y eventos
    modal.querySelector('.modal-title').textContent = titulo;
    modal.querySelector('.modal-message').textContent = mensaje;

    // Usar .onclick para evitar listeners duplicados
    modal.querySelector('.btn-confirm').onclick = () => { modal.style.display = 'none'; onConfirm(); };
    modal.querySelector('.btn-cancel').onclick = () => { modal.style.display = 'none'; };
    modal.querySelector('.modal-overlay').onclick = () => { modal.style.display = 'none'; };

    modal.style.display = 'flex';
  }

  /**
   * Muestra un modal con un reporte detallado de errores.
   * @param {string} titulo El título del modal.
   * @param {string} resumen Un mensaje de resumen.
   * @param {string[]} errores Un array con los mensajes de error.
   */
  function mostrarReporteErrores(titulo, resumen, errores) {
    let modal = document.getElementById('error-report-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'error-report-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content modal-report">
          <h3 class="modal-title"></h3>
          <p class="modal-message"></p>
          <div class="error-list-container">
            <ul class="error-list"></ul>
          </div>
          <div class="modal-actions">
            <button class="btn-confirm">Entendido</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.querySelector('.modal-title').textContent = titulo;
    modal.querySelector('.modal-message').textContent = resumen;
    modal.querySelector('.error-list').innerHTML = errores.map(e => `<li>${e}</li>`).join('');

    modal.querySelector('.btn-confirm').onclick = () => {
      window.location.reload();
    };
    setupModalCloseListeners(modal);
    modal.style.display = 'flex';
  }

  // --- OPTIMIZACIÓN: Caché para datos que no cambian a menudo ---
  let cachedCategories = null;
  let cachedSuppliers = null;

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

    // Cambiar el título de la página dinámicamente
    if (!esAdmin) {
      document.title = 'Mi Perfil - Mount';
    }
    document.getElementById('userEmail').textContent = correo;

    const contentArea = document.getElementById('content-area');
    const navContainer = document.querySelector('.dashboard-nav');

    // Función para mostrar una sección
    const showSection = async (section, linkElement) => {
      document.querySelectorAll('.nav-link.active').forEach(link => link.classList.remove('active'));
      if (linkElement) linkElement.classList.add('active');

      // Guardar la sección actual para poder volver a ella después de una recarga
      sessionStorage.setItem('lastAdminSection', section);

      if (section === 'info.html') {
      
        const excelInputs = ['excelProductos', 'excelProveedores', 'excelCategorias'];
        excelInputs.forEach(id => {
          const input = document.getElementById(id);
          if (input) input.value = '';
        });
       

        // Caso especial: Generar la tarjeta de información del usuario dinámicamente
        let generoDisplay;
        if (genero === 'Masculino') generoDisplay = `<span class="gender-male">Masculino ♂️</span>`;
        else if (genero === 'Femenino') generoDisplay = `<span class="gender-female">Femenino ♀️</span>`;
        else generoDisplay = `<span class="gender-other">${genero} ⚧️</span>`;

        contentArea.innerHTML = `
          <div class="info-card">
            <h2 class="info-card-title">Tu Información</h2>
            <div class="info-card-grid">
              <div class="info-item"><span class="info-label">Género:</span> ${generoDisplay}</div>
              <div class="info-item"><span class="info-label">Tipo de Usuario:</span> <span class="info-value">${esAdmin ? 'Administrador' : 'Cliente'} ${esAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}</span></div>
            </div>
          </div>
        `;
      } else {
        // Cargar paneles de admin desde el servidor
        // --- REINICIO DE ESTADO ---
        // Al cargar un panel de administración, reiniciamos los inputs de excel
        // para asegurar que la funcionalidad de carga esté limpia cada vez.
        const excelInputs = ['excelProductos', 'excelProveedores', 'excelCategorias'];
        excelInputs.forEach(id => {
          const input = document.getElementById(id);
          if (input) input.value = '';
        });
        // --- FIN DE REINICIO ---

        contentArea.innerHTML = '<p>Cargando...</p>';
        try {
          const resp = await fetch(`/api/admin/panel/${section}`, { credentials: 'same-origin' });
          if (!resp.ok) throw new Error(`No se pudo cargar el panel ${section}`);

          // Obtener el nombre de la sección desde el texto del link
          const sectionName = linkElement ? linkElement.textContent.trim() : 'Panel';

          // Construir el HTML del panel con un título dinámico
          const panelHtml = `
            <div class="admin-panel-card">
              <h2 class="admin-panel-title">${sectionName}</h2>
              ${await resp.text()}
            </div>`;
          contentArea.innerHTML = panelHtml;

          // Cargar datos después de inyectar el HTML
          if (section === 'admin-users.html') {
            // Ocultar el botón de "Añadir Nuevo" que no se usa en este panel
            const addUserBtn = contentArea.querySelector('.btn-add-new');
            if (addUserBtn) addUserBtn.style.display = 'none';
            loadUsuarios();
          }
          if (section === 'admin-products.html') loadProductos();
          if (section === 'admin-suppliers.html') loadProveedores();
          if (section === 'admin-categories.html') loadCategorias(); 
          // Aquí podrías añadir la carga de datos para las cotizaciones en el futuro

          // Configurar listener para el input de Excel
          setupFileInputListener('excelProductos', 'excel-productos-filename');
          setupFileInputListener('excelProveedores', 'excel-proveedores-filename');
          setupFileInputListener('excelCategorias', 'excel-categorias-filename');

        } catch (err) {
          mostrarNotificacion(`Error cargando el panel: ${err.message}`, 'error');
          console.error(err);
        }
      }
    };

    // Función para activar los listeners de cierre de un modal
    const setupModalCloseListeners = (modalElement) => {
      if (!modalElement) return;
      
      const closeModal = () => { modalElement.style.display = 'none'; };

      const closeButton = modalElement.querySelector('.modal-close-btn');
      const overlay = modalElement.querySelector('.modal-overlay');

      // Usamos `onclick` para sobreescribir listeners previos y evitar duplicados
      if (closeButton) closeButton.onclick = closeModal;
      if (overlay) overlay.onclick = closeModal;
    };

    // Construir navegación
    let navHTML = '<ul><li><a href="#" class="nav-link" data-section="info.html"><i class="fa-solid fa-circle-info"></i> Tu Información</a></li></ul>';
    if (esAdmin) {
      navHTML += `
        <hr>
        <h4 class="nav-title">Administración</h4>
        <ul>
          <li><a href="#" class="nav-link" data-section="admin-users.html"><i class="fa-solid fa-users"></i> Usuarios</a></li>
          <li><a href="#" class="nav-link" data-section="admin-products.html"><i class="fa-solid fa-box-archive"></i> Productos</a></li>
          <li><a href="#" class="nav-link" data-section="admin-suppliers.html"><i class="fa-solid fa-dolly"></i> Proveedores</a></li>
          <li><a href="#" class="nav-link" data-section="admin-categories.html"><i class="fa-solid fa-tags"></i> Categorías</a></li>
        </ul>
      `;
    } else {
      // Menú para clientes
      navHTML += `
        <hr>
        <h4 class="nav-title">Opciones</h4>
        <ul><li><a href="#" class="nav-link" data-section="client-quotes.html"><i class="fa-solid fa-file-invoice-dollar"></i> Mis Cotizaciones</a></li></ul>
      `;
    }
    navContainer.innerHTML = navHTML;

    // Asignar eventos a los nuevos links
    // Invalidar caché de categorías si se navega a la sección de categorías para asegurar datos frescos
    contentArea.addEventListener('click', e => {
      if (e.target.closest('[data-section="admin-categories.html"]')) {
        cachedCategories = null;
      }
    });
    navContainer.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(link.dataset.section, link);
      });
    });

    // Cargar la última sección visitada o la sección por defecto
    const lastSection = sessionStorage.getItem('lastAdminSection');
    if (lastSection && esAdmin && navContainer.querySelector(`[data-section="${lastSection}"]`)) {
      // Si hay una sección guardada y el link existe en la nav, la cargamos
      const linkToActivate = navContainer.querySelector(`.nav-link[data-section="${lastSection}"]`);
      showSection(lastSection, linkToActivate);
    } else {
      // Si no, cargamos la primera sección disponible
      const defaultSectionLink = navContainer.querySelector('.nav-link');
      if (defaultSectionLink) showSection(defaultSectionLink.dataset.section, defaultSectionLink);
    }

    // Usar MutationObserver para detectar cuando se añaden modales al DOM.
    // Es más eficiente y moderno que DOMNodeInserted.
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            // Si el nodo añadido (o uno de sus hijos) es un modal, configuramos su cierre.
            if (node.nodeType === 1 && node.matches('.modal')) {
              setupModalCloseListeners(node);
            }
          });
        }
      }
    });
    observer.observe(contentArea, { childList: true, subtree: true });

    // Función para cargar un modal HTML (si es necesario en el futuro)
    const loadModal = async (modalFile) => {
      // Evita cargar el mismo modal dos veces
      const modalId = modalFile.replace('.html', '');
      if (document.getElementById(modalId)) return;

      const resp = await fetch(`/api/admin/panel/${modalFile}`, { credentials: 'same-origin' });
      if (resp.ok) {
        const modalHtml = await resp.text();
        document.body.insertAdjacentHTML('beforeend', modalHtml); // Añade el modal al final del body
        const modalElement = document.getElementById(modalId);
        setupModalCloseListeners(modalElement);
      }
    };

    // --- Cargar categorías en el select ---
    async function cargarCategoriasSelect(selectId, selectedId = null) {
      if (!cachedCategories) {
        const res = await fetch('/api/admin/categorias', { credentials: 'same-origin' });
        cachedCategories = await res.json();
      }
      const select = document.getElementById(selectId);
      select.innerHTML = '<option value="">Seleccionar...</option>';
      cachedCategories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id_categoria;
        opt.textContent = c.nombre_categoria;
        if (c.id_categoria == selectedId) opt.selected = true;
        select.appendChild(opt);
      });
    }

    // --- Cargar proveedores en el select ---
    async function cargarProveedoresSelect(selectId, selectedId = null) {
      try {
        if (!cachedSuppliers) {
          const res = await fetch('/api/admin/proveedores', { credentials: 'same-origin' });
          cachedSuppliers = await res.json();
        }
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Seleccione un proveedor</option>';
        cachedSuppliers.forEach(proveedor => {
          const option = document.createElement('option');
          option.value = proveedor.id_proveedor;
          option.textContent = proveedor.nombre_proveedor;
          if (proveedor.id_proveedor == selectedId) option.selected = true;
          select.appendChild(option);
        });
      } catch (err) {
        console.error('Error al cargar proveedores:', err);
        document.getElementById(selectId).innerHTML = '<option value="">Error al cargar</option>';
      }
    }

    // --- Función para cargar usuarios ---
    async function loadUsuarios() {
      try {
        const res = await fetch('/api/admin/usuarios', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('No se pudieron obtener los usuarios');
        const usuarios = await res.json();

        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;

        // --- OPTIMIZACIÓN: Construir HTML y añadirlo una sola vez ---
        tbody.innerHTML = usuarios.map(u => `
          <tr>
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
          </tr>
        `).join('');

        // --- OPTIMIZACIÓN: Delegación de eventos ---
        tbody.onclick = async (e) => {
          const editBtn = e.target.closest('.btn-edit-user');
          const deleteBtn = e.target.closest('.btn-delete-user');

          if (editBtn) {
            openEditUserModal(editBtn.dataset.id);
          } else if (deleteBtn) {
            mostrarConfirmacion('Confirmar Eliminación', '¿Seguro que deseas eliminar este usuario?', async () => { // Esto usa el modal estilizado
              try {
                const res = await fetch(`/api/admin/usuarios/${deleteBtn.dataset.id}`, { method: 'DELETE', credentials: 'same-origin' });
                const result = await res.json();
                if (!res.ok) throw new Error(result.mensaje || 'No se pudo eliminar el usuario');
                mostrarNotificacion(result.mensaje, 'exito');
                loadUsuarios();
              } catch (err) {
                mostrarNotificacion(err.message, 'error');
              }
            });
          }
        };

        // Configurar búsqueda para la tabla de usuarios
        const searchInput = document.querySelector('.panel-search');
        if (searchInput && tbody) {
          searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
              const name = row.cells[1].textContent.toLowerCase();
              const email = row.cells[4].textContent.toLowerCase();
              const id = row.cells[0].textContent.toLowerCase();
              const isVisible = name.includes(searchTerm) || email.includes(searchTerm) || id.includes(searchTerm);
              row.style.display = isVisible ? '' : 'none';
            });
          });
        }
      } catch (err) {
        console.error(err);
        mostrarNotificacion('Error cargando usuarios: ' + err.message, 'error');
      }
    }

    // --- Cargar productos ---
    async function loadProductos() {
    try {
      const res = await fetch('/api/admin/productos', { credentials: 'same-origin' , headers: { 'Accept': 'application/json' }});
      if (!res.ok) throw new Error('No se pudieron obtener los productos');
      const productos = await res.json();

      // 🔹 Seleccionar el cuerpo de la tabla
      const tablaBody = document.querySelector('#productsTable tbody');
      if (!tablaBody) throw new Error('No se encontró la tabla de productos en el DOM');

      // --- OPTIMIZACIÓN: Construir HTML y añadirlo una sola vez ---
      tablaBody.innerHTML = productos.map(p => `
        <tr>
          <td>${p.id_producto}</td>
          <td>${p.nombre_producto}</td>
          <td>${p.ruta_imagen ? `<img src="${p.ruta_imagen}" alt="Imagen" style="width: 50px; height: 50px; object-fit: cover;">` : 'No imagen'}</td>
          <td>${p.nombre_categoria || '-'}</td>
          <td>${p.nombre_proveedor || 'Sin proveedor'}</td>
          <td>
            <button class="btn-edit-product" data-id="${p.id_producto}"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-delete-product" data-id="${p.id_producto}"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('');

      tablaBody.onclick = async (e) => {
        const editBtn = e.target.closest('.btn-edit-product');
        const deleteBtn = e.target.closest('.btn-delete-product');

        if (editBtn) {
          openEditProductModal(editBtn.dataset.id);
        } else if (deleteBtn) {
          mostrarConfirmacion('Confirmar Eliminación', '¿Seguro que deseas eliminar este producto? Esto también borrará su imagen.', async () => {
            try {
              const res = await fetch(`/api/admin/productos/${deleteBtn.dataset.id}`, { 
                method: 'DELETE', 
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' } // <-- Cabecera añadida
              });
              const result = await res.json();
              if (!res.ok) throw new Error(result.mensaje || 'No se pudo eliminar el producto');
              mostrarNotificacion(result.mensaje, 'exito');
              loadProductos();
            } catch (err) {
              mostrarNotificacion(err.message, 'error');
            }
          });
        }
      };

      // Configurar búsqueda para la tabla de productos
      const searchInput = document.querySelector('.panel-search');
      if (searchInput && tablaBody) {
        searchInput.addEventListener('input', () => {
          const searchTerm = searchInput.value.toLowerCase();
          const rows = tablaBody.querySelectorAll('tr');
          rows.forEach(row => {
            const id = row.cells[0].textContent.toLowerCase();
            const name = row.cells[1].textContent.toLowerCase();
            // El placeholder dice SKU, pero no hay columna SKU. Buscamos por ID y Nombre.
            const isVisible = name.includes(searchTerm) || id.includes(searchTerm);
            row.style.display = isVisible ? '' : 'none';
          });
        });
      }
      } catch (err) {
        console.error('Error al cargar productos:', err);
        mostrarNotificacion('Error al cargar productos: ' + err.message, 'error');
      }
    }
    
    // --- Cargar proveedores ---
    async function loadProveedores() {
      try {
        const res = await fetch('/api/admin/proveedores', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('No se pudieron obtener los proveedores');
        const proveedores = await res.json();

        const tbody = document.querySelector('#suppliersTable tbody');
        if (!tbody) return;

        tbody.innerHTML = proveedores.map(p => `
          <tr>
            <td>${p.id_proveedor}</td>
            <td>${p.nombre_proveedor}</td>
            <td>${p.telefono || '-'}</td>
            <td>${p.correo || '-'}</td>
            <td>${p.direccion || '-'}</td>
            <td>
              <button class="btn-edit-supplier" data-id="${p.id_proveedor}"><i class="fa-solid fa-pen"></i></button>
              <button class="btn-delete-supplier" data-id="${p.id_proveedor}"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `).join('');

        tbody.onclick = async (e) => {
          const editBtn = e.target.closest('.btn-edit-supplier');
          const deleteBtn = e.target.closest('.btn-delete-supplier');

          if (editBtn) {
            openEditSupplierModal(editBtn.dataset.id);
          } else if (deleteBtn) {
            mostrarConfirmacion('Confirmar Eliminación', '¿Seguro que deseas eliminar este proveedor?', async () => {
              try {
                const res = await fetch(`/api/admin/proveedores/${deleteBtn.dataset.id}`, { method: 'DELETE', credentials: 'same-origin' });
                const result = await res.json();
                if (!res.ok) throw new Error(result.mensaje || 'No se pudo eliminar el proveedor');
                cachedSuppliers = null; // Invalidar caché para que se recargue
                mostrarNotificacion(result.mensaje, 'exito');
                loadProveedores();
              } catch (err) {
                mostrarNotificacion(err.message, 'error');
              }
            });
          }
        };

        // Configurar búsqueda para la tabla de proveedores
        const searchInput = document.querySelector('.panel-search');
        if (searchInput && tbody) {
          searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
              const id = row.cells[0].textContent.toLowerCase();
              const name = row.cells[1].textContent.toLowerCase();
              const isVisible = name.includes(searchTerm) || id.includes(searchTerm);
              row.style.display = isVisible ? '' : 'none';
            });
          });
        }

      } catch (err) {
        console.error('Error al cargar proveedores:', err);
        mostrarNotificacion('Error cargando proveedores: ' + err.message, 'error');
      }
    }

    // --- Cargar categorías ---
    async function loadCategorias() {
      try {
        const res = await fetch('/api/admin/categorias', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('No se pudieron obtener las categorías');
        const categorias = await res.json();

        const tbody = document.querySelector('#categoriesTable tbody');
        if (!tbody) return;

        tbody.innerHTML = categorias.map(c => `
          <tr>
            <td>${c.id_categoria}</td>
            <td>${c.nombre_categoria}</td>
            <td>
              <button class="btn-edit-category" data-id="${c.id_categoria}"><i class="fa-solid fa-pen"></i></button>
              <button class="btn-delete-category" data-id="${c.id_categoria}"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
        `).join('');

        tbody.onclick = async (e) => {
          const editBtn = e.target.closest('.btn-edit-category');
          const deleteBtn = e.target.closest('.btn-delete-category');

          if (editBtn) {
            openEditCategoryModal(editBtn.dataset.id);
          } else if (deleteBtn) {
            mostrarConfirmacion('Confirmar Eliminación', '¿Seguro que deseas eliminar esta categoría?', async () => {
              try {
                const res = await fetch(`/api/admin/categorias/${deleteBtn.dataset.id}`, { method: 'DELETE', credentials: 'same-origin' });
                const result = await res.json();
                if (!res.ok) throw new Error(result.mensaje || 'No se pudo eliminar la categoría');
                cachedCategories = null; // Invalidar caché
                mostrarNotificacion(result.mensaje, 'exito');
                loadCategorias();
              } catch (err) {
                mostrarNotificacion(err.message, 'error');
              }
            });
          }
        };

        // Configurar botón de añadir
        const addBtn = document.querySelector('.btn-add-new');
        if (addBtn) addBtn.onclick = () => openAddCategoryModal();

        // Configurar búsqueda para la tabla de categorías
        const searchInput = document.querySelector('.panel-search');
        if (searchInput && tbody) {
          searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
              const id = row.cells[0].textContent.toLowerCase();
              const name = row.cells[1].textContent.toLowerCase();
              const email = row.cells[3].textContent.toLowerCase();
              const isVisible = name.includes(searchTerm) || id.includes(searchTerm) || email.includes(searchTerm);
              row.style.display = isVisible ? '' : 'none';
            });
          });
        }

      } catch (err) {
        mostrarNotificacion('Error cargando categorías: ' + err.message, 'error');
      }
    }
    // --- Función para abrir modal de usuario ---
    async function openEditUserModal(id) {
      try {
        // Cargar el HTML del modal de edición de usuario si no existe
        if (!document.getElementById('modal-editar-usuario')) {
          await loadModal('modal-editar-usuario.html');
        }

        const res = await fetch(`/api/admin/usuarios/${id}`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Usuario no encontrado');
        const u = await res.json();

        const modal = document.getElementById('modal-editar-usuario');
        setupModalCloseListeners(modal); // Asegurarse de que el cierre funcione
        modal.style.display = 'flex';

        document.getElementById('edit-usuario-id').value = u.id_usuario;
        document.getElementById('edit-usuario-nombre').value = u.nombre;
        document.getElementById('edit-usuario-paterno').value = u.paterno;
        document.getElementById('edit-usuario-materno').value = u.materno || '';
        document.getElementById('edit-usuario-correo').value = u.correo;
        document.getElementById('edit-usuario-telefono').value = u.telefono || '';
        document.getElementById('edit-usuario-genero').value = u.genero || 'Masculino';
        document.getElementById('edit-usuario-tipo').value = u.tipo_usuario;

        // --- Listener correcto, solo uno ---
        const form = document.getElementById('form-editar-usuario');
        form.onsubmit = async e => {
          e.preventDefault();

          const id = document.getElementById('edit-usuario-id').value;
          const data = {
            nombre: document.getElementById('edit-usuario-nombre').value,
            paterno: document.getElementById('edit-usuario-paterno').value,
            materno: document.getElementById('edit-usuario-materno').value,
            correo: document.getElementById('edit-usuario-correo').value,
            telefono: document.getElementById('edit-usuario-telefono').value,
            genero: document.getElementById('edit-usuario-genero').value,
            tipo_usuario: Number(document.getElementById('edit-usuario-tipo').value)
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
              mostrarNotificacion('Usuario modificado correctamente.', 'exito');
              modal.style.display = 'none';
              loadUsuarios();
            } else {
              mostrarNotificacion('Error al actualizar usuario: ' + (result.mensaje || 'Error desconocido'), 'error');
            }
          } catch (err) {
            console.error(err);
            mostrarNotificacion('Error inesperado al actualizar usuario: ' + err.message, 'error');
          }
        };

      } catch (err) {
        console.error(err);
        mostrarNotificacion('Error al cargar datos del usuario.', 'error');
      }
    }

    // --- Abrir modal de edición de producto ---
    async function openEditProductModal(id) {
      try {
        // Limpiar el input de archivo y el texto del nombre de archivo anterior
        const imagenInput = document.getElementById('edit-producto-imagen');
        if (imagenInput) imagenInput.value = ''; // Resetea el selector de archivo
        const fileNameDisplay = document.getElementById('edit-producto-filename');
        if (fileNameDisplay) fileNameDisplay.textContent = ''; // Limpia el texto del nombre
        // --- FIN DE LA CORRECCIÓN ---

        const res = await fetch(`/api/admin/productos/${id}`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Producto no encontrado');
        const p = await res.json();

      // Añadir el texto informativo de formatos
      addFormatHint('edit-producto-imagen');
      // Configurar el listener para mostrar el nombre del archivo de imagen
      setupFileInputListener('edit-producto-imagen', 'edit-producto-filename');

        const modal = document.getElementById('modal-editar-producto');
        setupModalCloseListeners(modal);
        modal.style.display = 'flex';

        document.getElementById('edit-producto-id').value = p.id_producto;
        document.getElementById('edit-producto-nombre').value = p.nombre_producto;        

        // --- Lógica de la imagen ---
        const imgContainer = document.getElementById('edit-imagen-container');
        const imgPreview = document.getElementById('edit-imagen-preview');
        const removeImgBtn = document.getElementById('btn-remove-image');
        let removeImageFlag = false; // Flag para saber si se debe eliminar la imagen

        // Mostrar imagen actual
        if (p.ruta_imagen) {
          imgPreview.src = p.ruta_imagen;
          imgContainer.style.display = 'block';
          removeImageFlag = false;
        } else {
          imgContainer.style.display = 'none';
        }

        // Evento para el botón de quitar imagen
        removeImgBtn.onclick = () => {
          imgContainer.style.display = 'none';
          imagenInput.value = ''; // Limpiar el input file
          removeImageFlag = true; // Marcar para eliminación en el backend
        };

        // --- OPTIMIZACIÓN: Usar funciones de carga con caché y ID seleccionado ---
        await cargarCategoriasSelect('edit-producto-categoria', p.id_categoria);
        await cargarProveedoresSelect('edit-producto-proveedor', p.id_proveedor);

        const form = document.getElementById('form-editar-producto');
        form.onsubmit = async e => {
          e.preventDefault();

          const formData = new FormData();
          formData.append('nombre_producto', document.getElementById('edit-producto-nombre').value);
          formData.append('id_categoria', document.getElementById('edit-producto-categoria').value);
          formData.append('id_proveedor', document.getElementById('edit-producto-proveedor').value); // Añadir ID de proveedor
          
          if (imagenInput.files && imagenInput.files[0]) {
            formData.append('imagen_producto', imagenInput.files[0]);
          } else if (removeImageFlag) {
            // Si el flag está activo y no se subió una nueva imagen,
            // le decimos al backend que la quite.
            formData.append('remove_image', 'true');
          }

          const resp = await fetch(`/api/admin/productos/${id}`, { // Cambiado data a formData
            method: 'PUT',
            credentials: 'same-origin',
            body: formData // Enviar FormData directamente
          });

          const result = await resp.json();
          if (resp.ok) {
            mostrarNotificacion('Producto actualizado correctamente.', 'exito');
            modal.style.display = 'none';
            loadProductos();
          } else {
            mostrarNotificacion('Error al actualizar producto: ' + (result.mensaje || 'Error desconocido'), 'error');
          }
        };
      } catch (err) {
        console.error('Error al cargar datos del producto:', err);
        mostrarNotificacion('Error al cargar datos del producto.', 'error');
      }
    }

    // --- Abrir modal de edición de proveedor ---
    async function openEditSupplierModal(id) {
      try {
        const res = await fetch(`/api/admin/proveedores/${id}`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Proveedor no encontrado');
        const p = await res.json();

        const modal = document.getElementById('modal-editar-proveedor');
        setupModalCloseListeners(modal);
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

        // Invalidar caché de proveedores para que se recargue la próxima vez
        cachedSuppliers = null;
          const result = await resp.json();
          if (resp.ok) {
            mostrarNotificacion('Proveedor actualizado correctamente.', 'exito');
            modal.style.display = 'none';
            loadProveedores();
          } else {
            mostrarNotificacion('Error al actualizar proveedor: ' + (result.mensaje || 'Error desconocido'), 'error');
          }
        };
      } catch (err) {
        console.error('Error al cargar datos del proveedor:', err);
        mostrarNotificacion('Error al cargar datos del proveedor.', 'error');
      }
    }

    // --- Abrir modal de edición de categoría ---
    async function openEditCategoryModal(id) {
      try {
        const res = await fetch(`/api/admin/categorias/${id}`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Categoría no encontrada');
        const cat = await res.json();

        const modal = document.getElementById('modal-editar-categoria');
        setupModalCloseListeners(modal);
        modal.style.display = 'flex';

        document.getElementById('edit-categoria-id').value = cat.id_categoria;
        document.getElementById('edit-categoria-nombre').value = cat.nombre_categoria;

        const form = document.getElementById('form-editar-categoria');
        form.onsubmit = async e => {
          e.preventDefault();
          const data = { nombre_categoria: document.getElementById('edit-categoria-nombre').value };

          const resp = await fetch(`/api/admin/categorias/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(data)
          });

          cachedCategories = null; // Invalidar caché
          const result = await resp.json();
          if (resp.ok) {
            mostrarNotificacion('Categoría actualizada correctamente.', 'exito');
            modal.style.display = 'none';
            loadCategorias();
          } else {
            mostrarNotificacion('Error al actualizar: ' + (result.mensaje || 'Error desconocido'), 'error');
          }
        };
      } catch (err) {
        mostrarNotificacion('Error al cargar datos de la categoría.', 'error');
      }
    }

    // --- Modal de añadir categoría ---
    async function openAddCategoryModal() {
      const modal = document.getElementById('modal-agregar-categoria');
      setupModalCloseListeners(modal);
      modal.style.display = 'flex';

      const form = document.getElementById('form-agregar-categoria');
      form.reset();

      form.onsubmit = async e => {
        e.preventDefault();
        const data = { nombre_categoria: document.getElementById('nuevo-categoria-nombre').value };

        try {
          const res = await fetch('/api/admin/categorias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(data)
          });

          cachedCategories = null; // Invalidar caché
          const result = await res.json();
          if (res.ok) {
            mostrarNotificacion('Categoría agregada correctamente.', 'exito');
            modal.style.display = 'none';
            loadCategorias();
          } else {
            mostrarNotificacion('Error al agregar: ' + (result.mensaje || 'Error desconocido'), 'error');
          }
        } catch (err) {
          mostrarNotificacion('Error de conexión: ' + err.message, 'error');
        }
      };
    }


    // --- Modal de añadir proveedor
    async function openAddSupplierModal() {
    const modal = document.getElementById('modal-agregar-proveedor');
    setupModalCloseListeners(modal);
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

        // Invalidar caché de proveedores para que se recargue la próxima vez
        cachedSuppliers = null;
        const result = await res.json();
        if (res.ok) {
          mostrarNotificacion('Proveedor agregado correctamente.', 'exito');
          modal.style.display = 'none';
          loadProveedores();
        } else {
          mostrarNotificacion('Error al agregar proveedor: ' + (result.mensaje || 'Error desconocido'), 'error');
        }
      } catch (err) {
        console.error(err);
        mostrarNotificacion('Error al agregar proveedor: ' + err.message, 'error');
      }
    };
  }

  /**
   * Actualiza un elemento span con el nombre del archivo seleccionado en un input.
   * @param {HTMLInputElement} inputElement El input de tipo 'file'.
   * @param {string} displayElementId El ID del span donde se mostrará el nombre.
   */
  function setupFileInputListener(inputId, displayId) {
    const inputElement = document.getElementById(inputId);
    if (!inputElement) return;

    // Asegurarse de que el elemento para mostrar el nombre exista
    let displayElement = document.getElementById(displayId);
    if (!displayElement) {
      displayElement = document.createElement('span');
      displayElement.id = displayId;
      displayElement.className = 'file-name-display';
      // Insertarlo justo después del input de archivo
      inputElement.insertAdjacentElement('afterend', displayElement);
    }

    // Determinar qué botón de confirmación usar
    let confirmBtnId;
    if (inputId === 'excelProductos') {
      confirmBtnId = 'btn-confirm-excel-upload'; // Este es el de productos
    } else if (inputId === 'excelProveedores') {
      confirmBtnId = 'btn-confirm-excel-upload-proveedores'; // Este es el de proveedores
    } else if (inputId === 'excelCategorias') {
      confirmBtnId = 'btn-confirm-excel-upload-categorias'; // Este es el de categorías
    }
    const confirmBtn = document.getElementById(confirmBtnId);

    inputElement.addEventListener('change', () => {
      // Limpiar el nombre de archivo y ocultar el botón de confirmación al inicio
      displayElement.textContent = '';
      if (confirmBtn) confirmBtn.style.display = 'none';

      // Validación de formato de archivo para Excel
      if (inputId.startsWith('excel')) {
        const file = inputElement.files[0];
        if (file && !/\.(xlsx|xls)$/i.test(file.name)) {
          mostrarNotificacion('Formato de archivo no válido. Solo se permiten archivos de Excel (.xlsx, .xls).', 'error');
          inputElement.value = ''; // Limpiar el input
          return;
        }
      }
      if (inputElement.files && inputElement.files.length > 0) {
        const fileName = inputElement.files[0].name;
        displayElement.textContent = fileName.length > 30 ? `${fileName.substring(0, 27)}...` : fileName;

        if (confirmBtn) {
          confirmBtn.style.display = 'inline-flex';
          // Asignar el evento de subida correcto
          confirmBtn.onclick = null; // Limpiar evento anterior para evitar cierres inesperados
          if (inputId === 'excelProductos') confirmBtn.onclick = () => subirExcelProductos(inputElement.files[0]);
          if (inputId === 'excelProveedores') confirmBtn.onclick = () => subirExcelProveedores(inputElement.files[0]);
          if (inputId === 'excelCategorias') confirmBtn.onclick = () => subirExcelCategorias(inputElement.files[0]);
        }
      } else {
        displayElement.textContent = ''; // Limpiar el nombre del archivo si se cancela la selección
        if (inputId === 'excelProductos' && confirmBtn) {
          confirmBtn.style.display = 'none';
        }
      }
    });
  }


  /**
   * Añade un texto informativo sobre los formatos de archivo permitidos junto a un input de tipo file.
   * @param {string} inputId El ID del elemento input file.
   */
  function addFormatHint(inputId) {
    const input = document.getElementById(inputId);
    if (!input || !input.parentElement) return;

    // Eliminar el texto anterior si ya existe para evitar duplicados
    const existingHint = input.parentElement.querySelector('.format-hint');
    if (existingHint) existingHint.remove();

    // Crear un contenedor para el hint y el nombre del archivo
    const feedbackContainer = document.createElement('span'); // Cambiado de 'div' a 'span'
    const hint = document.createElement('span');
    hint.className = 'format-hint';
    hint.textContent = 'Formatos: JPG, PNG, GIF, WEBP';
    feedbackContainer.appendChild(hint);
    input.insertAdjacentElement('afterend', feedbackContainer);
  }

  // --- Abrir modal para añadir producto ---
  async function openAddProductModal() {
    const modal = document.getElementById('modal-agregar-producto');
    setupModalCloseListeners(modal);
    modal.style.display = 'flex';
    
    const form = document.getElementById('form-agregar-producto');
    form.reset(); // Limpiar el formulario al abrir el modal

    await cargarCategoriasSelect('nuevo-producto-categoria');
    await cargarProveedoresSelect('nuevo-producto-proveedor');

    // Añadir el texto informativo de formatos
    addFormatHint('nuevo-producto-imagen');
    setupFileInputListener('nuevo-producto-imagen', 'nuevo-producto-filename');

    form.onsubmit = async e => {
      e.preventDefault();
      
      // Usar siempre FormData para ser consistente con la subida de archivos
      const formData = new FormData();
      formData.append('nombre_producto', document.getElementById('nuevo-producto-nombre').value);
      formData.append('id_categoria', document.getElementById('nuevo-producto-categoria').value);
      formData.append('id_proveedor', document.getElementById('nuevo-producto-proveedor').value);
      
      const imagenInput = document.getElementById('nuevo-producto-imagen');
      if (imagenInput.files && imagenInput.files[0]) {
        formData.append('imagen_producto', imagenInput.files[0]);
      }

      try {
        const res = await fetch('/api/admin/productos', {
          method: 'POST',
          credentials: 'same-origin',
          body: formData // Enviar FormData
        });

        const result = await res.json();
        if (res.ok) {
          mostrarNotificacion('Producto agregado correctamente.', 'exito');
          modal.style.display = 'none';
          form.reset(); // Limpiar el formulario para la próxima vez
          loadProductos();
        } else {
          mostrarNotificacion('Error al agregar producto: ' + (result.mensaje || 'Error desconocido'), 'error');
        }
      } catch (err) {
        console.error(err);
        // Captura específica para el error de formato de archivo
        if (err.message.includes('Formato de archivo no válido')) {
          mostrarNotificacion('Formato de archivo no válido. Solo se permiten imágenes.', 'error');
        } else {
          mostrarNotificacion('Error al agregar producto: ' + err.message, 'error');
        }
      }
    };
  }

  // --- Añadir productos desde excel ---
  window.subirExcelProductos = async function (file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/productos/upload', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });
      // Siempre intentar parsear el JSON, incluso en errores HTTP
      const data = await res.json();

      if (data.errores && data.errores.length > 0) {
        mostrarReporteErrores('Reporte de Carga de Productos', data.mensaje, data.errores);
      } else {
        mostrarNotificacion(data.mensaje, 'exito');
        // Recargar la página para reflejar todos los cambios de forma consistente
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (err) {
      console.error('Error al subir Excel de productos:', err);
    }
  }

  // --- Añadir proveedores desde excel ---
  window.subirExcelProveedores = async function (file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/proveedores/upload', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });
      const data = await res.json(); // Intentar parsear siempre

      if (data.errores && data.errores.length > 0) {
        mostrarReporteErrores('Reporte de Carga de Proveedores', data.mensaje, data.errores);
      } else {
        mostrarNotificacion(data.mensaje, 'exito');
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (err) {
      console.error('Error al subir Excel de proveedores:', err);
    }
  }

  // --- Añadir categorías desde excel ---
  window.subirExcelCategorias = async function (file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/categorias/upload', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });
      const data = await res.json(); // Intentar parsear siempre

      if (data.errores && data.errores.length > 0) {
        mostrarReporteErrores('Reporte de Carga de Categorías', data.mensaje, data.errores);
      } else {
        mostrarNotificacion(data.mensaje, 'exito');
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (err) {
      console.error('Error al subir Excel de categorías:', err);
    }
  }

    // --- Delegación de eventos para botones dinámicos ---
    // Esto asegura que los botones funcionen incluso si se recargan con el contenido.
    contentArea.addEventListener('click', e => {
      const target = e.target.closest('button');
      if (!target) return;

      // El botón de añadir puede estar en varios paneles, así que lo manejamos aquí
      if (target.matches('.btn-add-new')) {
        e.preventDefault();
        if (document.getElementById('productsTable')) openAddProductModal();
        if (document.getElementById('suppliersTable')) openAddSupplierModal();
        if (document.getElementById('categoriesTable')) openAddCategoryModal();
      }
    });

    // Botones generales
    document.getElementById('btnEdit').addEventListener('click', () => {
      mostrarNotificacion('La edición de perfil se implementará pronto.', 'info');
    });

    const logoutFunction = async (e) => {
      e.preventDefault(); // Prevenir la navegación si es un enlace
      await fetch('/logout', { method: 'POST' });
      window.location.href = '/';
    };

    // Asignar la función de logout a ambos botones
    document.getElementById('btnLogout').addEventListener('click', logoutFunction);
    const mainLogoutBtn = document.getElementById('mainLogoutBtn'); 
    if (mainLogoutBtn) mainLogoutBtn.addEventListener('click', logoutFunction);

    document.getElementById('btnHome').addEventListener('click', () => window.location.href = '/');

  } catch (err) {
    console.error('Error al cargar datos de usuario:', err);
    window.location.href = '/Font/login.html';
  }
});
