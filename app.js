const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();
const conexion = require('./Back/conexion');
const authRoutes = require('./Back/aut-controller');
const fs = require('fs'); // <-- Añadimos el módulo de archivos
const adminRoutes = require('./Back/admin-routes');
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

app.use('/api/admin', adminRoutes);
// Servir dashboard protegido
app.get('/dashboard', isAuthenticated, (req, res, next) => {
  const dashboardPath = path.join(__dirname, 'Private', 'dashboard.html');
  
  // Añadir cabeceras para prevenir el caché en el navegador
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  fs.readFile(dashboardPath, 'utf8', (err, html) => {
    if (err) return next(err);

    // Si el usuario es admin, inyectamos los paneles
    if (Number(req.session.user.tipo_usuario) === 2) {
      const userPanel = fs.readFileSync(path.join(__dirname, 'Private', 'admin-users.html'), 'utf8');
      const productPanel = fs.readFileSync(path.join(__dirname, 'Private', 'admin-products.html'), 'utf8');
      const supplierPanel = fs.readFileSync(path.join(__dirname, 'Private', 'admin-suppliers.html'), 'utf8');

      const templates = `
        <div id="template-admin-users" style="display: none;">${userPanel}</div>
        <div id="template-admin-products" style="display: none;">${productPanel}</div>
        <div id="template-admin-suppliers" style="display: none;">${supplierPanel}</div>
      `;
      
      html = html.replace('</body>', `${templates}</body>`);
    }
    
    res.send(html);
  });
});

// Si quieres una ruta admin aparte
app.get('/admin', isAuthenticated, isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'Private', 'dashboard.html'));
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