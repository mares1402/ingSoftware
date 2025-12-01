const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();
const conexion = require('./Back/conexion');
const authRoutes = require('./Back/aut-controller');
const fs = require('fs'); 
const adminRoutes = require('./Back/admin-routes');
const multer = require('multer'); // Añadimos multer
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sesiones (MemoryStore)
app.use(session({
  name: 'sid',
  secret: 'contrasenia', 
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 2 // 2 horas
  }
}));

// --- Multer Configuration for Product Images ---
const productUploadDir = path.join(__dirname, 'uploads', 'products');
if (!fs.existsSync(productUploadDir)) {
  fs.mkdirSync(productUploadDir, { recursive: true });
}

const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, productUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtro para aceptar solo archivos de imagen
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true); // Aceptar el archivo
  } else {
    cb(new Error('Formato de archivo no válido. Solo se permiten imágenes.'), false); // Rechazar el archivo
  }
};

const uploadProductImage = multer({ storage: productStorage, fileFilter: imageFileFilter }); // Middleware para subir imágenes de productos

// --- Middlewares de control de acceso ---
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  // Peticiones fetch/JSON reciben 401
  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') > -1)) {
    return res.status(401).json({ mensaje: 'No autenticado' });
  }
  // Peticiones normales redirigen al login
  return res.redirect('/');
}
function isAdmin(req, res, next) {
  if (req.session && req.session.user && Number(req.session.user.tipo_usuario) === 2) {
    return next();
  }
  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('application/json') > -1)) {
    return res.status(403).json({ mensaje: 'Acceso denegado' });
  }
  return res.status(403).send('Acceso denegado');
}


// --- API Pública ---
// Endpoint para obtener todos los productos (público)
app.get('/api/productos', (req, res) => { // Modificado para aceptar filtros
  const { categoria, marca } = req.query;

  let sql = `
    SELECT 
      p.id_producto, 
      p.nombre_producto, 
      p.ruta_imagen,
      c.nombre_categoria,
      pr.nombre_proveedor
    FROM 
      Productos p
    LEFT JOIN CategoriaProductos c ON p.id_categoria = c.id_categoria
    LEFT JOIN ProductoProveedor pp ON p.id_producto = pp.id_producto
    LEFT JOIN Proveedores pr ON pp.id_proveedor = pr.id_proveedor
  WHERE p.estado = 1
  `;

  const params = [];
  const conditions = [];

  if (categoria) {
    conditions.push('c.id_categoria IN (?)');
    params.push(categoria);
  }
  if (marca) {
    conditions.push('pr.id_proveedor IN (?)');
    params.push(marca);
  }

  if (conditions.length > 0) {
    sql += ' AND ' + conditions.join(' AND ');
  }

  conexion.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error al obtener productos (público):', err);
      return res.status(500).json({ mensaje: 'Error al obtener productos' });
    }
    res.json(results);
  });
});

// Endpoint para obtener todas las categorías (público)
app.get('/api/categorias', (req, res) => {
  const sql = 'SELECT id_categoria, nombre_categoria FROM CategoriaProductos WHERE estado = 1 ORDER BY nombre_categoria';
  conexion.query(sql, (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener categorías' });
    res.json(results);
  });
});

// Endpoint para obtener todas las marcas 
app.get('/api/marcas', (req, res) => {
  // Se asume que las "marcas" son los "proveedores"
  const sql = 'SELECT id_proveedor, nombre_proveedor FROM Proveedores WHERE estado = 1 ORDER BY nombre_proveedor';
  conexion.query(sql, (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener marcas' });
    res.json(results);
  });
});

// --- API de Cotizaciones (para Clientes) ---

// Obtener todas las cotizaciones del usuario logueado
app.get('/api/quotes', isAuthenticated, (req, res) => {
  const userId = req.session.user.id_usuario;
  const sql = `
    SELECT 
      id_cotizacion, 
      fecha_cotizacion, 
      estado_cotizacion,
      total 
    FROM Cotizaciones 
    WHERE id_usuario = ? 
    ORDER BY fecha_cotizacion DESC
  `;

  conexion.query(sql, [userId], (err, results) => {
    if (err) {
      console.error('Error al obtener cotizaciones:', err);
      return res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
    res.json(results);
  });
});

// Crear una nueva cotización desde el carrito
app.post('/api/quotes', isAuthenticated, (req, res) => {
  const userId = req.session.user.id_usuario;
  const { cart } = req.body; // [{ productId: '1', quantity: 2 }, ...]

  if (!cart || cart.length === 0) {
    return res.status(400).json({ mensaje: 'El carrito está vacío.' });
  }

  // 1. Insertar la cotización principal
  const quoteSql = 'INSERT INTO Cotizaciones (id_usuario, fecha_cotizacion, estado_cotizacion) VALUES (?, NOW(), ?)';
  conexion.query(quoteSql, [userId, 'Pendiente'], (err, result) => {
    if (err) {
      console.error('Error al crear cotización:', err);
      return res.status(500).json({ mensaje: 'Error al guardar la cotización.' });
    }

    const quoteId = result.insertId;
    // 2. Insertar los detalles de la cotización
    const detailSql = 'INSERT INTO DetalleCotizacion (id_cotizacion, id_producto, cantidad) VALUES ?';
    const detailValues = cart.map(item => [quoteId, item.productId, item.quantity]);

    conexion.query(detailSql, [detailValues], (err, detailResult) => {
      if (err) {
        console.error('Error al guardar detalles de cotización:', err);
        return res.status(500).json({ mensaje: 'Error al guardar los productos de la cotización.' });
      }
      res.status(201).json({ mensaje: 'Cotización generada con éxito', id_cotizacion: quoteId });
    });
  });
});

// Obtener detalles de una cotización específica del usuario
app.get('/api/quotes/:id/details', isAuthenticated, (req, res) => {
  const cotId = req.params.id;
  const userId = req.session.user.id_usuario;

  const detailsSql = `
    SELECT d.id_detalle, d.id_cotizacion, d.id_producto, d.cantidad,
           d.precio_unitario, d.subtotal,
           p.nombre_producto, p.ruta_imagen
    FROM DetalleCotizacion d
    JOIN Productos p ON d.id_producto = p.id_producto
    JOIN Cotizaciones c ON d.id_cotizacion = c.id_cotizacion
    WHERE d.id_cotizacion = ? AND c.id_usuario = ?
  `;

  const clientSql = `
    SELECT nombre, paterno, materno, correo 
    FROM Usuario 
    WHERE id_usuario = ?
  `;

  // Usar una transacción o dos consultas paralelas para eficiencia
  conexion.query(detailsSql, [cotId, userId], (err, detalles) => {
    if (err) {
      console.error('Error al obtener detalles de cotización:', err);
      return res.status(500).json({ mensaje: 'Error al obtener los detalles de la cotización' });
    }

    conexion.query(clientSql, [userId], (clientErr, clientResults) => {
      if (clientErr) {
        console.error('Error al obtener datos del cliente:', clientErr);
        return res.status(500).json({ mensaje: 'Error al obtener la información del cliente' });
      }

      if (clientResults.length === 0) {
        return res.status(404).json({ mensaje: 'Cliente no encontrado' });
      }

      // Estructurar la respuesta como se espera en el frontend
      res.json({
        detalles: detalles,
        cliente: clientResults[0]
      });
    });
  });
});

// Actualizar cantidades y eliminar artículos en cotización del cliente
app.put('/api/quotes/:id/update', isAuthenticated, (req, res) => {
  const cotId = req.params.id;
  const userId = req.session.user.id_usuario;
  const { updates = [], deletes = [] } = req.body;

  // Verificar que la cotización pertenece al usuario
  const checkSql = 'SELECT id_cotizacion FROM Cotizaciones WHERE id_cotizacion = ? AND id_usuario = ?';
  conexion.query(checkSql, [cotId, userId], (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al verificar cotización', error: err });
    if (results.length === 0) {
      return res.status(403).json({ mensaje: 'No tienes permiso para editar esta cotización' });
    }

    // Eliminar detalles
    if (deletes.length > 0) {
      const placeholders = deletes.map(() => '?').join(',');
      conexion.query(
        `DELETE FROM DetalleCotizacion WHERE id_detalle IN (${placeholders})`,
        deletes,
        (err) => {
          if (err) {
            console.error('Error al eliminar:', err);
            return res.status(500).json({ mensaje: 'Error al eliminar artículos' });
          }
        }
      );
    }

    // Variable para controlar la respuesta
    let responseSent = false;

    const finishUpdate = () => {
      if (responseSent) return;

      // 1. Recalcular subtotales y el total general de la cotización.
      const updateTotalSql = `
        UPDATE Cotizaciones c
        JOIN (
          SELECT id_cotizacion, SUM(cantidad * COALESCE(precio_unitario, 0)) AS nuevo_total
          FROM DetalleCotizacion
          WHERE id_cotizacion = ?
          GROUP BY id_cotizacion
        ) dt ON c.id_cotizacion = dt.id_cotizacion
        SET c.total = dt.nuevo_total, c.estado_cotizacion = 'Pendiente'
        WHERE c.id_cotizacion = ?
      `;

      conexion.query(updateTotalSql, [cotId, cotId], (totalErr) => {
        if (totalErr) {
          console.error('Error al recalcular total y estado:', totalErr);
          if (!responseSent) res.status(500).json({ mensaje: 'Error al finalizar la actualización de la cotización' });
          responseSent = true;
          return;
        }

        if (!responseSent) res.json({ mensaje: 'Cotización actualizada y enviada para revisión' });
        responseSent = true;
      });
    };

    // Actualizar cantidades
    if (updates.length > 0) {
      let completed = 0;
      updates.forEach(update => {
        conexion.query(
          // Truco: Guardamos la cantidad ANTERIOR en el campo 'subtotal'
          // y luego actualizamos la cantidad. El subtotal real se recalculará
          // cuando el admin guarde los precios.
          `UPDATE DetalleCotizacion 
           SET subtotal = cantidad, cantidad = ? 
           WHERE id_detalle = ?`,
          [update.cantidad, update.id],
          (err) => {
            if (err && !responseSent) {
              console.error('Error al actualizar:', err);
              res.status(500).json({ mensaje: 'Error al actualizar cantidades' });
              responseSent = true;
              return;
            }
            completed++;
            if (completed === updates.length) {
              finishUpdate();
            }
          }
        );
      });
    } else if (deletes.length > 0) {
      // Si solo hubo eliminaciones, recalcular el total de todos modos.
      finishUpdate();
    } else {
      // Si no hubo cambios, no hacer nada.
      if (!responseSent) res.json({ mensaje: 'No se realizaron cambios.' });
    }
  });
});

// Servir dashboard protegido
app.get('/dashboard', isAuthenticated, (req, res, next) => {
  const dashboardPath = path.join(__dirname, 'Private', 'dashboard.html');
  // Añadir cabeceras para prevenir el caché en el navegador
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(dashboardPath);
});


// Ruta para cargar paneles (admin y usuario normal)
app.get('/api/panel/:panelName', isAuthenticated, (req, res) => {
  const panelName = req.params.panelName;
  const userType = Number(req.session.user.tipo_usuario);
  
  // Solo los admins pueden acceder a los paneles que comienzan con 'admin-'
  if (panelName.startsWith('admin-') && userType !== 2) {
    return res.status(403).send('Acceso denegado: Solo administradores pueden acceder a este panel');
  }
  
  const panelPath = path.join(__dirname, 'Private', panelName);

  if (fs.existsSync(panelPath)) {
    res.sendFile(panelPath);
  } else {
    console.error(`Panel no encontrado: ${panelName} en ruta: ${panelPath}`);
    res.status(404).send('Panel no encontrado');
  }
});

// Mantener la ruta antigua para compatibilidad
app.get('/api/admin/panel/:panelName', isAuthenticated, (req, res) => {
  const panelName = req.params.panelName;
  const userType = Number(req.session.user.tipo_usuario);
  
  // Solo los admins pueden acceder a los paneles que comienzan con 'admin-'
  if (panelName.startsWith('admin-') && userType !== 2) {
    return res.status(403).send('Acceso denegado: Solo administradores pueden acceder a este panel');
  }
  
  const panelPath = path.join(__dirname, 'Private', panelName);

  if (fs.existsSync(panelPath)) {
    res.sendFile(panelPath);
  } else {
    console.error(`Panel no encontrado: ${panelName} en ruta: ${panelPath}`);
    res.status(404).send('Panel no encontrado');
  }
});


app.get('/me', isAuthenticated, (req, res) => {
  res.json({ user: req.session.user });
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destruyendo sesión:', err);
      return res.status(500).json({ mensaje: 'Error al cerrar sesión' });
    }
    res.clearCookie('sid');
    res.json({ mensaje: 'Logout exitoso' });
  });
});

// Rutas públicas de autenticación (login / signup)
app.use('/', authRoutes);


app.use('/api/admin', isAuthenticated, isAdmin, adminRoutes(uploadProductImage));

app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Servir archivos subidos estáticamente

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Servir archivos estáticos de la carpeta 'Font' bajo el prefijo /Font
// Esto evita conflictos con otras rutas como /admin/partials
app.use('/Font', express.static(path.join(__dirname, 'Font')));

app.listen(3000, () => {
    console.log('Servidor escuchando en puerto 3000');
    console.log('Abrir pagina con el siguiente link: http://localhost:3000');
});