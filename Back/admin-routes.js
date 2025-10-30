const express = require('express');
const router = express.Router();
const conexion = require('./conexion');
const path = require('path');

// --- Middlewares ---
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ mensaje: 'No autenticado' });
}

function isAdmin(req, res, next) {
  if (req.session && req.session.user && Number(req.session.user.tipo_usuario) === 2) {
    return next();
  }
  return res.status(403).json({ mensaje: 'Acceso denegado' });
}

// --- USUARIOS ---
// Obtener todos los usuarios
router.get('/usuarios', isAuthenticated, isAdmin, (req, res) => {
  conexion.query(
    'SELECT id_usuario, nombre, paterno, materno, correo, telefono, genero, tipo_usuario FROM Usuario',
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error al obtener usuarios', error: err });
      res.json(results);
    }
  );
});

// Obtener usuario individual (para edición)
router.get('/usuarios/:id', isAuthenticated, isAdmin, (req, res) => {
  const id = req.params.id;
  conexion.query('SELECT * FROM Usuario WHERE id_usuario = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener usuario', error: err });
    if (!results.length) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    res.json(results[0]);
  });
});

// Actualizar usuario
router.put('/usuarios/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  const { nombre, paterno, materno, correo, telefono, genero, tipo_usuario } = req.body;
  console.log(req.body);
  conexion.query(
    'UPDATE Usuario SET nombre=?, paterno=?, materno=?, correo=?, telefono=?, genero=?, tipo_usuario=? WHERE id_usuario=?',
    [nombre, paterno, materno, correo, telefono, genero, tipo_usuario, id],
    (err, results) => {
      if (err) {
        console.error('Error MySQL al actualizar usuario:', err); // <-- log real
        return res.status(500).json({ mensaje: 'Error al actualizar usuario', error: err });
      }
      res.json({ mensaje: 'Usuario actualizado correctamente' });
    }
  );
});

// Eliminar usuario
router.delete('/usuarios/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;

  // Evitar que un admin se elimine a sí mismo
  if (req.session.user.id_usuario == id) {
    return res.status(400).json({ mensaje: 'No puedes eliminar tu propia cuenta de administrador' });
  }

  conexion.query('DELETE FROM Usuario WHERE id_usuario=?', [id], (err) => {
    if (err) return res.status(500).json({ mensaje: 'Error al eliminar usuario', error: err });
    res.json({ mensaje: 'Usuario eliminado correctamente' });
  });
});

// --- PRODUCTOS ---
// Obtener todos los productos con nombre de categoría
router.get('/productos', isAuthenticated, isAdmin, (req, res) => {
  const sql = `
    SELECT p.id_producto, p.nombre_producto, c.nombre_categoria
    FROM Productos p
    LEFT JOIN CategoriaProductos c ON p.id_categoria = c.id_categoria
  `;
  conexion.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ mensaje: 'Error al obtener productos' });
    }
    res.json(results);
  });
});

// Obtener producto individual
router.get('/productos/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT p.id_producto, p.nombre_producto, p.id_categoria, c.nombre_categoria AS categoria
    FROM Productos p
    LEFT JOIN CategoriaProductos c ON p.id_categoria = c.id_categoria
    WHERE p.id_producto = ?
  `;
  conexion.query(query, [id], (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener producto', error: err });
    if (!results.length) return res.status(404).json({ mensaje: 'Producto no encontrado' });
    res.json(results[0]);
  });
});

// Crear producto
router.post('/productos', isAuthenticated, isAdmin, (req, res) => {
  const { nombre_producto, id_categoria } = req.body;
  conexion.query(
    'INSERT INTO Productos (nombre_producto, id_categoria) VALUES (?, ?)',
    [nombre_producto, id_categoria],
    (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error al crear producto', error: err });
      res.json({ mensaje: 'Producto creado correctamente', id: result.insertId });
    }
  );
});

// Actualizar producto
router.put('/productos/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  const { nombre_producto, id_categoria } = req.body; // <-- usar id_categoria
  conexion.query(
    'UPDATE Productos SET nombre_producto=?, id_categoria=? WHERE id_producto=?',
    [nombre_producto, id_categoria, id], // <-- actualizar columna correcta
    (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error al actualizar producto', error: err });
      res.json({ mensaje: 'Producto actualizado correctamente' });
    }
  );
});

// Eliminar producto
router.delete('/productos/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  conexion.query('DELETE FROM Productos WHERE id_producto=?', [id], (err) => {
    if (err) return res.status(500).json({ mensaje: 'Error al eliminar producto', error: err });
    res.json({ mensaje: 'Producto eliminado correctamente' });
  });
});

// --- PROVEEDORES ---
// Obtener todos los proveedores
router.get('/proveedores', isAuthenticated, isAdmin, (req, res) => {
  conexion.query('SELECT * FROM Proveedores', (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener proveedores', error: err });
    res.json(results);
  });
});

// Obtener proveedor individual
router.get('/proveedores/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  conexion.query('SELECT * FROM Proveedores WHERE id_proveedor = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener proveedor', error: err });
    if (!results.length) return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
    res.json(results[0]);
  });
});

// Crear proveedor
router.post('/proveedores', isAuthenticated, isAdmin, (req, res) => {
  const { nombre_proveedor, telefono, correo, direccion } = req.body;
  conexion.query(
    'INSERT INTO Proveedores (nombre_proveedor, telefono, correo, direccion) VALUES (?, ?, ?, ?)',
    [nombre_proveedor, telefono, correo, direccion],
    (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error al crear proveedor', error: err });
      res.json({ mensaje: 'Proveedor creado correctamente', id: result.insertId });
    }
  );
});

// Actualizar proveedor
router.put('/proveedores/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  const { nombre_proveedor, telefono, correo, direccion } = req.body;
  conexion.query(
    'UPDATE Proveedores SET nombre_proveedor=?, telefono=?, correo=?, direccion=? WHERE id_proveedor=?',
    [nombre_proveedor, telefono, correo, direccion, id],
    (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error al actualizar proveedor', error: err });
      res.json({ mensaje: 'Proveedor actualizado correctamente' });
    }
  );
});

// Eliminar proveedor
router.delete('/proveedores/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  conexion.query('DELETE FROM Proveedores WHERE id_proveedor=?', [id], (err) => {
    if (err) return res.status(500).json({ mensaje: 'Error al eliminar proveedor', error: err });
    res.json({ mensaje: 'Proveedor eliminado correctamente' });
  });
});

// --- CATEGORÍAS ---
// Obtener todas las categorías (para los selects dinámicos)
router.get('/categorias', isAuthenticated, isAdmin, (req, res) => {
  conexion.query('SELECT * FROM CategoriaProductos', (err, results) => {
    if (err) {
      console.error('Error al obtener categorías:', err);
      return res.status(500).json({ mensaje: 'Error al obtener categorías' });
    }
    res.json(results);
  });
});

// --- Panel de administración ---
router.get('/panel/:archivo', isAuthenticated, isAdmin, (req, res) => {
  const archivosPermitidos = ['admin-users.html', 'admin-products.html', 'admin-suppliers.html'];
  const archivo = req.params.archivo;

  if (!archivosPermitidos.includes(archivo)) {
    return res.status(404).send('Archivo no encontrado');
  }

  res.sendFile(path.join(__dirname, '..', 'Private', archivo));
});

module.exports = router;
