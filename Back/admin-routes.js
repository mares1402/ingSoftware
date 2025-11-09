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
  // === SUBIR PRODUCTOS DESDE EXCEL (con validación de duplicados y estado) ===
  router.post('/productos/upload', isAuthenticated, isAdmin, upload.single('file'), async (req, res) => {
    try {
      const workbook = XLSX.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);

      if (!data.length) {
        return res.status(400).json({ mensaje: 'El archivo Excel está vacío o mal formateado' });
      }

      const conn = await conexion.promise().getConnection();
      await conn.beginTransaction();

      let insertados = 0;
      let duplicados = 0;

      for (const row of data) {
        const nombre = row.Nombre?.trim();
        const categoria = row.Categoria?.trim();
        const proveedor = row.Proveedor?.trim();

        if (!nombre || !categoria || !proveedor) {
          console.warn(`Fila inválida: faltan datos`, row);
          continue;
        }

        // Buscar IDs de categoría y proveedor
        const [[cat]] = await conn.query(
          'SELECT id_categoria FROM CategoriaProductos WHERE nombre_categoria = ? AND estado = 1',
          [categoria]
        );

        const [[prov]] = await conn.query(
          'SELECT id_proveedor FROM Proveedores WHERE nombre_proveedor = ? AND estado = 1',
          [proveedor]
        );

        if (!cat || !prov) {
          console.warn(`❌ Categoría o proveedor no encontrados para fila:`, row);
          continue;
        }

        // Verificar duplicado (nombre + proveedor + activo)
        const [duplicado] = await conn.query(`
          SELECT p.id_producto 
          FROM Productos p
          INNER JOIN ProductoProveedor pp ON p.id_producto = pp.id_producto
          WHERE p.nombre_producto = ? AND pp.id_proveedor = ? AND p.estado = 1
        `, [nombre, prov.id_proveedor]);

        if (duplicado.length > 0) {
          duplicados++;
          continue; // No insertar duplicado
        }

        // Insertar producto
        const [insertResult] = await conn.query(
          'INSERT INTO Productos (nombre_producto, id_categoria, estado) VALUES (?, ?, 1)',
          [nombre, cat.id_categoria]
        );

        const id_producto = insertResult.insertId;

        // Asociar proveedor
        await conn.query(
          'INSERT INTO ProductoProveedor (id_producto, id_proveedor) VALUES (?, ?)',
          [id_producto, prov.id_proveedor]
        );

        insertados++;
      }

      await conn.commit();
      conn.release();

      res.json({
        mensaje: `Carga completada.`,
        resumen: {
          total: data.length,
          insertados,
          duplicados,
          omitidos: data.length - (insertados + duplicados)
        }
      });

    } catch (err) {
      console.error('Error en carga de Excel:', err);
      res.status(500).json({ mensaje: 'Error al procesar archivo Excel', error: err.message });
    } finally {
      // Limpiar el archivo temporal subido
      if (req.file?.path) {
        fs.unlink(req.file.path, err => {
          if (err) console.error('Error eliminando archivo Excel temporal:', err);
        });
      }
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
      WHERE p.estado = 1 AND (pr.estado = 1 OR pr.estado IS NULL)
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
      WHERE p.id_producto = ? AND p.estado = 1 AND (pr.estado = 1 OR pr.estado IS NULL)
    `;
    conexion.query(query, [id], (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error al obtener producto', error: err });
      if (!results.length) return res.status(404).json({ mensaje: 'Producto no encontrado' });
      res.json(results[0]);
    });
  });

  // Crear producto y asociarlo con proveedor (con subida de imagen)
  router.post('/productos', isAuthenticated, isAdmin, uploadProductImage.single('imagen_producto'), (req, res) => {
    const { nombre_producto, id_categoria, id_proveedor } = req.body;
    const rutaImagen = req.file ? `/uploads/products/${req.file.filename}` : null;
    conexion.getConnection((err, conn) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener conexión', error: err });

    conn.beginTransaction(err => {
      if (err) {
        conn.release();
        return res.status(500).json({ mensaje: 'Error al iniciar transacción', error: err });
      }

      // Validar duplicado (nombre + proveedor, solo productos activos)
      const checkSql = `
        SELECT p.id_producto 
        FROM Productos p
        INNER JOIN ProductoProveedor pp ON p.id_producto = pp.id_producto
        WHERE p.nombre_producto = ? AND pp.id_proveedor = ? AND p.estado = 1
      `;
      conn.query(checkSql, [nombre_producto, id_proveedor], (err, results) => {
        if (err) {
          conn.release();
          return res.status(500).json({ mensaje: 'Error al verificar duplicados', error: err });
        }

        if (results.length > 0) {
          conn.release();
          return res.status(400).json({ mensaje: 'Ya existe un producto activo con ese nombre y proveedor' });
        }

        // Insertar producto
        const sqlProducto = `
          INSERT INTO Productos (nombre_producto, id_categoria, ruta_imagen, estado)
          VALUES (?, ?, ?, 1)
        `;
        conn.query(sqlProducto, [nombre_producto, id_categoria, rutaImagen], (err, result) => {
          if (err) {
            conn.rollback(() => {
              conn.release();
              res.status(500).json({ mensaje: 'Error al crear producto', error: err });
            });
            return;
          }

          const id_producto = result.insertId;

          // Asociar proveedor
          const sqlAsociacion = 'INSERT INTO ProductoProveedor (id_producto, id_proveedor) VALUES (?, ?)';
          conn.query(sqlAsociacion, [id_producto, id_proveedor], (err) => {
            if (err) {
              conn.rollback(() => {
                conn.release();
                res.status(500).json({ mensaje: 'Error al asociar producto con proveedor', error: err });
              });
              return;
            }

            // Confirmar
            conn.commit(err => {
              if (err) {
                conn.rollback(() => {
                  conn.release();
                  res.status(500).json({ mensaje: 'Error al confirmar transacción', error: err });
                });
                return;
              }

              conn.release();
              res.json({ mensaje: 'Producto creado correctamente', id: id_producto });
            });
          });
        });
      });
    });
  });
});

  // Actualizar producto y su proveedor con validación de duplicados
  router.put('/productos/:id', isAuthenticated, isAdmin, uploadProductImage.single('imagen_producto'), async (req, res) => {
    const { id } = req.params;
    const { nombre_producto, id_categoria, id_proveedor, remove_image } = req.body;
    let conn;

    try {
      conn = await conexion.promise().getConnection();
      await conn.beginTransaction();

      // Verificar duplicado (excluyendo el mismo producto)
      const [dupes] = await conn.query(`
        SELECT p.id_producto 
        FROM Productos p
        INNER JOIN ProductoProveedor pp ON p.id_producto = pp.id_producto
        WHERE p.nombre_producto = ? AND pp.id_proveedor = ? 
          AND p.id_producto <> ? AND p.estado = 1
      `, [nombre_producto, id_proveedor, id]);

      if (dupes.length > 0) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ mensaje: 'Ya existe un producto activo con ese nombre y proveedor' });
      }

      // Obtener imagen actual solo si el producto está activo
      const [rows] = await conn.query('SELECT ruta_imagen FROM Productos WHERE id_producto = ? AND estado = 1', [id]);
      if (!rows.length) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ mensaje: 'Producto no encontrado o inactivo' });
      }

      const oldImagePath = rows[0].ruta_imagen;
      let newImagePath = oldImagePath;

      // Manejar imagen nueva o eliminación
      if (req.file) {
        newImagePath = `/uploads/products/${req.file.filename}`;
        if (oldImagePath) {
          const fullOldPath = path.join(__dirname, '..', oldImagePath);
          fs.unlink(fullOldPath, err => err && console.error('Error eliminando imagen antigua:', err));
        }
      } else if (remove_image === 'true') {
        newImagePath = null;
        if (oldImagePath) {
          const fullOldPath = path.join(__dirname, '..', oldImagePath);
          fs.unlink(fullOldPath, err => err && console.error('Error eliminando imagen:', err));
        }
      }

      // Actualizar producto
      await conn.query(`
        UPDATE Productos
        SET nombre_producto = ?, id_categoria = ?, ruta_imagen = ?
        WHERE id_producto = ? AND estado = 1
      `, [nombre_producto, id_categoria, newImagePath, id]);

      // Actualizar proveedor asociado
      await conn.query(`
        INSERT INTO ProductoProveedor (id_producto, id_proveedor)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE id_proveedor = VALUES(id_proveedor)
      `, [id, id_proveedor]);

      await conn.commit();
      conn.release();
      res.json({ mensaje: 'Producto actualizado correctamente' });

    } catch (error) {
      if (conn) {
        await conn.rollback();
        conn.release();
      }

      if (req.file) {
        const tempPath = path.join(__dirname, '..', `/uploads/products/${req.file.filename}`);
        fs.unlink(tempPath, () => {});
      }

      console.error('Error al actualizar producto:', error);
      res.status(500).json({ mensaje: 'Error en el servidor al actualizar el producto', error: error.message });
    }
  });

  // "Eliminar" (desactivar) producto
  router.delete('/productos/:id', isAuthenticated, isAdmin, (req, res) => {
    const { id } = req.params;
    const sql = `UPDATE Productos SET estado = 2 WHERE id_producto = ?`;

    conexion.query(sql, [id], (err, result) => {
      if (err) {
        console.error('Error al desactivar producto:', err);
        return res.status(500).json({ mensaje: 'Error al desactivar producto', error: err });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ mensaje: 'Producto no encontrado o ya inactivo' });
      }

      res.json({ mensaje: 'Producto desactivado correctamente' });
    });
  });

// --- PROVEEDORES ---
// === CARGAR PROVEEDORES DESDE EXCEL (con validación de duplicados y estado) ===
router.post('/proveedores/upload', isAuthenticated, isAdmin, upload.single('file'), async (req, res) => {
  try {
    // Leer archivo Excel
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (!data.length) {
      return res.status(400).json({ mensaje: 'El archivo Excel está vacío o mal formateado' });
    }

    const conn = await conexion.promise().getConnection();
    await conn.beginTransaction();

    let insertados = 0;
    let duplicados = 0;
    let omitidos = 0;

    for (const row of data) {
      const nombre = row.Nombre?.trim() || '';
      const telefono = row.Telefono?.toString().trim() || '';
      const correo = row.Correo?.trim() || '';
      const direccion = row.Direccion?.trim() || '';

      // --- 🔍 VALIDACIONES DE FORMATO Y LONGITUD ---
      if (!nombre) {
        console.warn('⚠️ Fila omitida: falta el nombre del proveedor', row);
        omitidos++;
        continue;
      }

      // Longitud máxima según el esquema SQL
      if (nombre.length > 50 || telefono.length > 20 || correo.length > 40 || direccion.length > 100) {
        console.warn('⚠️ Fila omitida: supera longitud permitida', row);
        omitidos++;
        continue;
      }

      // Validar que el nombre solo contenga letras y espacios
      if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(nombre)) {
        console.warn('⚠️ Fila omitida: nombre con caracteres inválidos', row);
        omitidos++;
        continue;
      }

      // Validar formato de teléfono (solo dígitos, +, -, espacios)
      if (telefono && !/^[0-9+\-\s]+$/.test(telefono)) {
        console.warn('⚠️ Fila omitida: teléfono inválido', row);
        omitidos++;
        continue;
      }

      // Validar correo electrónico
      if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        console.warn('⚠️ Fila omitida: correo inválido', row);
        omitidos++;
        continue;
      }

      // --- 🔁 COMPROBAR DUPLICADOS ---
      const [existe] = await conn.query(
        `SELECT id_proveedor FROM Proveedores 
         WHERE (nombre_proveedor = ? OR correo = ?) AND estado = 1`,
        [nombre, correo]
      );

      if (existe.length > 0) {
        duplicados++;
        continue; // No insertar duplicado
      }

      // --- 💾 INSERTAR PROVEEDOR ---
      await conn.query(
        `INSERT INTO Proveedores (nombre_proveedor, telefono, correo, direccion, estado)
         VALUES (?, ?, ?, ?, 1)`,
        [nombre, telefono, correo, direccion]
      );

      insertados++;
    }

    await conn.commit();
    conn.release();

    res.json({
      mensaje: `Carga de proveedores completada.`,
      resumen: {
        total: data.length,
        insertados,
        duplicados,
        omitidos
      }
    });

  } catch (err) {
    console.error('❌ Error en carga de proveedores desde Excel:', err);
    res.status(500).json({ mensaje: 'Error al procesar archivo Excel', error: err.message });
  } finally {
    // Eliminar archivo temporal
    if (req.file?.path) {
      fs.unlink(req.file.path, err => {
        if (err) console.error('Error eliminando archivo temporal:', err);
      });
    }
  }
});

// Obtener todos los proveedores
router.get('/proveedores', isAuthenticated, isAdmin, (req, res) => {
  conexion.query('SELECT * FROM Proveedores WHERE estado = 1', (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener proveedores', error: err });
    res.json(results);
  });
});

// Obtener proveedor individual
router.get('/proveedores/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  conexion.query('SELECT * FROM Proveedores WHERE id_proveedor = ? AND estado = 1', [id], (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener proveedor', error: err });
    if (!results.length) return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
    res.json(results[0]);
  });
});

// Crear proveedor
router.post('/proveedores', isAuthenticated, isAdmin, (req, res) => {
  const { nombre_proveedor, telefono, correo, direccion } = req.body;

  // Validar que no exista otro proveedor activo con el mismo nombre
  const checkSql = 'SELECT * FROM Proveedores WHERE nombre_proveedor = ? AND estado = 1';
  conexion.query(checkSql, [nombre_proveedor], (err, results) => {
    if (err) {
      console.error('Error al verificar duplicados:', err);
      return res.status(500).json({ mensaje: 'Error al verificar duplicados', error: err });
    }

    if (results.length > 0) {
      return res.status(400).json({ mensaje: 'Ya existe un proveedor activo con ese nombre' });
    }

    // Insertar proveedor con estado activo
    const insertSql = `
      INSERT INTO Proveedores (nombre_proveedor, telefono, correo, direccion, estado)
      VALUES (?, ?, ?, ?, 1)
    `;
    conexion.query(insertSql, [nombre_proveedor, telefono, correo, direccion], (err, result) => {
      if (err) {
        console.error('Error al crear proveedor:', err);
        return res.status(500).json({ mensaje: 'Error al crear proveedor', error: err });
      }

      res.json({ mensaje: 'Proveedor creado correctamente', id: result.insertId });
    });
  });
});

// Actualizar proveedor
router.put('/proveedores/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  const { nombre_proveedor, telefono, correo, direccion } = req.body;

  // Verificar que no exista otro proveedor activo con el mismo nombre
  const checkSql = `
    SELECT * FROM Proveedores 
    WHERE nombre_proveedor = ? AND id_proveedor <> ? AND estado = 1
  `;
  conexion.query(checkSql, [nombre_proveedor, id], (err, results) => {
    if (err) {
      console.error('Error al verificar duplicados:', err);
      return res.status(500).json({ mensaje: 'Error al verificar duplicados', error: err });
    }

    if (results.length > 0) {
      return res.status(400).json({ mensaje: 'Ya existe otro proveedor activo con ese nombre' });
    }

    // Actualizar datos sin tocar el estado
    const updateSql = `
      UPDATE Proveedores
      SET nombre_proveedor = ?, telefono = ?, correo = ?, direccion = ?
      WHERE id_proveedor = ? AND estado = 1
    `;
    conexion.query(updateSql, [nombre_proveedor, telefono, correo, direccion, id], (err, result) => {
      if (err) {
        console.error('Error al actualizar proveedor:', err);
        return res.status(500).json({ mensaje: 'Error al actualizar proveedor', error: err });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ mensaje: 'Proveedor no encontrado o inactivo' });
      }

      res.json({ mensaje: 'Proveedor actualizado correctamente' });
    });
  });
});

// "Eliminar" (desactivar) proveedor
router.delete('/proveedores/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  const sql = `UPDATE Proveedores SET estado = 2 WHERE id_proveedor = ?`;

  conexion.query(sql, [id], (err, result) => {
    if (err) {
      console.error('Error al desactivar proveedor:', err);
      return res.status(500).json({ mensaje: 'Error al desactivar proveedor', error: err });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Proveedor no encontrado o ya inactivo' });
    }

    res.json({ mensaje: 'Proveedor desactivado correctamente' });
  });
});

// --- CATEGORÍAS ---

// === CARGAR CATEGORÍAS DESDE EXCEL ===
router.post('/categorias/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ mensaje: 'No se subió ningún archivo.' });

    const filePath = path.resolve(req.file.path);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let insertadas = 0;

    for (const row of data) {
      // Se aceptan varias formas de encabezado
      const nombre = row['Nombre'] || row['nombre'] || row['nombre_categoria'] || null;

      if (!nombre) continue;

      // Verificamos si ya existe una categoría activa con ese nombre
      const [exists] = await new Promise((resolve, reject) => {
        conexion.query(
          'SELECT id_categoria FROM CategoriaProductos WHERE nombre_categoria = ? AND estado = 1',
          [nombre],
          (err, results) => (err ? reject(err) : resolve(results))
        );
      });

      if (exists && exists.id_categoria) continue;

      await new Promise((resolve, reject) => {
        conexion.query(
          'INSERT INTO CategoriaProductos (nombre_categoria, estado) VALUES (?, 1)',
          [nombre],
          (err) => (err ? reject(err) : resolve())
        );
      });

      insertadas++;
    }

    fs.unlinkSync(filePath);
    res.json({ mensaje: `${insertadas} categorías agregadas correctamente.` });
  } catch (err) {
    console.error('Error al subir categorías:', err);
    res.status(500).json({ mensaje: 'Error al procesar el archivo Excel.', error: err.message });
  }
});

// Obtener todas las categorías (para los selects dinámicos)
router.get('/listado-categorias', isAuthenticated, isAdmin, (req, res) => {
  conexion.query('SELECT id_categoria, nombre_categoria FROM CategoriaProductos WHERE estado = 1', (err, results) => {
    if (err) {
      console.error('Error al obtener categorías:', err);
      return res.status(500).json({ mensaje: 'Error al obtener categorías' });
    }
    res.json(results);
  });
});

// Obtener todas las categorías activas
router.get('/categorias', isAuthenticated, isAdmin, (req, res) => {
  const sql = 'SELECT id_categoria, nombre_categoria FROM CategoriaProductos WHERE estado = 1';
  conexion.query(sql, (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener categorías', error: err });
    res.json(results);
  });
});

// Obtener categoría individual
router.get('/categorias/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  const sql = 'SELECT id_categoria, nombre_categoria FROM CategoriaProductos WHERE id_categoria = ? AND estado = 1';
  conexion.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener categoría', error: err });
    if (!results.length) return res.status(404).json({ mensaje: 'Categoría no encontrada' });
    res.json(results[0]);
  });
});

// Agregar nueva categoría
router.post('/categorias', isAuthenticated, isAdmin, (req, res) => {
  const { nombre_categoria } = req.body;

  const checkSql = 'SELECT * FROM CategoriaProductos WHERE nombre_categoria = ? AND estado = 1';
  conexion.query(checkSql, [nombre_categoria], (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al verificar categoría', error: err });
    if (results.length) return res.status(400).json({ mensaje: 'Ya existe una categoría con ese nombre' });

    const insertSql = 'INSERT INTO CategoriaProductos (nombre_categoria, estado) VALUES (?, 1)';
    conexion.query(insertSql, [nombre_categoria], (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error al agregar categoría', error: err });
      res.json({ mensaje: 'Categoría agregada correctamente', id: result.insertId });
    });
  });
});

// Actualizar categoría
router.put('/categorias/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  const { nombre_categoria } = req.body;

  const checkSql = 'SELECT * FROM CategoriaProductos WHERE nombre_categoria = ? AND id_categoria != ? AND estado = 1';
  conexion.query(checkSql, [nombre_categoria, id], (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al verificar duplicado', error: err });
    if (results.length) return res.status(400).json({ mensaje: 'Ya existe otra categoría con ese nombre' });

    const updateSql = 'UPDATE CategoriaProductos SET nombre_categoria = ? WHERE id_categoria = ?';
    conexion.query(updateSql, [nombre_categoria, id], (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error al actualizar categoría', error: err });
      res.json({ mensaje: 'Categoría actualizada correctamente' });
    });
  });
});

// Eliminar (inactivar) categoría
router.delete('/categorias/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  const sql = 'UPDATE CategoriaProductos SET estado = 2 WHERE id_categoria = ?';
  conexion.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ mensaje: 'Error al eliminar categoría', error: err });
    if (result.affectedRows === 0) return res.status(404).json({ mensaje: 'Categoría no encontrada' });
    res.json({ mensaje: 'Categoría eliminada correctamente (inactiva)' });
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
