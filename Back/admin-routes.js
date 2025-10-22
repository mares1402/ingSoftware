const express = require('express');
const router = express.Router();
const conexion = require('./conexion');
const path = require('path');
// --- USUARIOS ---
router.get('/usuarios', (req, res) => {
  conexion.query(
    'SELECT id_usuario, nombre, paterno, materno, correo, telefono, genero, tipo_usuario FROM Usuario',
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error al obtener usuarios', error: err });
      res.json(results);
    }
  );
});

router.post('/usuarios', (req, res) => {
  const { nombre, paterno, materno, correo, password, telefono, genero, tipo_usuario } = req.body;
  conexion.query(
    'INSERT INTO Usuario (nombre, paterno, materno, correo, password, telefono, genero, tipo_usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [nombre, paterno, materno, correo, password, telefono, genero, tipo_usuario || 1],
    (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error al crear usuario', error: err });
      res.json({ mensaje: 'Usuario creado exitosamente', id: result.insertId });
    }
  );
});

router.put('/usuarios/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, paterno, materno, correo, telefono, genero, tipo_usuario } = req.body;
  conexion.query(
    'UPDATE Usuario SET nombre=?, paterno=?, materno=?, correo=?, telefono=?, genero=?, tipo_usuario=? WHERE id_usuario=?',
    [nombre, paterno, materno, correo, telefono, genero, tipo_usuario, id],
    (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error al actualizar usuario', error: err });
      res.json({ mensaje: 'Usuario actualizado correctamente' });
    }
  );
});

router.delete('/usuarios/:id', (req, res) => {
  const { id } = req.params;
  conexion.query('DELETE FROM Usuario WHERE id_usuario=?', [id], (err) => {
    if (err) return res.status(500).json({ mensaje: 'Error al eliminar usuario', error: err });
    res.json({ mensaje: 'Usuario eliminado correctamente' });
  });
});


// --- PROVEEDORES ---
router.get('/proveedores', (req, res) => {
  conexion.query('SELECT * FROM Proveedores', (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener proveedores', error: err });
    res.json(results);
  });
});

router.post('/proveedores', (req, res) => {
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

router.put('/proveedores/:id', (req, res) => {
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

router.delete('/proveedores/:id', (req, res) => {
  const { id } = req.params;
  conexion.query('DELETE FROM Proveedores WHERE id_proveedor=?', [id], (err) => {
    if (err) return res.status(500).json({ mensaje: 'Error al eliminar proveedor', error: err });
    res.json({ mensaje: 'Proveedor eliminado correctamente' });
  });
});


// --- PRODUCTOS ---
router.get('/productos', (req, res) => {
  conexion.query(
    `SELECT p.id_producto, p.nombre_producto, c.nombre_categoria AS categoria
     FROM Productos p
     JOIN CategoriaProductos c ON p.id_categoria = c.id_categoria`,
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error al obtener productos', error: err });
      res.json(results);
    }
  );
});

router.post('/productos', (req, res) => {
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

router.put('/productos/:id', (req, res) => {
  const { id } = req.params;
  const { nombre_producto, id_categoria } = req.body;
  conexion.query(
    'UPDATE Productos SET nombre_producto=?, id_categoria=? WHERE id_producto=?',
    [nombre_producto, id_categoria, id],
    (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error al actualizar producto', error: err });
      res.json({ mensaje: 'Producto actualizado correctamente' });
    }
  );
});

router.delete('/productos/:id', (req, res) => {
  const { id } = req.params;
  conexion.query('DELETE FROM Productos WHERE id_producto=?', [id], (err) => {
    if (err) return res.status(500).json({ mensaje: 'Error al eliminar producto', error: err });
    res.json({ mensaje: 'Producto eliminado correctamente' });
  });
});

router.get('/panel/:archivo', (req, res) => {
  console.log('Sesión actual:', req.session.user);
  const user = req.session?.user;
  if (!user || user.tipo_usuario !== 2) {
    return res.status(403).send('No autorizado');
  }

  const archivosPermitidos = ['admin-users.html', 'admin-products.html', 'admin-suppliers.html'];
  const archivo = req.params.archivo;

  if (!archivosPermitidos.includes(archivo)) {
    return res.status(404).send('Archivo no encontrado');
  }

  console.log('Enviando archivo:', path.join(__dirname, '..', 'Private', archivo));

  res.sendFile(path.join(__dirname, '..', 'Private', archivo));
});

module.exports = router;
