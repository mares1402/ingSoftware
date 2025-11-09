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

      if (section === 'info.html') {
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
        contentArea.innerHTML = '<p>Cargando...</p>';
        try {
          const resp = await fetch(`/api/admin/panel/${section}`, { credentials: 'same-origin' });
          if (!resp.ok) throw new Error(`No se pudo cargar el panel ${section}`);
          const panelHtml = await resp.text();
          contentArea.innerHTML = `<div class="admin-panel-card">${panelHtml}</div>`;

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
          <li><a href="#" class="nav-link" data-section="admin-categories.html"><i class="fa-solid fa-dolly"></i> Categorias</a></li>
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
    navContainer.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(link.dataset.section, link);
      });
    });

    // Cargar sección por defecto
    const defaultSectionLink = navContainer.querySelector('.nav-link');
    if (defaultSectionLink) {
      showSection(defaultSectionLink.dataset.section, defaultSectionLink);
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

    // --- VALIDACIONES GENERALES ---
    function soloLetras(e) {
      const char = String.fromCharCode(e.which);
      if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]$/.test(char)) {
        e.preventDefault();
      }
    }

    function soloNumeros(e) {
      const char = String.fromCharCode(e.which);
      if (!/[0-9]/.test(char)) {
        e.preventDefault();
      }
    }

    function validarCorreo(email) {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    }

    function validarUsuario(usuario) {
      return /^[a-zA-Z0-9_-]+$/.test(usuario);
    }

    function validarPassword(pass) {
      return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(pass);
    }

    // --- Cargar categorías en el select ---
    async function cargarCategoriasSelect(selectId, selectedId = null) {
      if (!cachedCategories) {
        const res = await fetch('/api/admin/listado-categorias', { credentials: 'same-origin' });
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
              <button class="btn-edit-category" data-id="${c.id_categoria}">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="btn-delete-category" data-id="${c.id_categoria}">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `).join('');

        // --- Delegación de eventos para editar/eliminar ---
        tbody.onclick = async (e) => {
          const editBtn = e.target.closest('.btn-edit-category');
          const deleteBtn = e.target.closest('.btn-delete-category');

          if (editBtn) {
            openEditCategoryModal(editBtn.dataset.id);
          } else if (deleteBtn) {
            mostrarConfirmacion('Confirmar Eliminación', '¿Seguro que deseas eliminar esta categoría?', async () => {
              try {
                const res = await fetch(`/api/admin/categorias/${deleteBtn.dataset.id}`, { 
                  method: 'DELETE', 
                  credentials: 'same-origin' 
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.mensaje || 'No se pudo eliminar la categoría');
                mostrarNotificacion(result.mensaje, 'exito');
                loadCategorias();
              } catch (err) {
                mostrarNotificacion(err.message, 'error');
              }
            });
          }
        };

        // --- BOTÓN AGREGAR NUEVA CATEGORÍA ---
        const btnAdd = document.querySelector('.btn-add-new');
        if (btnAdd) {
          btnAdd.onclick = openAddCategoryModal;
        }

        // --- SUBIDA DESDE EXCEL ---
        const excelInput = document.getElementById('excelCategorias');
        if (excelInput) {
          excelInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const fileNameDisplay = document.getElementById('excel-categorias-filename');
            const confirmBtn = document.getElementById('btn-confirm-excel-upload');
            fileNameDisplay.textContent = file.name;
            confirmBtn.style.display = 'inline-block';
            confirmBtn.onclick = () => subirExcelCategorias(file);
          });
        }

      } catch (err) {
        console.error('Error al cargar categorías:', err);
        mostrarNotificacion('Error al cargar categorías: ' + err.message, 'error');
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
              const res = await fetch(`/api/admin/productos/${deleteBtn.dataset.id}`, { method: 'DELETE', credentials: 'same-origin' });
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
      } catch (err) {
        console.error('Error al cargar proveedores:', err);
        mostrarNotificacion('Error cargando proveedores: ' + err.message, 'error');
      }
    }

    // --- Función para abrir modal de edicion de usuario ---
    async function openEditUserModal(id) {
      try {
        // Cargar modal si aún no está en el DOM
        if (!document.getElementById('modal-editar-usuario')) {
          await loadModal('modal-editar-usuario.html');
        }

        const res = await fetch(`/api/admin/usuarios/${id}`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Usuario no encontrado');
        const u = await res.json();

        const modal = document.getElementById('modal-editar-usuario');
        setupModalCloseListeners(modal);
        modal.style.display = 'flex';

        // --- Asignar valores actuales ---
        document.getElementById('edit-usuario-id').value = u.id_usuario;
        document.getElementById('edit-usuario-nombre').value = u.nombre;
        document.getElementById('edit-usuario-paterno').value = u.paterno;
        document.getElementById('edit-usuario-materno').value = u.materno || '';
        document.getElementById('edit-usuario-correo').value = u.correo;
        document.getElementById('edit-usuario-telefono').value = u.telefono || '';
        document.getElementById('edit-usuario-genero').value = u.genero || 'Masculino';
        document.getElementById('edit-usuario-tipo').value = u.tipo_usuario;

        // --- Referencias a inputs ---
        const nombreInput = document.getElementById('edit-usuario-nombre');
        const paternoInput = document.getElementById('edit-usuario-paterno');
        const maternoInput = document.getElementById('edit-usuario-materno');
        const correoInput = document.getElementById('edit-usuario-correo');
        const telefonoInput = document.getElementById('edit-usuario-telefono');

        // --- Restricciones de tipo de carácter ---
        const soloLetras = e => {
          const char = String.fromCharCode(e.which);
          if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]$/.test(char)) e.preventDefault();
        };

        const soloNumeros = e => {
          const char = String.fromCharCode(e.which);
          if (!/[0-9]/.test(char)) e.preventDefault();
        };

        // Aplicar restricciones de tipo
        nombreInput.addEventListener('keypress', soloLetras);
        paternoInput.addEventListener('keypress', soloLetras);
        maternoInput.addEventListener('keypress', soloLetras);
        telefonoInput.addEventListener('keypress', soloNumeros);

        // --- Restricciones de longitud (según base de datos) ---
        nombreInput.maxLength = 30;
        paternoInput.maxLength = 20;
        maternoInput.maxLength = 20;
        correoInput.maxLength = 40;
        telefonoInput.maxLength = 20;

        // --- Validaciones extra ---
        const validarCorreo = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        const form = document.getElementById('form-editar-usuario');
        form.onsubmit = async e => {
          e.preventDefault();

          // --- Validaciones antes del envío ---
          if (!validarCorreo(correoInput.value)) {
            mostrarNotificacion('El correo ingresado no es válido.', 'error');
            return;
          }

          if (telefonoInput.value && telefonoInput.value.length < 10) {
            mostrarNotificacion('El teléfono debe tener al menos 10 dígitos.', 'error');
            return;
          }

          // Validar longitudes antes de enviar
          const campos = [
            { campo: nombreInput, max: 30, nombre: 'Nombre' },
            { campo: paternoInput, max: 20, nombre: 'Apellido paterno' },
            { campo: maternoInput, max: 20, nombre: 'Apellido materno' },
            { campo: correoInput, max: 40, nombre: 'Correo electrónico' },
            { campo: telefonoInput, max: 20, nombre: 'Teléfono' }
          ];

          for (const { campo, max, nombre } of campos) {
            if (campo.value.trim().length > max) {
              mostrarNotificacion(`${nombre} supera el límite de ${max} caracteres.`, 'error');
              return;
            }
          }

          // --- Datos válidos ---
          const id = document.getElementById('edit-usuario-id').value;
          const data = {
            nombre: nombreInput.value.trim(),
            paterno: paternoInput.value.trim(),
            materno: maternoInput.value.trim(),
            correo: correoInput.value.trim(),
            telefono: telefonoInput.value.trim(),
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
        const imagenInput = document.getElementById('edit-producto-imagen');
        if (imagenInput) imagenInput.value = '';
        const fileNameDisplay = document.getElementById('edit-producto-filename');
        if (fileNameDisplay) fileNameDisplay.textContent = '';

        const res = await fetch(`/api/admin/productos/${id}`, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Producto no encontrado');
        const p = await res.json();

        addFormatHint('edit-producto-imagen');
        setupFileInputListener('edit-producto-imagen', 'edit-producto-filename');

        const modal = document.getElementById('modal-editar-producto');
        setupModalCloseListeners(modal);
        modal.style.display = 'flex';

        document.getElementById('edit-producto-id').value = p.id_producto;
        const inputNombre = document.getElementById('edit-producto-nombre');
        inputNombre.value = p.nombre_producto;

        // Aplicar restricciones al campo de nombre
        inputNombre.maxLength = 50;
        inputNombre.addEventListener('input', () => {
          const regex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]*$/;
          if (!regex.test(inputNombre.value)) {
            inputNombre.value = inputNombre.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, '');
            mostrarNotificacion('Solo se permiten letras y espacios en el nombre.', 'advertencia');
          }
        });

        const imgContainer = document.getElementById('edit-imagen-container');
        const imgPreview = document.getElementById('edit-imagen-preview');
        const removeImgBtn = document.getElementById('btn-remove-image');
        let removeImageFlag = false;

        if (p.ruta_imagen) {
          imgPreview.src = p.ruta_imagen;
          imgContainer.style.display = 'block';
        } else {
          imgContainer.style.display = 'none';
        }

        removeImgBtn.onclick = () => {
          imgContainer.style.display = 'none';
          imagenInput.value = '';
          removeImageFlag = true;
        };

        await cargarCategoriasSelect('edit-producto-categoria', p.id_categoria);
        await cargarProveedoresSelect('edit-producto-proveedor', p.id_proveedor);

        const form = document.getElementById('form-editar-producto');
        form.onsubmit = async e => {
          e.preventDefault();

          const nombre = inputNombre.value.trim();
          if (!nombre) {
            mostrarNotificacion('El nombre del producto no puede estar vacío.', 'error');
            return;
          }
          if (nombre.length > 50) {
            mostrarNotificacion('El nombre del producto no puede exceder 50 caracteres.', 'error');
            return;
          }

          const formData = new FormData();
          formData.append('nombre_producto', nombre);
          formData.append('id_categoria', document.getElementById('edit-producto-categoria').value);
          formData.append('id_proveedor', document.getElementById('edit-producto-proveedor').value);

          if (imagenInput.files && imagenInput.files[0]) {
            formData.append('imagen_producto', imagenInput.files[0]);
          } else if (removeImageFlag) {
            formData.append('remove_image', 'true');
          }

          const resp = await fetch(`/api/admin/productos/${id}`, {
            method: 'PUT',
            credentials: 'same-origin',
            body: formData
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

        const inputNombre = document.getElementById('edit-nombre');
        const inputTelefono = document.getElementById('edit-telefono');
        const inputCorreo = document.getElementById('edit-correo');
        const inputDireccion = document.getElementById('edit-direccion');

        inputNombre.value = p.nombre_proveedor;
        inputTelefono.value = p.telefono || '';
        inputCorreo.value = p.correo || '';
        inputDireccion.value = p.direccion || '';

        // --- Restricciones de longitud ---
        inputNombre.maxLength = 50;
        inputTelefono.maxLength = 20;
        inputCorreo.maxLength = 40;
        inputDireccion.maxLength = 100;

        // --- Validaciones de tipo de carácter ---
        inputNombre.addEventListener('input', () => {
          inputNombre.value = inputNombre.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, '');
        });

        inputTelefono.addEventListener('input', () => {
          inputTelefono.value = inputTelefono.value.replace(/[^0-9+\-\s]/g, '');
        });

        inputDireccion.addEventListener('input', () => {
          inputDireccion.value = inputDireccion.value.replace(/[^A-Za-z0-9ÁÉÍÓÚáéíóúÑñ.,#\-\s]/g, '');
        });

        const form = document.getElementById('form-editar-proveedor');
        form.onsubmit = async e => {
          e.preventDefault();

          const nombre = inputNombre.value.trim();
          const correo = inputCorreo.value.trim();

          // Validaciones extra
          if (!nombre) {
            mostrarNotificacion('El nombre del proveedor no puede estar vacío.', 'error');
            return;
          }
          if (nombre.length > 50) {
            mostrarNotificacion('El nombre no puede exceder 50 caracteres.', 'error');
            return;
          }
          if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            mostrarNotificacion('El formato del correo no es válido.', 'error');
            return;
          }

          const data = {
            nombre_proveedor: nombre,
            telefono: inputTelefono.value.trim(),
            correo,
            direccion: inputDireccion.value.trim()
          };

          const resp = await fetch(`/api/admin/proveedores/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(data)
          });

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

    // --- Modal de añadir proveedor
    async function openAddSupplierModal() {
      const modal = document.getElementById('modal-agregar-proveedor');
      setupModalCloseListeners(modal);
      modal.style.display = 'flex';

      const form = document.getElementById('form-agregar-proveedor');
      form.reset();

      const inputNombre = document.getElementById('nuevo-proveedor-nombre');
      const inputTelefono = document.getElementById('nuevo-proveedor-telefono');
      const inputCorreo = document.getElementById('nuevo-proveedor-correo');
      const inputDireccion = document.getElementById('nuevo-proveedor-direccion');

      // --- Restricciones de longitud ---
      inputNombre.maxLength = 50;
      inputTelefono.maxLength = 20;
      inputCorreo.maxLength = 40;
      inputDireccion.maxLength = 100;

      // --- Validaciones de tipo de carácter ---
      inputNombre.addEventListener('input', () => {
        inputNombre.value = inputNombre.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, '');
      });

      inputTelefono.addEventListener('input', () => {
        inputTelefono.value = inputTelefono.value.replace(/[^0-9+\-\s]/g, '');
      });

      inputDireccion.addEventListener('input', () => {
        inputDireccion.value = inputDireccion.value.replace(/[^A-Za-z0-9ÁÉÍÓÚáéíóúÑñ.,#\-\s]/g, '');
      });

      form.onsubmit = async e => {
        e.preventDefault();

        const nombre = inputNombre.value.trim();
        const correo = inputCorreo.value.trim();

        // Validaciones extra
        if (!nombre) {
          mostrarNotificacion('El nombre del proveedor no puede estar vacío.', 'error');
          return;
        }
        if (nombre.length > 50) {
          mostrarNotificacion('El nombre no puede exceder 50 caracteres.', 'error');
          return;
        }
        if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
          mostrarNotificacion('El formato del correo no es válido.', 'error');
          return;
        }

        const data = {
          nombre_proveedor: nombre,
          telefono: inputTelefono.value.trim(),
          correo,
          direccion: inputDireccion.value.trim()
        };

        try {
          const res = await fetch('/api/admin/proveedores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(data)
          });

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

    // Botón específico para la subida de Excel
    const confirmBtn = document.getElementById('btn-confirm-excel-upload');

    inputElement.addEventListener('change', () => {
      if (inputElement.files && inputElement.files.length > 0) {
        const fileName = inputElement.files[0].name;
        displayElement.textContent = fileName.length > 30 ? `${fileName.substring(0, 27)}...` : fileName;
        
        // Si es el input de Excel, mostramos el botón de confirmación
        if (inputId === 'excelProductos' && confirmBtn) {
          confirmBtn.style.display = 'inline-flex';
          // Asignamos el evento de subida al botón
          confirmBtn.onclick = () => subirExcelProductos(inputElement.files[0]);
        }
      } else {
        displayElement.textContent = '';
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

    await cargarCategoriasSelect('nuevo-producto-categoria');
    await cargarProveedoresSelect('nuevo-producto-proveedor');

    addFormatHint('nuevo-producto-imagen');
    setupFileInputListener('nuevo-producto-imagen', 'nuevo-producto-filename');

    const inputNombre = document.getElementById('nuevo-producto-nombre');
    inputNombre.maxLength = 50; // Restricción de longitud

    // Permitir solo caracteres válidos
    inputNombre.addEventListener('input', () => {
      const regex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]*$/;
      if (!regex.test(inputNombre.value)) {
        inputNombre.value = inputNombre.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, '');
        mostrarNotificacion('Solo se permiten letras y espacios en el nombre.', 'advertencia');
      }
    });

    const form = document.getElementById('form-agregar-producto');
    form.onsubmit = async e => {
      e.preventDefault();

      const nombre = inputNombre.value.trim();
      if (!nombre) {
        mostrarNotificacion('El nombre del producto no puede estar vacío.', 'error');
        return;
      }
      if (nombre.length > 50) {
        mostrarNotificacion('El nombre del producto no puede exceder 50 caracteres.', 'error');
        return;
      }

      const formData = new FormData();
      formData.append('nombre_producto', nombre);
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
          body: formData
        });

        const result = await res.json();
        if (res.ok) {
          mostrarNotificacion('Producto agregado correctamente.', 'exito');
          modal.style.display = 'none';
          loadProductos();
        } else {
          mostrarNotificacion('Error al agregar producto: ' + (result.mensaje || 'Error desconocido'), 'error');
        }
      } catch (err) {
        console.error(err);
        if (err.message.includes('Formato de archivo no válido')) {
          mostrarNotificacion('Formato de archivo no válido. Solo se permiten imágenes.', 'error');
        } else {
          mostrarNotificacion('Error al agregar producto: ' + err.message, 'error');
        }
      }
    };
  }

  // === MODAL: EDITAR CATEGORÍA ===
  async function openEditCategoryModal(id) {
    try {
      const res = await fetch(`/api/admin/categorias/${id}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Categoría no encontrada');
      const categoria = await res.json();

      const modal = document.getElementById('modal-editar-categoria');
      setupModalCloseListeners(modal);
      modal.style.display = 'flex';

      // Cargar datos en el formulario
      document.getElementById('edit-categoria-id').value = categoria.id_categoria;
      document.getElementById('edit-categoria-nombre').value = categoria.nombre_categoria;

      // Validaciones de entrada
      const nombreInput = document.getElementById('edit-categoria-nombre');
      nombreInput.addEventListener('input', e => {
        // Máximo 50 caracteres
        if (e.target.value.length > 50) {
          e.target.value = e.target.value.slice(0, 50);
        }
        // Solo letras y espacios
        e.target.value = e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, '');
      });

      const form = document.getElementById('form-editar-categoria');
      form.onsubmit = async e => {
        e.preventDefault();
        const nombre = nombreInput.value.trim();

        if (!nombre) {
          mostrarNotificacion('El nombre no puede estar vacío.', 'error');
          return;
        }

        try {
          const resp = await fetch(`/api/admin/categorias/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ nombre_categoria: nombre })
          });

          const result = await resp.json();
          if (resp.ok) {
            mostrarNotificacion('Categoría actualizada correctamente.', 'exito');
            modal.style.display = 'none';
            loadCategorias();
          } else {
            mostrarNotificacion(result.mensaje || 'Error al actualizar categoría', 'error');
          }
        } catch (err) {
          console.error('Error al actualizar categoría:', err);
          mostrarNotificacion('Error al actualizar categoría.', 'error');
        }
      };
    } catch (err) {
      console.error('Error al cargar datos de la categoría:', err);
      mostrarNotificacion('Error al cargar datos de la categoría.', 'error');
    }
  }

  // === MODAL: AGREGAR NUEVA CATEGORÍA ===
  async function openAddCategoryModal() {
    const modal = document.getElementById('modal-agregar-categoria');
    setupModalCloseListeners(modal);
    modal.style.display = 'flex';

    const form = document.getElementById('form-agregar-categoria');
    form.reset();

    const nombreInput = document.getElementById('nueva-categoria-nombre');
    nombreInput.addEventListener('input', e => {
      // Máximo 50 caracteres
      if (e.target.value.length > 50) {
        e.target.value = e.target.value.slice(0, 50);
      }
      // Solo letras y espacios
      e.target.value = e.target.value.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, '');
    });

    form.onsubmit = async e => {
      e.preventDefault();
      const nombre = nombreInput.value.trim();

      if (!nombre) {
        mostrarNotificacion('El nombre de la categoría no puede estar vacío.', 'error');
        return;
      }

      try {
        const res = await fetch('/api/admin/categorias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ nombre_categoria: nombre })
        });

        const result = await res.json();
        if (res.ok) {
          mostrarNotificacion('Categoría agregada correctamente.', 'exito');
          modal.style.display = 'none';
          loadCategorias();
        } else {
          mostrarNotificacion(result.mensaje || 'Error al agregar categoría.', 'error');
        }
      } catch (err) {
        console.error('Error al agregar categoría:', err);
        mostrarNotificacion('Error al agregar categoría.', 'error');
      }
    };
  }

  // --- Subir categorías desde Excel ---
  async function subirExcelCategorias(file) {
    const formData = new FormData();
    const confirmBtn = document.getElementById('btn-confirm-excel-upload');
    if (confirmBtn) confirmBtn.disabled = true;

    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/categorias/upload', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });
      const data = await res.json();
      mostrarNotificacion(data.mensaje, res.ok ? 'exito' : 'error');
      loadCategorias();
    } catch (err) {
      console.error('Error al subir Excel de categorías:', err);
      mostrarNotificacion('Error al subir Excel de categorías.', 'error');
    } finally {
      if (confirmBtn) {
        confirmBtn.style.display = 'none';
        confirmBtn.disabled = false;
      }
      const fileNameDisplay = document.getElementById('excel-categorias-filename');
      if (fileNameDisplay) fileNameDisplay.textContent = '';
      document.getElementById('excelCategorias').value = '';
    }
  }

  // --- Añadir productos desde excel ---
  window.subirExcelProductos = async function (file) {
    const formData = new FormData();
    const confirmBtn = document.getElementById('btn-confirm-excel-upload');
    if (confirmBtn) confirmBtn.disabled = true; // Evita doble clic

    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/productos/upload', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('Respuesta inválida del servidor');
      }

      if (res.ok) {
        // ✅ Carga exitosa
        const resumen = data.resumen
          ? ` (${data.resumen.insertados} insertados, ${data.resumen.duplicados} duplicados, ${data.resumen.omitidos} omitidos)`
          : '';
        mostrarNotificacion(`Carga completada correctamente${resumen}.`, 'exito');
        await loadProductos();
      } else {
        // ⚠️ Carga con errores de validación u otro tipo
        console.warn('Errores durante la carga Excel:', data.errores || data);
        const errores = data.errores
          ? '\n- ' + data.errores.join('\n- ')
          : '';
        mostrarNotificacion(`${data.mensaje || 'Error al cargar Excel.'}${errores}`, 'error');
      }

    } catch (err) {
      console.error('Error al subir Excel de productos:', err);
      mostrarNotificacion('Error al subir Excel de productos: ' + err.message, 'error');
    } finally {
      if (confirmBtn) {
        confirmBtn.style.display = 'none';
        confirmBtn.disabled = false;
      }
      const fileNameDisplay = document.getElementById('excel-productos-filename');
      if (fileNameDisplay) fileNameDisplay.textContent = '';
      document.getElementById('excelProductos').value = '';
    }
  };

  // --- Añadir proveedores desde excel ---
  window.subirExcelProveedores = async function (file) {
    const formData = new FormData();
    formData.append('file', file);
    // Asumiendo que tienes un span con id="excel-proveedores-filename" en admin-suppliers.html
    const fileNameDisplay = document.getElementById('excel-proveedores-filename');
    if (fileNameDisplay) fileNameDisplay.textContent = file.name;

    try {
      const res = await fetch('/api/admin/proveedores/upload', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });
      const data = await res.json();
      mostrarNotificacion(data.mensaje, res.ok ? 'exito' : 'error');
      loadProveedores();
    } catch (err) {
      console.error('Error al subir Excel de proveedores:', err);
      mostrarNotificacion('Error al subir Excel de proveedores.', 'error');
    } finally {
      if (fileNameDisplay) {
        setTimeout(() => { fileNameDisplay.textContent = ''; }, 4000);
      }
    }
  }

  // --- Añadir categorías desde Excel ---
  window.subirExcelCategorias = async function (file) {
    const formData = new FormData();
    const confirmBtn = document.getElementById('btn-confirm-excel-upload');
    if (confirmBtn) confirmBtn.disabled = true;

    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/categorias/upload', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });
      const data = await res.json();
      mostrarNotificacion(data.mensaje, res.ok ? 'exito' : 'error');
      loadCategorias(); // Recargar tabla de categorías
    } catch (err) {
      console.error('Error al subir Excel de categorías:', err);
      mostrarNotificacion('Error al subir Excel de categorías.', 'error');
    } finally {
      if (confirmBtn) {
        confirmBtn.style.display = 'none';
        confirmBtn.disabled = false;
      }
      const fileNameDisplay = document.getElementById('excel-categorias-filename');
      if (fileNameDisplay) fileNameDisplay.textContent = '';
      document.getElementById('excelCategorias').value = ''; // Limpiar input
    }
  };

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
