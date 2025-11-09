const express = require('express');
const conexion = require('./conexion');
// const multer = require('multer'); // Multer se importa y configura en app.js
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');

// Configurar multer (carpeta temporal)
const upload = multer({ dest: 'uploads/' });

// --- Middlewares ---
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ mensaje: 'No autenticado' });
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

// Crear producto y asociarlo con proveedor
// La función adminRoutes ahora recibe 'upload' como argumento
module.exports = (uploadProductImage) => { // Envuelve las rutas en una función que acepta el middleware de subida
  const router = express.Router();

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
      res.json({ mensaje: 'Usuario eliminado con éxito' });
    });
  });

  // --- PRODUCTOS ---
  // === SUBIR PRODUCTOS DESDE EXCEL ===
  router.post('/productos/upload', isAuthenticated, isAdmin, upload.single('file'), (req, res) => {
    try {
      const workbook = XLSX.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);

      // data = [{ Nombre, Categoria, Proveedor }, ...]

      const inserts = data.map(row => [row.Nombre, row.Categoria]);

      conexion.getConnection((err, conn) => {
        if (err) return res.status(500).json({ mensaje: 'Error al obtener conexión', error: err });

        conn.beginTransaction(err => {
          if (err) {
            conn.release();
            return res.status(500).json({ mensaje: 'Error al iniciar transacción', error: err });
          }

          const sqlProductos = `INSERT INTO Productos (nombre_producto, id_categoria) VALUES ?`;
          conn.query(sqlProductos, [inserts], (err, result) => {
            if (err) {
              return conn.rollback(() => {
                conn.release();
                res.status(500).json({ mensaje: 'Error al insertar productos', error: err });
              });
            }

            // Asociar proveedores
            const productoIds = Array.from({ length: result.affectedRows }, (_, i) => result.insertId + i);
            const productoProveedor = data.map((row, idx) => [productoIds[idx], row.Proveedor]);

            const sqlPP = `INSERT INTO ProductoProveedor (id_producto, id_proveedor) VALUES ?`;
            conn.query(sqlPP, [productoProveedor], (err) => {
              if (err) {
                return conn.rollback(() => {
                  conn.release();
                  res.status(500).json({ mensaje: 'Error al asociar proveedores', error: err });
                });
              }

              conn.commit(err => {
                if (err) {
                  return conn.rollback(() => {
                    conn.release();
                    res.status(500).json({ mensaje: 'Error al confirmar inserción', error: err });
                  });
                }

                conn.release();
                res.json({ mensaje: `Se insertaron ${result.affectedRows} productos correctamente.` });
              });
            });
          });
        });
      });
    } catch (err) {
      res.status(500).json({ mensaje: 'Error al procesar archivo Excel', error: err });
    }
  });

  // Obtener todos los productos con nombre de categoría y proveedor
  router.get('/productos', isAuthenticated, isAdmin, (req, res) => {
    const sql = `
      SELECT 
        p.id_producto, 
        p.nombre_producto, 
        p.ruta_imagen,
        c.nombre_categoria,
        pr.nombre_proveedor
      FROM Productos p
      LEFT JOIN CategoriaProductos c ON p.id_categoria = c.id_categoria
      LEFT JOIN ProductoProveedor pp ON p.id_producto = pp.id_producto
      LEFT JOIN Proveedores pr ON pp.id_proveedor = pr.id_proveedor
    `;
    conexion.query(sql, (err, results) => {
      if (err) {
        console.error('Error al obtener productos:', err);
        return res.status(500).json({ mensaje: 'Error al obtener productos' });
      }
      res.json(results);
    });
  });

  // Obtener producto individual (con proveedor)
  router.get('/productos/:id', isAuthenticated, isAdmin, (req, res) => {
    const { id } = req.params;
    const query = `
      SELECT 
        p.id_producto, 
        p.nombre_producto, 
        p.id_categoria,
        p.ruta_imagen,
        c.nombre_categoria AS categoria,
        pr.id_proveedor,
        pr.nombre_proveedor
      FROM Productos p
      LEFT JOIN CategoriaProductos c ON p.id_categoria = c.id_categoria
      LEFT JOIN ProductoProveedor pp ON p.id_producto = pp.id_producto
      LEFT JOIN Proveedores pr ON pp.id_proveedor = pr.id_proveedor
      WHERE p.id_producto = ?
    `;
    conexion.query(query, [id], (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error al obtener producto', error: err });
      if (!results.length) return res.status(404).json({ mensaje: 'Producto no encontrado' });
      res.json(results[0]);
    });
  });

  // Crear producto y asociarlo con proveedor (con subida de imagen)
  router.post('/productos', isAuthenticated, isAdmin, uploadProductImage.single('imagen_producto'), (req, res) => {
    console.log('\n=== POST /api/admin/productos ===');
    console.log('Usuario en sesión:', req.session.user);
    console.log('Cuerpo recibido:', req.body);
    conexion.getConnection((err, conn) => {
      if (err) return res.status(500).json({ mensaje: 'Error al obtener conexión', error: err });

      conn.beginTransaction(err => {
        if (err) {
          conn.release();
          return res.status(500).json({ mensaje: 'Error al iniciar transacción', error: err });
        }

        conn.query(
          'INSERT INTO Productos (nombre_producto, id_categoria, ruta_imagen) VALUES (?, ?, ?)', // Añadimos ruta_imagen
          [req.body.nombre_producto, req.body.id_categoria, req.file ? `/uploads/products/${req.file.filename}` : null], // Guardamos la ruta
          // req.file contiene la información del archivo subido por multer
          (err, result) => {
            if (err) {
              return conn.rollback(() => {
                conn.release();
                res.status(500).json({ mensaje: 'Error al crear producto', error: err });
              });
            }

            const id_producto = result.insertId;

            conn.query(
              'INSERT INTO ProductoProveedor (id_producto, id_proveedor) VALUES (?, ?)',
              [id_producto, req.body.id_proveedor],
              (err) => {
                if (err) {
                  return conn.rollback(() => {
                    conn.release();
                    res.status(500).json({ mensaje: 'Error al asociar producto con proveedor', error: err });
                  });
                }

                conn.commit(err => {
                  if (err) {
                    return conn.rollback(() => {
                      conn.release();
                      res.status(500).json({ mensaje: 'Error al confirmar transacción', error: err });
                    });
                  }

                  conn.release();
                  res.json({ mensaje: 'Producto y proveedor asociados correctamente', id: id_producto });
                });
              }
            );
          }
        );
      });
    });
  });

  // Actualizar producto y su proveedor
  router.put('/productos/:id', isAuthenticated, isAdmin, uploadProductImage.single('imagen_producto'), async (req, res) => {
    const { id } = req.params;
    const { nombre_producto, id_categoria, id_proveedor, remove_image } = req.body;
    let conn;

    try {
      conn = await conexion.promise().getConnection();
      await conn.beginTransaction();

      // 1. Obtener la ruta de la imagen actual para poder borrarla si es necesario
      const [rows] = await conn.query('SELECT ruta_imagen FROM Productos WHERE id_producto = ?', [id]);
      const oldImagePath = rows.length > 0 ? rows[0].ruta_imagen : null;

      let newImagePath = oldImagePath; // Por defecto, mantenemos la imagen actual

      // Caso A: Se sube una nueva imagen
      if (req.file) {
        newImagePath = `/uploads/products/${req.file.filename}`;
        // Si había una imagen antigua, la borramos del servidor
        if (oldImagePath) {
          const fullOldPath = path.join(__dirname, '..', oldImagePath);
          fs.unlink(fullOldPath, (err) => {
            if (err) console.error(`Error al eliminar imagen antigua ${fullOldPath}:`, err);
          });
        }
      }
      // Caso B: Se pide explícitamente quitar la imagen
      else if (remove_image === 'true') {
        newImagePath = null;
        // Si había una imagen, la borramos del servidor
        if (oldImagePath) {
          const fullOldPath = path.join(__dirname, '..', oldImagePath);
          fs.unlink(fullOldPath, (err) => {
            if (err) console.error(`Error al eliminar imagen ${fullOldPath}:`, err);
          });
        }
      }

      // 2. Actualizar la tabla de Productos
      await conn.query(
        'UPDATE Productos SET nombre_producto = ?, id_categoria = ?, ruta_imagen = ? WHERE id_producto = ?',
        [nombre_producto, id_categoria, newImagePath, id]
      );

      // 3. Actualizar la tabla de asociación ProductoProveedor
      // Usamos un INSERT ... ON DUPLICATE KEY UPDATE para manejar tanto creación como actualización
      await conn.query(
        `INSERT INTO ProductoProveedor (id_producto, id_proveedor) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE id_proveedor = VALUES(id_proveedor)`,
        [id, id_proveedor]
      );

      // 4. Confirmar la transacción
      await conn.commit();

      res.json({ mensaje: 'Producto actualizado correctamente' });

    } catch (error) {
      // Si algo falla, revertimos todos los cambios
      if (conn) await conn.rollback();

      // Si falló, pero se subió un archivo, lo borramos para no dejar basura
      if (req.file) {
        const tempPath = path.join(__dirname, '..', `/uploads/products/${req.file.filename}`);
        fs.unlink(tempPath, (err) => {
          if (err) console.error(`Error al limpiar archivo temporal ${tempPath}:`, err);
        });
      }

      console.error('Error al actualizar producto:', error);
      res.status(500).json({ mensaje: 'Error en el servidor al actualizar el producto', error: error.message });

    } finally {
      // Liberar la conexión en cualquier caso
      if (conn) conn.release();
    }
  });

  // Eliminar producto
  router.delete('/productos/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    let conn;

    try {
      conn = await conexion.promise().getConnection();
      await conn.beginTransaction();

      // 1. Obtener la ruta de la imagen para borrarla después
      const [rows] = await conn.query('SELECT ruta_imagen FROM Productos WHERE id_producto = ?', [id]);
      const imagePath = rows.length > 0 ? rows[0].ruta_imagen : null;

      // 2. Eliminar la asociación en ProductoProveedor
      await conn.query('DELETE FROM ProductoProveedor WHERE id_producto = ?', [id]);

      // 3. Eliminar el producto de la tabla Productos
      const [deleteResult] = await conn.query('DELETE FROM Productos WHERE id_producto = ?', [id]);

      if (deleteResult.affectedRows === 0) {
        throw new Error('El producto no fue encontrado o ya fue eliminado.');
      }

      // 4. Confirmar la transacción
      await conn.commit();

      // 5. Si todo fue bien, eliminar el archivo de imagen del servidor
      if (imagePath) {
        const fullPath = path.join(__dirname, '..', imagePath);
        fs.unlink(fullPath, (err) => {
          if (err) console.error(`Error al eliminar archivo de imagen ${fullPath}:`, err);
        });
      }

      res.json({ mensaje: 'Producto eliminado correctamente.' });

    } catch (error) {
      if (conn) await conn.rollback();
      console.error('Error al eliminar producto:', error);
      res.status(500).json({ mensaje: 'Error en el servidor al eliminar el producto.', error: error.message });

    } finally {
      if (conn) conn.release();
    }
  });


// --- PROVEEDORES ---
// === CARGAR PROVEEDORES DESDE EXCEL ===
router.post('/proveedores/upload', isAuthenticated, isAdmin, upload.single('file'), (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    // data = [{ Nombre, Telefono, Correo, Direccion }, ...]

    const inserts = data.map(row => [
      row.Nombre,
      row.Telefono,
      row.Correo,
      row.Direccion
    ]);

    const sql = `INSERT INTO Proveedores (nombre_proveedor, telefono, correo, direccion)
                 VALUES ?`;

    conexion.query(sql, [inserts], (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error al insertar proveedores', error: err });
      res.json({ mensaje: `Se agregaron ${result.affectedRows} proveedores correctamente.` });
    });
  } catch (err) {
    res.status(500).json({ mensaje: 'Error al procesar archivo Excel', error: err });
  }
});

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
    res.json({ mensaje: 'Proveedor eliminado con éxito' });
  });
});

// --- CATEGORÍAS ---

// === CARGAR CATEGORÍAS DESDE EXCEL ===
router.post('/categorias/upload', isAuthenticated, isAdmin, upload.single('file'), (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Se espera una columna "Nombre" en el Excel
    // data = [{ Nombre: 'Categoría 1' }, { Nombre: 'Categoría 2' }, ...]

    const inserts = data.map(row => [row.Nombre]);

    if (inserts.length === 0) {
      return res.status(400).json({ mensaje: 'El archivo Excel está vacío o no tiene la columna "Nombre".' });
    }

    const sql = `INSERT INTO CategoriaProductos (nombre_categoria) VALUES ?`;

    conexion.query(sql, [inserts], (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error al insertar categorías', error: err });
      res.json({ mensaje: `Se agregaron ${result.affectedRows} categorías correctamente.` });
    });
  } catch (err) {
    res.status(500).json({ mensaje: 'Error al procesar archivo Excel', error: err });
  }
});

// Obtener todas las categorías (para la tabla de administración)
router.get('/categorias', isAuthenticated, isAdmin, (req, res) => {
  conexion.query('SELECT * FROM CategoriaProductos ORDER BY id_categoria ASC', (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener categorías', error: err });
    res.json(results);
  });
});

// Obtener categoría individual
router.get('/categorias/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  conexion.query('SELECT * FROM CategoriaProductos WHERE id_categoria = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener la categoría', error: err });
    if (!results.length) return res.status(404).json({ mensaje: 'Categoría no encontrada' });
    res.json(results[0]);
  });
});

// Crear categoría
router.post('/categorias', isAuthenticated, isAdmin, (req, res) => {
  const { nombre_categoria } = req.body;
  if (!nombre_categoria) {
    return res.status(400).json({ mensaje: 'El nombre de la categoría es obligatorio.' });
  }
  conexion.query(
    'INSERT INTO CategoriaProductos (nombre_categoria) VALUES (?)',
    [nombre_categoria],
    (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error al crear la categoría', error: err });
      res.status(201).json({ mensaje: 'Categoría creada correctamente', id: result.insertId });
    }
  );
});

// Actualizar categoría
router.put('/categorias/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  const { nombre_categoria } = req.body;
  if (!nombre_categoria) {
    return res.status(400).json({ mensaje: 'El nombre de la categoría es obligatorio.' });
  }
  conexion.query(
    'UPDATE CategoriaProductos SET nombre_categoria = ? WHERE id_categoria = ?',
    [nombre_categoria, id],
    (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error al actualizar la categoría', error: err });
      res.json({ mensaje: 'Categoría actualizada correctamente' });
    }
  );
});

// Eliminar categoría
router.delete('/categorias/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  conexion.query('DELETE FROM CategoriaProductos WHERE id_categoria = ?', [id], (err) => {
    if (err) return res.status(500).json({ mensaje: 'Error al eliminar la categoría. Asegúrate de que no esté en uso por algún producto.', error: err });
    res.json({ mensaje: 'Categoría eliminada con éxito' });
  });
});

// --- Panel de administración ---
router.get('/panel/:archivo', isAuthenticated, isAdmin, (req, res) => {
  const archivosPermitidos = ['admin-users.html', 'admin-products.html', 'admin-suppliers.html', 'admin-categories.html'];
  const archivo = req.params.archivo;

  if (!archivosPermitidos.includes(archivo)) {
    return res.status(404).send('Archivo no encontrado');
  }

  res.sendFile(path.join(__dirname, '..', 'Private', archivo));
});

  return router; // Retorna el router configurado
};
