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

  // Sanitiza un valor de precio para permitir hasta 12 dígitos enteros y 2 decimales.
  function sanitizePriceValue(val) {
    if (typeof val !== 'string') val = String(val || '');
    // Eliminar caracteres no válidos (todo lo que no sea dígito o punto)
    val = val.replace(/[^0-9.]/g, '');
    // Limpiar ceros a la izquierda de la parte entera
    const firstParts = val.split('.');
    firstParts[0] = firstParts[0].replace(/^0+(?=\d)/, '') || '0';
    // Detectar si el usuario está escribiendo un punto al final (ej: "123.")
    const hasTrailingDot = val.endsWith('.');
    // Si hay más de un punto, mantener sólo el primero
    const parts = firstParts;
    if (parts.length > 1) {
      const intPart = parts[0].slice(0, 12);
      const decPart = parts.slice(1).join('').slice(0, 2);
      if (decPart.length > 0) return `${intPart}.${decPart}`;
      if (hasTrailingDot) return `${intPart}.`;
      return intPart;
    }
    // Sin parte decimal
    return parts[0].slice(0, 12);
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
          const resp = await fetch(`/api/panel/${section}`, { credentials: 'same-origin' });
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
          if (section === 'client-quotes.html') loadClientQuotes();
          if (section === 'admin-quotes.html') loadCotizaciones();

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
          <li><a href="#" class="nav-link" data-section="admin-quotes.html"><i class="fa-solid fa-file-invoice-dollar"></i> Cotizaciones</a></li>
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

      const resp = await fetch(`/api/panel/${modalFile}`, { credentials: 'same-origin' });
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
      // Filtrar para mostrar solo categorías activas (estado = 1)
      cachedCategories.filter(c => c.estado === 1).forEach(c => {
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
        // Filtrar para mostrar solo proveedores activos (estado = 1)
        cachedSuppliers.filter(p => p.estado === 1).forEach(proveedor => {
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

    // --- Cargar cotizaciones del cliente ---
    async function loadClientQuotes() {
      try {
        const res = await fetch('/api/quotes', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('No se pudieron obtener tus cotizaciones');
        const quotes = await res.json();

        const tbody = document.getElementById('quotesTableBody');
        if (!tbody) return;

        if (quotes.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">Aún no has generado ninguna cotización.</td></tr>';
          return;
        }

        tbody.innerHTML = quotes.map(q => {
          // Formatear la fecha para asegurar consistencia
          const fecha = new Date(q.fecha_cotizacion).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
          const estadoClass = (q.estado_cotizacion || 'pendiente').toLowerCase().replace(/\s+/g, '-');
          const totalFormateado = q.total != null ? `$${Number(q.total).toFixed(2)}` : '—';
          // El botón de descarga solo aparece si el estado es 'Devuelta'
          const botonDescarga = q.estado_cotizacion === 'Devuelta'
            ? `<button class="btn-download-pdf" data-id="${q.id_cotizacion}" title="Descargar PDF"><i class="fa-solid fa-file-pdf"></i></button>`
            : '';

          return `
            <tr>
              <td>#${String(q.id_cotizacion).padStart(6, '0')}</td>
              <td>${fecha}</td>
              <td><span class="status-badge status-${estadoClass}">${q.estado_cotizacion}</span></td>
              <td>${totalFormateado}</td>
              <td>
                <button class="btn-edit-quote" data-id="${q.id_cotizacion}" title="Ver Detalles"><i class="fa-solid fa-pen"></i></button>
                ${botonDescarga}
              </td>
            </tr>
          `;
        }).join('');

        // Delegación de eventos para los botones de la tabla de cotizaciones del cliente
        tbody.onclick = (e) => {
          const editBtn = e.target.closest('.btn-edit-quote');
          if (editBtn) openClientQuoteModal(editBtn.dataset.id);

          const pdfBtn = e.target.closest('.btn-download-pdf');
          if (pdfBtn) {
            const quoteId = pdfBtn.dataset.id;
            const row = pdfBtn.closest('tr');
            const quoteDate = row.cells[1].textContent;
            const quoteTotal = row.cells[3].textContent;

            pdfBtn.disabled = true;
            pdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; // Icono de carga

            generateQuotePDF(quoteId, quoteDate, quoteTotal).finally(() => {
              pdfBtn.disabled = false;
              pdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i>'; // Restaurar icono
            });
          }
        };
      } catch (err) {
        mostrarNotificacion('Error cargando cotizaciones: ' + err.message, 'error');
      }
    }

    /**
     * Carga dinámicamente las librerías necesarias para generar PDFs.
     * Solo se ejecuta una vez.
     */
    let pdfLibrariesLoaded = false;
    async function loadPdfLibraries() {
      if (pdfLibrariesLoaded) return;

      const loadScript = (src) => {
        return new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${src}"]`)) {
            return resolve();
          }
          const script = document.createElement('script');
          script.src = src;
          script.onload = resolve;
          script.onerror = () => reject(new Error(`No se pudo cargar el script: ${src}`));
          document.head.appendChild(script);
        });
      };

      try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js");
        pdfLibrariesLoaded = true;
      } catch (error) {
        throw new Error("No se pudieron cargar las librerías para generar el PDF.");
      }
    }

    /**
     * Obtiene los detalles de una cotización (productos, etc.) desde el backend.
     * NOTA: Necesitas crear este endpoint en tu servidor.
     */
    async function fetchQuoteDetails(quoteId) {
      try {
        const res = await fetch(`/api/quotes/${quoteId}/details`, { credentials: 'same-origin' });
        if (!res.ok) {
          throw new Error('No se pudieron obtener los detalles de la cotización.');
        }
        const data = await res.json();
        if (!data.detalles || !data.cliente) throw new Error('La respuesta del servidor no tiene el formato esperado.');
        return data;
      } catch (error) {
        console.error(`Error en fetchQuoteDetails para ${quoteId}:`, error);
        mostrarNotificacion(error.message, 'error');
        return null; // Devolver null en caso de error
      }
    }

    /**
     * Genera un PDF para una cotización específica.
     */
    async function generateQuotePDF(quoteId, quoteDate, quoteTotal) {
      try {
        // 1. Asegurarse de que las librerías estén cargadas
        await loadPdfLibraries();
      } catch (error) {
        mostrarNotificacion('Error: La librería jsPDF no está cargada.', 'error');
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      if (typeof doc.autoTable !== 'function') {
        mostrarNotificacion('Error: El plugin jsPDF-AutoTable no está cargado.', 'error');
        return;
      }

      // Obtener los datos ANTES de crear el PDF
      const quoteData = await fetchQuoteDetails(quoteId);
      if (!quoteData) {
        // fetchQuoteDetails ya mostró una notificación de error
        return;
      }
      const { detalles, cliente } = quoteData;
      const clientFullName = `${cliente.nombre || ''} ${cliente.paterno || ''} ${cliente.materno || ''}`.trim();

      try {
        // 2. Cargar el logo
        const logoUrl = '../Font/imgs/mount logo.png'; // Ruta relativa al HTML principal (dashboard.html)
        const logoImg = await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous"; // Necesario si la imagen está en un dominio diferente o para evitar problemas de CORS
            img.src = logoUrl;
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(new Error('No se pudo cargar el logo. Verifica la ruta y los permisos.'));
        });

        // --- NUEVA ESTRUCTURA DEL ENCABEZADO ---

        // 3. Título principal
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('COTIZACIÓN', 200, 20, { align: 'right' });

        // 4. Logo e Información de la empresa (izquierda)
        doc.addImage(logoImg, 'PNG', 15, 25, 40, 40);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Mount Servicios y Suministros Industriales', 65, 35);
        doc.setFont('helvetica', 'normal');
        doc.text('contacto@mount.com', 65, 41);
        doc.text('+52 123 456 7890', 65, 47);
        doc.text('Dirección de la Empresa, Ciudad, Estado, CP', 65, 53);

        // 5. Información de la cotización (derecha)
        doc.setFontSize(10);
        doc.text(`Folio: #${String(quoteId).padStart(6, '0')}`, 200, 35, { align: 'right' });
        doc.text(`Fecha: ${quoteDate}`, 200, 41, { align: 'right' });

        // 6. Información del cliente
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('CLIENTE:', 15, 75);
        doc.setFont('helvetica', 'normal');
        doc.text(clientFullName, 15, 81);
        doc.text(cliente.correo, 15, 87);

        // 7. Tabla de productos
        const tableData = detalles.map(item => [item.nombre_producto, item.cantidad, `$${Number(item.precio_unitario || 0).toFixed(2)}`, `$${(item.cantidad * (item.precio_unitario || 0)).toFixed(2)}`]);

        doc.autoTable({
          startY: 95,
          head: [['Producto', 'Cantidad', 'Precio Unitario', 'Subtotal']],
          body: tableData,
          foot: [['', '', 'Total', quoteTotal]],
          theme: 'striped',
          headStyles: { fillColor: [41, 128, 185], textColor: 255 },
          footStyles: { fillColor: [236, 240, 241], textColor: 44, fontStyle: 'bold' },
          didDrawPage: function (data) {
            // Pie de página
            const pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text(
              `Página ${data.pageNumber} de ${pageCount}`,
              data.settings.margin.left,
              doc.internal.pageSize.height - 10
            );
          }
        });

        // 8. Guardar el PDF
        doc.save(`Cotizacion-${String(quoteId).padStart(6, '0')}.pdf`);
      } catch (error) {
        console.error('Error al generar el PDF:', error);
        mostrarNotificacion(error.message || 'No se pudo generar el PDF.', 'error');
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
              const isVisible = name.includes(searchTerm) || id.includes(searchTerm);
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

        const emailInput = document.getElementById('edit-correo');
        emailInput.addEventListener('input', () => validateAndDisplayEmailError(emailInput));

        const form = document.getElementById('form-editar-proveedor');
        form.onsubmit = async e => {
          e.preventDefault();
          if (!validateAndDisplayEmailError(document.getElementById('edit-correo'))) {
            return;
          }

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

    const emailInput = document.getElementById('nuevo-proveedor-correo');
    emailInput.addEventListener('input', () => validateAndDisplayEmailError(emailInput));

    form.onsubmit = async e => {
      e.preventDefault();
      if (!validateAndDisplayEmailError(document.getElementById('nuevo-proveedor-correo'))) {
        return;
      }

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
  
  function validateAndDisplayEmailError(emailInput) {
    const email = emailInput.value.trim();
    // This regex is a widely accepted standard that is more robust
    // and covers a wider range of valid email formats.

    // ← Limpia cualquier error antes de evaluar
    emailInput.setCustomValidity("");

      if (email === "") {
        emailInput.setCustomValidity("El correo electrónico es obligatorio.");
        emailInput.reportValidity();
        return false;
    }

    // 2. Debe contener @
    if (!email.includes("@")) {
        emailInput.setCustomValidity('Incluye un signo "@" en la dirección de correo electrónico.');
        emailInput.reportValidity();
        return false;
    }

    // Dividir en parte local y dominio
    const [localPart, dominio] = email.split("@");

    // 3. Debe haber texto después del @
    if (!dominio || dominio.trim() === "") {
        emailInput.setCustomValidity(`Ingresa texto después del signo "@". La dirección "${email}" está incompleta.`);
        emailInput.reportValidity();
        return false;
    }

    // 4. Validar extensión 
    const extensionesPermitidas = [".com", ".net", ".org", ".edu", ".mx", ".gov"];

    const tieneExtensionValida = extensionesPermitidas.some(ext =>
        dominio.toLowerCase().endsWith(ext)
    );

    if (!tieneExtensionValida) {
        emailInput.setCustomValidity(
            "El correo debe terminar con una extensión válida: " + extensionesPermitidas.join(", ")
        );
        emailInput.reportValidity();
        return false;
    }

    // 5. Validación general del formato del email (solo si todo lo anterior pasa)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(email)) {
        emailInput.setCustomValidity("El formato del correo electrónico no es válido.");
        emailInput.reportValidity();
        return false;
    }

      // Email válido, limpiar mensaje
      emailInput.setCustomValidity("");
      return true;
  }


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
      confirmBtnId = 'btn-confirm-excel-upload-productos'; // Este es el de productos
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
          mostrarNotificacion('Se agregó el producto.', 'exito');
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

  async function loadCotizaciones() {
  try {
    const res = await fetch('/api/admin/cotizaciones', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('No se pudieron obtener las cotizaciones');
    const cotizaciones = await res.json();

    const tbody = document.querySelector('#quotesTable tbody');
    if (!tbody) return;

    tbody.innerHTML = cotizaciones.map(c => {
      return `
        <tr>
          <td>${c.id_cotizacion}</td>
          <td>${c.correo_usuario}</td>
          <td>${new Date(c.fecha_cotizacion).toLocaleString()}</td>
          <td>${c.estado_cotizacion}</td>
          <td>$${c.total == null ? '—' : Number(c.total).toFixed(2)}</td>
          <td>
            <button class="btn-edit-quote" data-id="${c.id_cotizacion}"><i class="fa-solid fa-pen"></i></button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.onclick = (e) => {
      const btn = e.target.closest('.btn-edit-quote');
      if (btn) openEditQuoteModal(btn.dataset.id);
    };

  } catch (err) {
    console.error(err);
    mostrarNotificacion('Error al cargar cotizaciones: ' + err.message, 'error');
  }
}

// ---- Abrir modal y cargar detalles ----
async function openEditQuoteModal(id) {
  try {
    // Mostrar modal
    const modal = document.getElementById('modal-editar-cotizacion');
    if (!modal) throw new Error('Modal no encontrado');
    
    setupModalCloseListeners(modal);
    modal.style.display = 'flex';
    
    const idLabel = document.getElementById('cot-id-label');
    if (idLabel) idLabel.textContent = `#${id}`;

    // Obtener detalles
    const res = await fetch(`/api/admin/cotizaciones/${id}/detalles`, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('No se pudieron obtener los detalles');
    const detalles = await res.json();

    const tbody = document.querySelector('#cotdetalleTable tbody');
    if (!tbody) throw new Error('Tabla de detalles no encontrada');
    
    tbody.innerHTML = detalles.map(d => `
      <tr data-id-detalle="${d.id_detalle}" data-cantidad-anterior="${d.cantidad}">
        <td style="display:flex;align-items:center;gap:8px;">
          ${d.ruta_imagen ? `<img src="${d.ruta_imagen}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">` : ''}
          <span>${d.nombre_producto}</span>
        </td>
        <td>
          ${
            // Si la cantidad actual es diferente de la anterior (guardada en subtotal), mostrar icono.
            // Comparamos `d.cantidad` con `d.subtotal` que es donde guardamos la cantidad vieja.
            d.subtotal != null && d.cantidad != d.subtotal
            ? `<span class="change-indicator" title="El cliente cambió la cantidad de ${parseInt(d.subtotal, 10)} a ${d.cantidad}">
                 <i class="fa-solid fa-triangle-exclamation"></i>
               </span>` 
            : ''
          }
             <input type="number" class="input-cantidad" value="${d.cantidad}" min="1" max="100" step="1" pattern="\\d+" inputmode="numeric"
               oninput="this.value = this.value.replace(/[^0-9]/g, ''); if (parseInt(this.value, 10) > 100) this.value = 100;"
               style="width:70px;padding:6px;text-align:center;border:1px solid #ccc;border-radius:6px;" />
        </td>
        <td>
          <input type="text" inputmode="decimal" class="input-precio" maxlength="15" pattern="^\\d{1,12}(\\.\\d{1,2})?$"
            value="${d.precio_unitario == null ? '' : Number(d.precio_unitario).toFixed(2)}"
            style="width:180px;max-width:40vw;padding:6px;border:1px solid #ccc;border-radius:6px;" />
        </td>
        <td class="td-subtotal">
          ${d.subtotal == null ? '-' : Number(d.subtotal).toFixed(2)}
        </td>
      </tr>
    `).join('');

    // --- CÁLCULO INICIAL DE SUBTOTALES ---
    // Función para calcular el subtotal de una fila
    const calcularSubtotalFila = (tr) => {
      const cantidad = Number(tr.querySelector('.input-cantidad').value);
      const precio = parseFloat(tr.querySelector('.input-precio').value);
      const tdSubtotal = tr.querySelector('.td-subtotal');

      if (tdSubtotal && !isNaN(cantidad) && !isNaN(precio)) {
        tdSubtotal.textContent = (cantidad * precio).toFixed(2);
      } else if (tdSubtotal) {
        tdSubtotal.textContent = '-';
      }
    };

    // Calcular todos los subtotales al abrir el modal
    tbody.querySelectorAll('tr').forEach(calcularSubtotalFila);

    /* ====== LISTENERS PARA RECÁLCULO DINÁMICO ====== */
    tbody.querySelectorAll('.input-precio, .input-cantidad').forEach(input => {
      input.addEventListener('input', e => {
        const tr = e.target.closest('tr');
        if (!tr) return;

        // Sanitizar precio si el target es un input-precio
        const precioInput = tr.querySelector('.input-precio');
        if (precioInput) {
          const sanitized = sanitizePriceValue(precioInput.value);
          if (precioInput.value !== sanitized) precioInput.value = sanitized;
        }

        // Asegurar cantidad entera
        const cantidadInput = tr.querySelector('.input-cantidad');
        if (cantidadInput) {
          cantidadInput.value = String(cantidadInput.value).replace(/[^0-9]/g, '');
          if (cantidadInput.value === '') cantidadInput.value = 0;
          // respetar max si existe
          const max = parseInt(cantidadInput.getAttribute('max'), 10);
          if (!isNaN(max) && parseInt(cantidadInput.value, 10) > max) cantidadInput.value = max;
        }

        const cantidad = Number(cantidadInput ? cantidadInput.value : 0);
        const precio = parseFloat(precioInput ? precioInput.value : NaN);
        const tdSubtotal = tr.querySelector('.td-subtotal');

        if (tdSubtotal) {
          if (!isNaN(precio) && !isNaN(cantidad) && cantidad > 0) {
            const subtotal = cantidad * precio;
            tdSubtotal.textContent = subtotal.toFixed(2);
          } else {
            tdSubtotal.textContent = '-';
          }
        }

        // Llamar a la función que recalcula el total general
        recalcTotal();
      });
    });

    // Añadir manejo de pegado y blur específicamente para inputs de precio
    tbody.querySelectorAll('.input-precio').forEach(pi => {
      pi.addEventListener('paste', e => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text') || '';
        const sanitized = sanitizePriceValue(pasted);
        pi.value = sanitized;
        // disparar evento input manualmente para recalcular
        pi.dispatchEvent(new Event('input', { bubbles: true }));
      });

      pi.addEventListener('blur', e => {
        const v = sanitizePriceValue(pi.value);
        if (v === '') { pi.value = ''; return; }
        // Formatear a 2 decimales si tiene parte decimal o si se requiere
        const num = parseFloat(v);
        if (!isNaN(num)) pi.value = num.toFixed(2);
      });
    });

    recalcTotal();

    /* ====== GUARDAR ====== */
    const btnSave = document.getElementById('btn-save-cot');
    if (btnSave) {
      btnSave.onclick = async () => {
        const rows = tbody.querySelectorAll('tr');
        const payload = [];
        let isValid = true;

        // --- NUEVA VALIDACIÓN AL GUARDAR ---
        for (const tr of rows) {
          const precioInput = tr.querySelector('.input-precio');
          precioInput.style.borderColor = '#ccc'; // Resetear borde
          const precio = precioInput.value.trim();

          // Expresión regular para 1-12 enteros y hasta 2 decimales
          const precioRegex = /^\d{1,12}(\.\d{1,2})?$/;

          if (precio !== '' && !precioRegex.test(precio)) {
            precioInput.style.borderColor = 'red';
            isValid = false;
          }
        }

        if (!isValid) {
          mostrarNotificacion('Formato de precio incorrecto. Debe tener hasta 12 dígitos enteros y 2 decimales.', 'error');
          return; // Detener el guardado
        }
        // --- FIN DE LA VALIDACIÓN ---

        rows.forEach(tr => {
          const id_detalle = Number(tr.dataset.idDetalle);
          const precioInput = tr.querySelector('.input-precio');
          const cantidadInput = tr.querySelector('.input-cantidad');
          const subtotalCell = tr.querySelector('.td-subtotal');
          
          if (precioInput && subtotalCell && cantidadInput) {
            const precio = precioInput.value.trim();
            const subtotalText = subtotalCell.textContent.trim();

            payload.push({
              id_detalle,
              cantidad: parseInt(cantidadInput.value, 10) || 0,
              precio_unitario: precio === '' ? null : parseFloat(precio),
              subtotal: subtotalText === '-' ? null : parseFloat(subtotalText)
            });
          }
        });

        try {
          const r = await fetch(`/api/admin/cotizaciones/${id}/detalles/update`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const result = await r.json();
          if (r.ok) {
            mostrarNotificacion(result.mensaje || 'Detalles guardados', 'exito');
            modal.style.display = 'none';
            loadCotizaciones();
          } else {
            mostrarNotificacion(result.mensaje || 'Error al guardar', 'error');
          }
        } catch (err) {
          mostrarNotificacion('Error al guardar: ' + err.message, 'error');
        }
      };
    }

    /* ====== MARCAR COMO DEVUELTA ====== */
    const btnMarkReturned = document.getElementById('btn-mark-returned');
    if (btnMarkReturned) {
      btnMarkReturned.onclick = async () => {
        try {
          const r = await fetch(`/api/admin/cotizaciones/${id}/mark-returned`, {
            method: 'POST',
            credentials: 'same-origin'
          });

          const result = await r.json();
          if (r.ok) {
            mostrarNotificacion(result.mensaje, 'exito');
            modal.style.display = 'none';
            loadCotizaciones();
          } else {
            mostrarNotificacion(result.mensaje, 'error');
          }
        } catch (err) {
          mostrarNotificacion('Error marcando como devuelta', 'error');
        }
      };
    }

  } catch (err) {
    mostrarNotificacion('Error cargando cotización: ' + err.message, 'error');
    console.error(err);
  }
}

function recalcTotal() {
  let total = 0;
  const rows = document.querySelectorAll('#cotdetalleTable tbody tr');
  rows.forEach(tr => {
    const subtotalCell = tr.querySelector('.td-subtotal');
    if (subtotalCell) {
      const txt = subtotalCell.textContent.trim();
      const val = parseFloat(txt);
      if (!isNaN(val)) total += val;
    }
  });

  const totalSpan = document.getElementById('cot-total');
  if (totalSpan) totalSpan.textContent = total.toFixed(2);
}

// --- Recalcular total para el modal de edición del cliente ---
function recalcClientQuoteTotal() {
  let total = 0;
  const modal = document.getElementById('modal-editar-cotizacion-cliente');
  if (!modal) return;

  // --- INYECTAR ADVERTENCIA SI NO EXISTE ---
  // Asegurarnos de que el div de advertencia esté presente en el modal.
  let warningDiv = modal.querySelector('.quote-change-warning');
  if (!warningDiv) {
    warningDiv = document.createElement('div');
    warningDiv.className = 'quote-change-warning';
    warningDiv.style.display = 'none'; // Oculto por defecto
    warningDiv.innerHTML = `
      <i class="fa-solid fa-circle-info"></i>
      <span>Al modificar la cotización, el total cambiará y los precios unitarios podrían ser ajustados por un administrador durante la revisión.</span>
    `;
    // Insertarlo antes de los botones de acción
    const modalActions = modal.querySelector('.modal-actions');
    if (modalActions) modalActions.before(warningDiv);
  }

  modal.querySelectorAll('#clientCotdetalleTable tbody tr').forEach(tr => {
    const priceText = tr.querySelector('td:nth-child(3)').textContent.replace('$', '').trim();
    const quantityInput = tr.querySelector('.input-quantity-quote');
    
    if (!isNaN(parseFloat(priceText)) && quantityInput && quantityInput.value > 0) {
      const subtotal = parseFloat(priceText) * parseInt(quantityInput.value, 10);
      total += subtotal;
    }
  });
  
  const totalElement = modal.querySelector('#client-cot-total');
  if (totalElement) totalElement.textContent = total.toFixed(2);
}

// --- Abrir modal para ver detalles de cotización del cliente ---
async function openClientQuoteModal(id) {
  try {
    const modal = document.getElementById('modal-editar-cotizacion-cliente');
    if (!modal) throw new Error('Modal no encontrado');

    // --- INYECTAR ADVERTENCIA SI NO EXISTE ---
    // Asegurarnos de que el div de advertencia esté presente en el modal.
    let warningDiv = modal.querySelector('.quote-change-warning');
    if (!warningDiv) {
      warningDiv = document.createElement('div');
      warningDiv.className = 'quote-change-warning';
      warningDiv.innerHTML = `
        <i class="fa-solid fa-circle-info"></i>
        <span>Al modificar la cotización, el total cambiará y los precios unitarios podrían ser ajustados por un administrador durante la revisión.</span>
      `;
      const modalActions = modal.querySelector('.modal-actions');
      if (modalActions) modalActions.before(warningDiv);
    }
    
    const tbody = modal.querySelector('#clientCotdetalleTable tbody');
    if (!tbody) throw new Error('Tabla del modal no encontrada');

    // Configurar botones de cierre
    const saveButton = modal.querySelector('#btn-save-client-cot');
    const btnCancel = modal.querySelector('#btn-cancel-client-cot');
    if (btnCancel) btnCancel.onclick = () => modal.style.display = 'none';
    setupModalCloseListeners(modal);

    // Ocultar la advertencia al abrir el modal
    if (warningDiv) warningDiv.style.display = 'none';
    
    // Deshabilitar el botón de guardar por defecto
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.style.opacity = '0.6';
      saveButton.style.cursor = 'not-allowed';
    }
    const enableSaveButton = () => {
      if (saveButton && saveButton.disabled) {
        saveButton.disabled = false;
        saveButton.style.opacity = '1';
        saveButton.style.cursor = 'pointer';
      }
    };
    // Mostrar modal y preparar
    modal.style.display = 'flex';
    modal.querySelector('#client-cot-id-label').textContent = `#${String(id).padStart(6, '0')}`;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando...</td></tr>';
    
    // Array para rastrear eliminados
    let deletedDetails = [];

    // Obtener detalles
    const res = await fetch(`/api/quotes/${id}/details`, { credentials: 'same-origin' });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.mensaje || 'No se pudieron obtener los detalles de la cotización.');
    }
    const quoteData = await res.json();
    const details = quoteData.detalles; // Los detalles están dentro de la propiedad 'detalles'

    if (!details || !Array.isArray(details) || details.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Esta cotización no tiene productos.</td></tr>';
    } else {
      tbody.innerHTML = details.map(d => `
        <tr data-id-detalle="${d.id_detalle}">
          <td>${d.nombre_producto}</td>
          <td><input type="number" class="input-quantity-quote" value="${d.cantidad}" min="1" max="100" step="1" pattern="\\d+" inputmode="numeric" oninput="this.value = this.value.replace(/[^0-9]/g, ''); if (parseInt(this.value, 10) > 100) this.value = 100;" style="width: 70px; padding: 6px; text-align: center; border: 1px solid #ccc; border-radius: 6px;"></td>
          <td>$${Number(d.precio_unitario).toFixed(2)}</td>
          <td><button class="btn-delete-item-quote" title="Eliminar"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
      `).join('');
    }

    recalcClientQuoteTotal();

    // Eventos
    tbody.onclick = (e) => {
      const deleteBtn = e.target.closest('.btn-delete-item-quote');
      if (deleteBtn) {
        const row = deleteBtn.closest('tr');
        deletedDetails.push(row.dataset.idDetalle);
        row.remove();
        if (warningDiv) warningDiv.style.display = 'block'; // Mostrar advertencia
        enableSaveButton(); // Habilitar guardado
        recalcClientQuoteTotal();
      }
    };

    tbody.oninput = () => {
      // Al cambiar una cantidad, recalcular el total Y mostrar la advertencia.
      recalcClientQuoteTotal();
      enableSaveButton(); // Habilitar guardado
      if (warningDiv) warningDiv.style.display = 'block';
    };

    // Guardar cambios
    if(saveButton) saveButton.onclick = async () => {
      const updates = [];
      tbody.querySelectorAll('tr').forEach(row => {
        updates.push({
          id: row.dataset.idDetalle,
          cantidad: parseInt(row.querySelector('.input-quantity-quote').value, 10) || 0
        });
      });

      try {
        const saveRes = await fetch(`/api/quotes/${id}/update`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates, deletes: deletedDetails }),
          credentials: 'same-origin'
        });
        if (!saveRes.ok) throw new Error('Error al guardar');
        
        mostrarNotificacion('Cambios guardados.', 'exito');
        modal.style.display = 'none';
        // Recargar el panel de cotizaciones para reflejar todos los cambios,
        // incluyendo el estado y el total actualizado desde el servidor.
        const link = document.querySelector('a[data-section="client-quotes.html"]');
        if (link) showSection('client-quotes.html', link);
      } catch (err) {
        mostrarNotificacion(err.message, 'error');
      }
    };

  } catch (err) {
    mostrarNotificacion(err.message, 'error');
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
