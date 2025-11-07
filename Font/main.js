document.addEventListener('DOMContentLoaded', () => {
  const productGrid = document.querySelector('.product-grid');
  const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
  const headerContent = document.querySelector('.header-content');
  const mobileFilterToggle = document.querySelector('.mobile-filter-toggle');
  const filterSidebar = document.querySelector('.filter-sidebar');
  const closeFilterBtn = document.querySelector('.close-filter-btn');
  const overlay = document.querySelector('.overlay');
  const userActionsContainer = document.getElementById('user-actions-container');

  /**
   * Carga los productos desde la API y los muestra en la página.
   */
  async function cargarProductos() {
    if (!productGrid) return;

    // Muestra un indicador de carga
    productGrid.innerHTML = '<p>Cargando productos...</p>';

    try {
      const response = await fetch('/api/productos');
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

        productoCard.innerHTML = `
          <img src="${imagenSrc}" alt="${producto.nombre_producto}" class="product-image">
          <div class="product-info">
              <h3 class="product-title">${producto.nombre_producto}</h3>
              <p class="product-description">${descripcion}</p>
              <button class="buy-button">Comprar</button>
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
          await fetch('/logout', { method: 'POST' });
          window.location.href = '/';
        });

      } else {
        // No hay sesión iniciada
        userActionsContainer.innerHTML = `
          <a href="Font/login.html" class="login-link">Iniciar sesión</a>
          <span class="separator">|</span>
          <a href="Font/signup.html" class="login-link">Registrarse</a>
        `;
      }
    } catch (error) {
      console.error("Error verificando sesión:", error);
    }
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

  // --- Cargas Iniciales ---
  verificarSesion();
  // Cargar los productos sin filtros al iniciar la página
  cargarProductos();
});