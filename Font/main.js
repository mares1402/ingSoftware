document.addEventListener('DOMContentLoaded', () => {
  const productGrid = document.querySelector('.product-grid');
  const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
  const headerContent = document.querySelector('.header-content');
  const mobileFilterToggle = document.querySelector('.mobile-filter-toggle');
  const filterSidebar = document.querySelector('.filter-sidebar');
  const closeFilterBtn = document.querySelector('.close-filter-btn');
  const overlay = document.querySelector('.overlay');
  const userActionsContainer = document.getElementById('user-actions-container');
  const categoryFilterList = document.getElementById('category-filter-list');
  const brandFilterList = document.getElementById('brand-filter-list'); // Añadido para marcas
  const applyFiltersBtn = document.querySelector('.filter-button');
  const clearFiltersBtn = document.querySelector('.clear-filter-button');

  /**
   * Carga los productos desde la API y los muestra en la página.
   * @param {object} [filters={}] - Objeto con los filtros a aplicar.
   */
  async function cargarProductos(filters = {}) {
    if (!productGrid) return;

    // Muestra un indicador de carga
    productGrid.innerHTML = '<p>Cargando productos...</p>';

    const queryParams = new URLSearchParams(filters).toString();
    const url = `/api/productos${queryParams ? `?${queryParams}` : ''}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('No se pudieron cargar los productos.');
      }
      const productos = await response.json();

      productGrid.innerHTML = ''; // Limpiar el contenedor

      if (productos.length === 0) {
        productGrid.innerHTML = '<p>No hay productos disponibles en este momento.</p>';
        return;
      }

      productos.forEach(producto => {
        const productoCard = document.createElement('div');
        productoCard.className = 'product-card';

        // Usar imagen del producto o un placeholder si no existe
        const imagenSrc = producto.ruta_imagen || 'Font/imgs/producto_placeholder.png';
        const descripcion = producto.nombre_categoria || 'Componente de alta calidad';
        const marca = producto.nombre_proveedor || 'Marca genérica';

        productoCard.innerHTML = `
          <img src="${imagenSrc}" alt="${producto.nombre_producto}" class="product-image">
          <div class="product-info">
              <h3 class="product-title">${producto.nombre_producto}</h3>
             <p class="product-brand">${marca}</p> <!-- <-- La mostramos aquí -->
              <p class="product-description">${descripcion}</p>
              <button class="buy-button add-to-cart-btn" data-product-id="${producto.id_producto}" aria-label="Añadir al carrito">
                <i class="fa-solid fa-cart-shopping"></i>
              </button>
          </div>
        `;
        productGrid.appendChild(productoCard);
      });

    } catch (error) {
      console.error('Error al cargar productos:', error);
      productGrid.innerHTML = '<p>Hubo un error al cargar los productos. Inténtalo de nuevo más tarde.</p>';
    }
  }

  /**
   * Carga y muestra las opciones de filtro (categorías y marcas).
   * @param {string} endpoint - La URL del API para obtener los filtros.
   * @param {HTMLElement} listElement - El elemento <ul> donde se insertarán los filtros.
   * @param {string} filterKey - El nombre de la clave para la URL (ej. 'categoria').
   * @param {string} idField - El nombre del campo ID en la respuesta JSON.
   * @param {string} nameField - El nombre del campo de nombre en la respuesta JSON.
   */
  async function cargarOpcionesFiltro(endpoint, listElement, filterKey, idField, nameField) {
    if (!listElement) return;

    try {
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`No se pudieron cargar los datos de ${endpoint}`);
      const items = await response.json();

      listElement.innerHTML = ''; // Limpiar

      if (items.length === 0) {
        listElement.innerHTML = '<li>No hay opciones.</li>';
        return;
      }

      items.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
          <label>
            <input type="checkbox" name="${filterKey}" value="${item[idField]}">
            ${item[nameField]}
          </label>
        `;
        listElement.appendChild(li);
      });

    } catch (error) {
      console.error(`Error al cargar filtros desde ${endpoint}:`, error);
      listElement.innerHTML = '<li>Error al cargar.</li>';
    }
  }

  /**
   * Aplica los filtros seleccionados y recarga los productos.
   */
  function aplicarFiltros() {
    const selectedCategories = Array.from(document.querySelectorAll('input[name="categoria"]:checked')).map(cb => cb.value);
    const selectedBrands = Array.from(document.querySelectorAll('input[name="marca"]:checked')).map(cb => cb.value);

    const params = new URLSearchParams();
    selectedCategories.forEach(cat => params.append('categoria', cat));
    selectedBrands.forEach(brand => params.append('marca', brand));

    // La función cargarProductos ya sabe cómo manejar los parámetros de la URL
    cargarProductos(params);
  }

  /**
   * Limpia todos los filtros seleccionados y recarga todos los productos.
   */
  function limpiarFiltros() {
    // Desmarcar todos los checkboxes
    const checkboxes = document.querySelectorAll('.filter-sidebar input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });

    // Cargar productos sin filtros
    cargarProductos();
  }




  /**
   * Verifica si hay un usuario con sesión iniciada y actualiza la UI.
   */
  async function verificarSesion() {
    if (!userActionsContainer) return;

    try {
      const res = await fetch('/me', { credentials: 'same-origin' });

      if (res.ok) {
        // Usuario ha iniciado sesión
        const { user } = await res.json();
        const esAdmin = Number(user.tipo_usuario) === 2;

        // Guardar el tipo de usuario en el body para que otros scripts lo puedan usar
        document.body.dataset.userType = user.tipo_usuario;
        document.body.dataset.userId = user.id_usuario; // <-- AÑADIDO: Guardar el ID del usuario

        userActionsContainer.innerHTML = `
          <a href="/dashboard" class="login-link" title="Mi Cuenta">
            <i class="fa-solid fa-user"></i> ${esAdmin ? 'Dashboard' : 'Mi Perfil'}
          </a>
          <span class="separator">|</span>
          <a href="#" id="logout-btn" class="login-link" title="Cerrar Sesión">
            <i class="fa-solid fa-right-from-bracket"></i>
          </a>
        `;

        // Añadir evento al botón de logout
        document.getElementById('logout-btn').addEventListener('click', async (e) => {
          e.preventDefault();
          // Limpiar el carrito del almacenamiento local al cerrar sesión
          localStorage.removeItem('shoppingCart');
          await fetch('/logout', { method: 'POST' });
          window.location.href = '/';
        });

      } else {
        // No hay sesión iniciada
        localStorage.removeItem('shoppingCart'); // Limpiar carrito si no hay sesión
        // Asegurarse de que no haya datos de usuario guardados en el body
        delete document.body.dataset.userType;
        delete document.body.dataset.userId; // <-- AÑADIDO: Limpiar el ID del usuario

        userActionsContainer.innerHTML = `
          <a href="Font/login.html" class="login-link">Iniciar sesión</a>
          <span class="separator">|</span>
          <a href="Font/signup.html" class="login-link">Registrarse</a>
        `;
      }
    } catch (error) {
      console.error("Error verificando sesión:", error);
      // En caso de error (ej. servidor caído), mostrar los botones de login por defecto
      localStorage.removeItem('shoppingCart'); // Limpiar también en caso de error
      // y limpiar cualquier dato de usuario residual.
      delete document.body.dataset.userType;
      delete document.body.dataset.userId; // <-- AÑADIDO: Limpiar el ID del usuario

      userActionsContainer.innerHTML = `
        <a href="Font/login.html" class="login-link">Iniciar sesión</a>
        <span class="separator">|</span>
        <a href="Font/signup.html" class="login-link">Registrarse</a>
      `;
    }

    // Disparar un evento para notificar que la verificación de sesión ha terminado.
    document.dispatchEvent(new CustomEvent('session-verified'));
  }

  // --- Lógica para menús móviles ---

  // Menú de navegación principal
  if (mobileNavToggle && headerContent) {
    mobileNavToggle.addEventListener('click', () => {
      const isExpanded = mobileNavToggle.getAttribute('aria-expanded') === 'true';
      mobileNavToggle.setAttribute('aria-expanded', !isExpanded);
      headerContent.classList.toggle('active');
      overlay.classList.toggle('active');
      document.body.classList.toggle('no-scroll');
    });
  }

  // Menú de filtros
  if (mobileFilterToggle && filterSidebar && closeFilterBtn) {
    const toggleFilterMenu = () => {
      filterSidebar.classList.toggle('active');
      overlay.classList.toggle('active');
      document.body.classList.toggle('no-scroll');
    };
    mobileFilterToggle.addEventListener('click', toggleFilterMenu);
    closeFilterBtn.addEventListener('click', toggleFilterMenu);
  }

  // --- Lógica de Filtros ---
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', aplicarFiltros);
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', limpiarFiltros);
  }

  // --- Cargas Iniciales ---
  verificarSesion();
  // Cargar los productos sin filtros al iniciar la página
  cargarProductos();
  // Cargar las opciones para los filtros
  cargarOpcionesFiltro('/api/categorias', categoryFilterList, 'categoria', 'id_categoria', 'nombre_categoria');
  cargarOpcionesFiltro('/api/marcas', brandFilterList, 'marca', 'id_proveedor', 'nombre_proveedor');
});