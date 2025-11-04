const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();
const conexion = require('./Back/conexion');
const authRoutes = require('./Back/aut-controller');
const fs = require('fs'); // <-- Añadimos el módulo de archivos
const adminRoutes = require('./Back/admin-routes');
const multer = require('multer'); // Añadimos multer
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sesiones (MemoryStore)
app.use(session({
  name: 'sid',
  secret: 'contrasenia', // Cambiar a una mas fuerte despues
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
const uploadProductImage = multer({ storage: productStorage }); // Middleware para subir imágenes de productos


// Middlewares de control de acceso 
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

// Servir dashboard protegido
app.get('/dashboard', isAuthenticated, (req, res, next) => {
  const dashboardPath = path.join(__dirname, 'Private', 'dashboard.html');
  // Añadir cabeceras para prevenir el caché en el navegador
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(dashboardPath);
});

// Nueva ruta para servir los paneles de admin
app.get('/api/admin/panel/:panelName', isAuthenticated, (req, res) => {
  const panelName = req.params.panelName;
  // Solo los admins pueden acceder a los paneles de admin
  if (panelName.startsWith('admin-') && Number(req.session.user.tipo_usuario) !== 2) {
    return res.status(403).send('Acceso denegado');
  }
  const panelPath = path.join(__dirname, 'Private', panelName);

  if (fs.existsSync(panelPath)) {
    res.sendFile(panelPath);
  } else {
    res.status(404).send('Panel no encontrado');
  }
});

// Endpoint para que el frontend consulte el usuario actual
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

// Rutas de la API de Admin (para datos)
// Pasamos el middleware de upload a adminRoutes
app.use('/api/admin', isAdmin, adminRoutes(uploadProductImage));

app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Servir archivos subidos estáticamente

// Rutas públicas de autenticación (login / signup)
app.use('/', authRoutes);

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