const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();
const conexion = require('./Back/conexion');
const authRoutes = require('./Back/aut-controller');


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
  return res.redirect('/login.html');
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
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'Private', 'dashboard.html'));
});

// Si quieres una ruta admin aparte
app.get('/admin', isAuthenticated, isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'Private', 'dashboard.html'));
});

// Endpoint para servir parciales HTML de admin (protegido)
app.get('/admin/partials/:file', isAuthenticated, isAdmin, (req, res) => {
  const { file } = req.params;
  res.sendFile(path.join(__dirname, 'Private', file));
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

// Servir archivos estáticos de la carpeta 'Font' (CSS, JS, etc.)
app.use(express.static(path.join(__dirname, 'Font')));

app.listen(3000, () => {
    console.log('Servidor escuchando en puerto 3000');
    console.log('Abrir pagina con el siguiente link: http://localhost:3000');
});