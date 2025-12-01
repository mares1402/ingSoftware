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
  // Regex para validar nombres (letras, números y espacios)
  const nameValidationRegex = /^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚüÜ\s]+$/;

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

    const sql = `UPDATE Usuario SET estado = 2 WHERE id_usuario = ?`;

    conexion.query(sql, [id], (err) => {
        if (err) {
            return res.status(500).json({
                mensaje: 'Error al actualizar estado del usuario',
                error: err
            });
        }

        res.json({ mensaje: 'Usuario marcado como inactivo correctamente' });
    });
  });


  // --- PRODUCTOS ---
  // === SUBIR PRODUCTOS DESDE EXCEL ===
  router.post('/productos/upload', isAuthenticated, isAdmin, upload.single('file'), async (req, res) => {
    try {
      const workbook = XLSX.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);

      // Validación estricta de columnas: deben ser exactamente 'Nombre', 'Categoria', 'Proveedor'.
      const expectedColumns = ['Nombre', 'Categoria', 'Proveedor'];
      const actualColumns = data.length > 0 ? Object.keys(data[0]) : [];
      const isValid = expectedColumns.length === actualColumns.length && expectedColumns.every(col => actualColumns.includes(col));

      if (!isValid) {
        return res.json({ 
          mensaje: 'Archivo no válido. Asegúrese de que el archivo Excel de productos contenga exactamente las columnas: "Nombre", "Categoria" y "Proveedor".',
          errores: [
            'El formato de las columnas del archivo es incorrecto o no corresponde a un archivo de productos.'
          ],
          exitos: 0
        });
      }

      const exitos = [];
      const errores = [];
      const conn = await conexion.promise().getConnection();

      for (const [index, row] of data.entries()) {
        const nombre = row.Nombre;
        const idCategoria = row.Categoria;
        const idProveedor = row.Proveedor;
        const fila = index + 2; // +1 por el header, +1 por el índice base 0

        if (!nombre || !idCategoria || !idProveedor) {
          errores.push(`Fila ${fila}: Faltan datos esenciales (Nombre, Categoria o Proveedor).`);
          continue;
        }

        if (nombre.length > 50) {
          errores.push(`Fila ${fila} (${nombre}): El nombre es demasiado largo (máximo 50 caracteres).`);
          continue;
        }

        if (!nameValidationRegex.test(nombre)) {
          errores.push(`Fila ${fila} (${nombre}): El nombre contiene caracteres no válidos (solo letras, números y espacios).`);
          continue;
        }

        try {
          // 0. Validar que la categoría y el proveedor existan y estén activos
          const [catCheck] = await conn.query('SELECT estado FROM CategoriaProductos WHERE id_categoria = ?', [idCategoria]);
          if (catCheck.length === 0 || catCheck[0].estado !== 1) {
            errores.push(`Fila ${fila} (${nombre}): La categoría con ID ${idCategoria} no existe o está inactiva.`);
            continue; // Saltar a la siguiente fila
          }

          const [provCheck] = await conn.query('SELECT estado FROM Proveedores WHERE id_proveedor = ?', [idProveedor]);
          if (provCheck.length === 0 || provCheck[0].estado !== 1) {
            errores.push(`Fila ${fila} (${nombre}): El proveedor con ID ${idProveedor} no existe o está inactivo.`);
            continue; // Saltar a la siguiente fila
          }


          // 1. Verificar si el producto ya existe por su nombre (identificador único)
          const checkDuplicateSql = 'SELECT id_producto, estado FROM Productos WHERE LOWER(nombre_producto) = LOWER(?)';
          const [existing] = await conn.query(
            checkDuplicateSql,
            [nombre]
          );

          if (existing.length > 0) {
            const existingProduct = existing[0];
            if (existingProduct.estado === 1) {
              errores.push(`Fila ${fila} (${nombre}): Ya existe un producto activo con este nombre.`);
            } else {
              // Reactivar y actualizar el producto inactivo con los nuevos datos del Excel.
              await conn.beginTransaction();
              await conn.query(
                'UPDATE Productos SET id_categoria = ?, estado = 1 WHERE id_producto = ?', 
                [idCategoria, existingProduct.id_producto]
              );
              // Actualizar o insertar la relación con el proveedor
              await conn.query(
                'INSERT INTO ProductoProveedor (id_producto, id_proveedor) VALUES (?, ?) ON DUPLICATE KEY UPDATE id_proveedor = VALUES(id_proveedor)',
                [existingProduct.id_producto, idProveedor]
              );
              await conn.commit();
              exitos.push(`${nombre} (reactivado)`);
            }
          } else {
            // 2. Si no existe, insertarlo en una transacción
            await conn.beginTransaction();
            
            // La imagen es null en carga masiva
            const [productoResult] = await conn.query(
              'INSERT INTO Productos (nombre_producto, id_categoria, ruta_imagen) VALUES (?, ?, ?)',
              [nombre, idCategoria, null] // ruta_imagen se establece en null para cargas masivas
            );
            const idProducto = productoResult.insertId;

            await conn.query(
              'INSERT INTO ProductoProveedor (id_producto, id_proveedor) VALUES (?, ?)', // Se asocia el proveedor
              [idProducto, idProveedor]
            );

            await conn.commit();
            exitos.push(nombre);
          }
        } catch (error) {
          await conn.rollback();
          const motivo = error.code === 'ER_NO_REFERENCED_ROW_2' ? 'La categoría o el proveedor no existen.' : 'Error inesperado en la BD.';
          errores.push(`Fila ${fila} (${nombre}): ${motivo}`);
        }
      }

      conn.release();

      let resumen = `Proceso completado. ${exitos.length} productos agregados.`;
      if (errores.length > 0) {
        resumen += ` ${errores.length} con errores.`;
      }

      // Devolver una estructura JSON con el resumen y la lista de errores
      res.json({ mensaje: resumen, exitos: exitos.length, errores: errores });

    } catch (err) {
      console.error("Error procesando Excel de productos:", err);
      res.status(500).json({ mensaje: 'Error grave al procesar archivo Excel.', error: err.message });
    } finally {
      // Asegurarse de eliminar el archivo temporal
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error al eliminar archivo temporal:", err);
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
    WHERE p.estado = 1
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
    const { nombre_producto, id_categoria, id_proveedor } = req.body;

    if (!nombre_producto || !id_categoria || !id_proveedor) {
      return res.status(400).json({ mensaje: 'Nombre, categoría y proveedor son obligatorios.' });
    }

    // Validación de longitud del nombre
    if (nombre_producto.length > 50) {
      return res.status(400).json({ mensaje: 'El nombre del producto no puede exceder los 50 caracteres.' });
    }

    // Validación de caracteres para el nombre del producto
    if (!nameValidationRegex.test(nombre_producto)) {
      return res.status(400).json({ mensaje: 'El nombre del producto contiene caracteres no válidos. Solo se permiten letras, números y espacios.' });
    }

    // 1. Verificar si ya existe un producto con el mismo nombre, categoría y proveedor.
    const checkDuplicateSql = `
      SELECT p.id_producto, p.estado 
      FROM Productos p
      JOIN ProductoProveedor pp ON p.id_producto = pp.id_producto
      WHERE LOWER(p.nombre_producto) = LOWER(?) 
        AND p.id_categoria = ? 
        AND pp.id_proveedor = ?
    `;
    conexion.query(checkDuplicateSql, [nombre_producto, id_categoria, id_proveedor], (err, results) => {
      if (err) {
        if (req.file) fs.unlinkSync(req.file.path); // Limpiar imagen si hay error
        return res.status(500).json({ mensaje: 'Error al verificar el producto.', error: err });
      }

      if (results.length > 0) {
        const existingProduct = results[0];
        // Si se encuentra un producto con el mismo nombre, categoría y proveedor.
        // Si ya está activo, se rechaza para evitar duplicados exactos.
        // Si está inactivo, se reactiva.
        if (existingProduct.estado === 1) {
          return res.status(409).json({ mensaje: 'Ya existe un producto activo con el mismo nombre, categoría y proveedor.' });
        } else {
          // Reactivar y actualizar el producto inactivo.
          const rutaImagen = req.file ? `/uploads/products/${req.file.filename}` : null;
          const updateSql = 'UPDATE Productos SET nombre_producto = ?, id_categoria = ?, ruta_imagen = ?, estado = 1 WHERE id_producto = ?';
          conexion.query(updateSql, [nombre_producto, id_categoria, rutaImagen, existingProduct.id_producto], (err) => {
            if (err) { if (req.file) fs.unlinkSync(req.file.path); return res.status(500).json({ mensaje: 'Error al reactivar el producto.', error: err }); }
            // No es necesario actualizar ProductoProveedor si la combinación es la misma
            return res.status(200).json({ mensaje: 'Producto reactivado y actualizado correctamente.', id: existingProduct.id_producto });
          });
          return;
        }
      }

      // 2. Si no es un duplicado exacto, proceder con la inserción en una transacción
      conexion.getConnection((err, conn) => {
        if (err) return res.status(500).json({ mensaje: 'Error al obtener conexión', error: err });

        const rutaImagen = req.file ? `/uploads/products/${req.file.filename}` : null;

        conn.beginTransaction(err => {
          if (err) {
            conn.release();
            return res.status(500).json({ mensaje: 'Error al iniciar transacción', error: err });
          }

          conn.query('INSERT INTO Productos (nombre_producto, id_categoria, ruta_imagen) VALUES (?, ?, ?)', [nombre_producto, id_categoria, rutaImagen], (err, result) => {
              if (err) {
                return conn.rollback(() => {
                  conn.release();
                  res.status(500).json({ mensaje: 'Error al crear producto', error: err });
                });
              }

              const id_producto = result.insertId;
              conn.query('INSERT INTO ProductoProveedor (id_producto, id_proveedor) VALUES (?, ?)', [id_producto, id_proveedor], (err) => {
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
                    res.status(201).json({ mensaje: 'Se agregó el producto', id: id_producto });
                  });
                }
              );
            }
          );
        });
      });
    });
  });

  // Actualizar producto y su proveedor
  router.put('/productos/:id', isAuthenticated, isAdmin, uploadProductImage.single('imagen_producto'), async (req, res) => {
    const { id } = req.params;
    const { nombre_producto, id_categoria, id_proveedor, remove_image } = req.body;

    if (!nombre_producto || !id_categoria || !id_proveedor) {
      return res.status(400).json({ mensaje: 'Nombre, categoría y proveedor son obligatorios.' });
    }

    // Validación de longitud del nombre
    if (nombre_producto.length > 50) {
      return res.status(400).json({ mensaje: 'El nombre del producto no puede exceder los 50 caracteres.' });
    }

    // Validación de caracteres para el nombre del producto
    if (!nameValidationRegex.test(nombre_producto)) {
      return res.status(400).json({ mensaje: 'El nombre del producto contiene caracteres no válidos. Solo se permiten letras, números y espacios.' });
    }

    let conn;

    try {
      conn = await conexion.promise().getConnection();

      // 0. Verificar si OTRO producto ya tiene la misma combinación de nombre, categoría y proveedor.
      const [existing] = await conn.query(
        `SELECT p.id_producto 
         FROM Productos p
         JOIN ProductoProveedor pp ON p.id_producto = pp.id_producto
         WHERE LOWER(p.nombre_producto) = LOWER(?) AND p.id_categoria = ? AND pp.id_proveedor = ? AND p.id_producto != ?`,
        [nombre_producto, id_categoria, id_proveedor, id]
      );

      if (existing.length > 0) {
        throw new Error('Ya existe otro producto con el mismo nombre, categoría y proveedor.');
      }

      await conn.beginTransaction();

      // 1. Obtener la ruta de la imagen actual para poder borrarla si es necesario
      const [rows] = await conn.query('SELECT ruta_imagen FROM Productos WHERE id_producto = ?', [id]);
      const oldImagePath = rows.length > 0 ? rows[0].ruta_imagen : null;

      let newImagePath = oldImagePath;

      if (req.file) {
        newImagePath = `/uploads/products/${req.file.filename}`;
        if (oldImagePath) {
          const fullOldPath = path.join(__dirname, '..', oldImagePath);
          fs.unlink(fullOldPath, (err) => {
            if (err) console.error(`Error al eliminar imagen antigua ${fullOldPath}:`, err);
          });
        }
      } else if (remove_image === 'true') {
        newImagePath = null;
        if (oldImagePath) {
          const fullOldPath = path.join(__dirname, '..', oldImagePath);
          fs.unlink(fullOldPath, (err) => {
            if (err) console.error(`Error al eliminar imagen ${fullOldPath}:`, err);
          });
        }
      }

      await conn.query(
        'UPDATE Productos SET nombre_producto = ?, id_categoria = ?, ruta_imagen = ? WHERE id_producto = ?',
        [nombre_producto, id_categoria, newImagePath, id]
      );

      await conn.query(
        `INSERT INTO ProductoProveedor (id_producto, id_proveedor) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE id_proveedor = VALUES(id_proveedor)`,
        [id, id_proveedor]
      );

      await conn.commit();

      res.json({ mensaje: 'Producto actualizado correctamente' });

    } catch (error) {
      if (conn) await conn.rollback();

      if (req.file) {
        const tempPath = path.join(__dirname, '..', `/uploads/products/${req.file.filename}`);
        fs.unlink(tempPath, (err) => {
          if (err) console.error(`Error al limpiar archivo temporal ${tempPath}:`, err);
        });
      }

      console.error('Error al actualizar producto:', error);
      // Si el error es el que creamos nosotros, usamos 409, si no, 500.
      const statusCode = error.message.includes('Ya existe otro producto') ? 409 : 500; // 409 Conflict
      res.status(statusCode).json({ mensaje: error.message || 'Error en el servidor al actualizar el producto' });

    } finally {
      if (conn) conn.release();
    }
  });

  // Eliminar producto
  router.delete('/productos/:id', isAuthenticated, isAdmin, async (req, res) => {
    const { id } = req.params;
    let conn;

    try {
      // Cambiar el estado a 2 (inactivo) en lugar de eliminar
      const [updateResult] = await conexion.promise().query(
        'UPDATE Productos SET estado = 2 WHERE id_producto = ?',
        [id]
      );

      if (updateResult.affectedRows === 0) throw new Error('El producto no fue encontrado.');

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
router.post('/proveedores/upload', isAuthenticated, isAdmin, upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Validación estricta de columnas: deben ser exactamente 'Nombre', 'Telefono', 'Correo', 'Direccion'.
    const expectedColumns = ['Nombre', 'Telefono', 'Correo', 'Direccion'];
    const actualColumns = data.length > 0 ? Object.keys(data[0]) : [];
    const isValid = expectedColumns.length === actualColumns.length && expectedColumns.every(col => actualColumns.includes(col));

    if (!isValid) {
      return res.json({
        mensaje: 'Archivo no válido. Asegúrese de que el archivo Excel de proveedores contenga exactamente las columnas: "Nombre", "Telefono", "Correo" y "Direccion".',
        errores: [
          'El formato de las columnas del archivo es incorrecto o no corresponde a un archivo de proveedores.'
        ],
        exitos: 0
      });
    }

    const exitos = [];
    const errores = [];

    for (const [index, row] of data.entries()) {
      const nombre = row.Nombre;
      const telefono = row.Telefono ? String(row.Telefono).replace(/\s/g, '') : ''; // Convertir a string y quitar espacios
      const correo = row.Correo || '';
      const fila = index + 2;

      if (!nombre) {
        errores.push(`Fila ${fila}: Falta el nombre del proveedor.`);
        continue;
      }

      // Validación de longitud del nombre
      if (nombre.length > 50) {
        errores.push(`Fila ${fila} (${nombre}): El nombre es demasiado largo (máximo 50 caracteres).`);
        continue;
      }

      // Validación de caracteres para el nombre del proveedor
      if (!nameValidationRegex.test(nombre)) {
        errores.push(`Fila ${fila} (${nombre}): El nombre contiene caracteres no válidos (solo letras, números y espacios).`);
        continue;
      }

      // --- VALIDACIONES AÑADIDAS ---
      // 1. Validar formato del teléfono (numérico, 10-15 dígitos)
      if (telefono && !/^\d{10,15}$/.test(telefono)) {
        errores.push(`Fila ${fila} (${nombre}): El teléfono "${row.Telefono}" no es válido. Debe tener entre 10 y 15 dígitos numéricos.`);
        continue; // Saltar a la siguiente fila
      }

      // 2. Validar formato del correo (usando una expresión regular)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (correo && !emailRegex.test(correo)) {
        errores.push(`Fila ${fila} (${nombre}): El correo "${correo}" no tiene un formato válido.`);
        continue; // Saltar a la siguiente fila
      }
      // --- FIN DE VALIDACIONES ---

      try {
        // 1. Verificar si el proveedor ya existe (insensible a mayúsculas/minúsculas)
        // Modificamos la consulta para que también devuelva el estado
        const [existing] = await conexion.promise().query(
          'SELECT id_proveedor, estado FROM Proveedores WHERE LOWER(nombre_proveedor) = LOWER(?)',
          [nombre]
        );

        if (existing.length > 0) {
          if (existing[0].estado === 1) {
            errores.push(`Fila ${fila} (${nombre}): Ya existe un proveedor activo con este nombre.`);
          } else {
            // Reactivar y actualizar el proveedor inactivo
            await conexion.promise().query(
              'UPDATE Proveedores SET telefono = ?, correo = ?, direccion = ?, estado = 1 WHERE id_proveedor = ?',
              [telefono, correo, row.Direccion, existing[0].id_proveedor]
            );
            exitos.push(`${nombre} (reactivado)`);
          }
        } else {
          // 2. Si no existe, insertarlo
          await conexion.promise().query(
            'INSERT INTO Proveedores (nombre_proveedor, telefono, correo, direccion) VALUES (?, ?, ?, ?)',
            [nombre, telefono, correo, row.Direccion]
          );
          exitos.push(nombre);
        }
      } catch (error) {
        errores.push(`Fila ${fila} (${nombre}): Error inesperado en la base de datos.`);
      }
    }

    let resumen = `Proceso completado. ${exitos.length} proveedores agregados.`;
    if (errores.length > 0) {
      resumen += ` ${errores.length} con errores.`;
    }

    res.json({ mensaje: resumen, exitos: exitos.length, errores: errores });

  } catch (err) {
    res.status(500).json({ mensaje: 'Error grave al procesar archivo Excel.', error: err.message });
  } finally {
    // Asegurarse de eliminar el archivo temporal
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error al eliminar archivo temporal de proveedores:", err);
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
  conexion.query('SELECT * FROM Proveedores WHERE id_proveedor = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener proveedor', error: err });
    if (!results.length) return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
    res.json(results[0]);
  });
});

// Crear proveedor
router.post('/proveedores', isAuthenticated, isAdmin, (req, res) => {
  const { nombre_proveedor, telefono, correo, direccion } = req.body;
  if (!nombre_proveedor || !telefono) {
    return res.status(400).json({ mensaje: 'El nombre y el teléfono del proveedor son obligatorios.' });
  }

  // Validación de longitud del nombre
  if (nombre_proveedor.length > 50) {
    return res.status(400).json({ mensaje: 'El nombre del proveedor no puede exceder los 50 caracteres.' });
  }

  // Validación de caracteres para el nombre del proveedor
  if (!nameValidationRegex.test(nombre_proveedor)) {
    return res.status(400).json({ mensaje: 'El nombre del proveedor contiene caracteres no válidos. Solo se permiten letras, números y espacios.' });
  }

  // Verificar si ya existe un proveedor con ese nombre (insensible a mayúsculas/minúsculas)
  // Modificamos la consulta para que también devuelva el estado
  conexion.query('SELECT id_proveedor, estado FROM Proveedores WHERE LOWER(nombre_proveedor) = LOWER(?)', [nombre_proveedor], (err, results) => {
    if (err) {
      return res.status(500).json({ mensaje: 'Error al verificar el proveedor.', error: err });
    }

    if (results.length > 0) {
      const existingSupplier = results[0];
      if (existingSupplier.estado === 1) {
        return res.status(409).json({ mensaje: 'Ya existe un proveedor activo con ese nombre.' });
      } else {
        // Reactivar y actualizar el proveedor inactivo
        const updateSql = 'UPDATE Proveedores SET telefono = ?, correo = ?, direccion = ?, estado = 1 WHERE id_proveedor = ?';
        conexion.query(updateSql, [telefono, correo, direccion, existingSupplier.id_proveedor], (err) => {
          if (err) return res.status(500).json({ mensaje: 'Error al reactivar el proveedor.', error: err });
          return res.status(200).json({ mensaje: 'Proveedor reactivado y actualizado correctamente.', id: existingSupplier.id_proveedor });
        });
        return;
      }
    }

    // Si no existe, proceder con la inserción
    conexion.query(
      'INSERT INTO Proveedores (nombre_proveedor, telefono, correo, direccion) VALUES (?, ?, ?, ?)',
      [nombre_proveedor, telefono, correo, direccion],
      (err, result) => {
        if (err) return res.status(500).json({ mensaje: 'Error al crear proveedor', error: err });
        res.status(201).json({ mensaje: 'Proveedor creado correctamente', id: result.insertId });
      }
    );
  });
});

// Actualizar proveedor
router.put('/proveedores/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  const { nombre_proveedor, telefono, correo, direccion } = req.body;

  if (!nombre_proveedor) {
    return res.status(400).json({ mensaje: 'El nombre del proveedor es obligatorio.' });
  }

  // Validación de longitud del nombre
  if (nombre_proveedor.length > 50) {
    return res.status(400).json({ mensaje: 'El nombre del proveedor no puede exceder los 50 caracteres.' });
  }

  // Validación de caracteres para el nombre del proveedor
  if (!nameValidationRegex.test(nombre_proveedor)) {
    return res.status(400).json({ mensaje: 'El nombre del proveedor contiene caracteres no válidos. Solo se permiten letras, números y espacios.' });
  }

  // Verificar si OTRO proveedor ya tiene ese nombre
  const checkSql = 'SELECT id_proveedor FROM Proveedores WHERE LOWER(nombre_proveedor) = LOWER(?) AND id_proveedor != ?';
  conexion.query(checkSql, [nombre_proveedor, id], (err, results) => {
    if (err) {
      return res.status(500).json({ mensaje: 'Error al verificar duplicados.', error: err });
    }

    if (results.length > 0) {
      return res.status(409).json({ mensaje: 'Ya existe otro proveedor con ese nombre.' });
    }

    // Si no hay duplicados, proceder a actualizar
    const updateSql = 'UPDATE Proveedores SET nombre_proveedor=?, telefono=?, correo=?, direccion=? WHERE id_proveedor=?';
    conexion.query(updateSql, [nombre_proveedor, telefono, correo, direccion, id], (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error al actualizar el proveedor.', error: err });
      res.json({ mensaje: 'Proveedor actualizado correctamente' });
    });
  });
});

// Eliminar proveedor
router.delete('/proveedores/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;

  // 1. Verificar si el proveedor está en uso por productos ACTIVOS
  const checkUsageSql = `
    SELECT COUNT(*) AS count 
    FROM ProductoProveedor pp
    JOIN Productos p ON pp.id_producto = p.id_producto
    WHERE pp.id_proveedor = ? AND p.estado = 1
  `;
  conexion.query(checkUsageSql, [id], (err, results) => {
    if (err) {
      return res.status(500).json({ mensaje: 'Error al verificar el uso del proveedor.', error: err });
    }

    const count = results[0].count;
    if (count > 0) { // Si está en uso por productos activos, no permitir la eliminación
      return res.status(409).json({ // 409 Conflict es un buen código de estado para esto
        mensaje: `No se puede eliminar. El proveedor está asignado a ${count} producto(s) activo(s).`
      });
    }

    // 2. Si no está en uso por productos activos, proceder a marcar como inactivo
    const updateSql = 'UPDATE Proveedores SET estado = 2 WHERE id_proveedor = ?';
    conexion.query(updateSql, [id], (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error al eliminar el proveedor.', error: err });
      if (result.affectedRows === 0) return res.status(404).json({ mensaje: 'Proveedor no encontrado.' });
      res.json({ mensaje: 'Proveedor eliminado con éxito.' });
    });
  });
});

// --- CATEGORÍAS ---

// === CARGAR CATEGORÍAS DESDE EXCEL ===
router.post('/categorias/upload', isAuthenticated, isAdmin, upload.single('file'), async (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Validación estricta de columnas: debe ser exactamente 'Nombre'.
    const expectedColumns = ['Nombre'];
    const actualColumns = data.length > 0 ? Object.keys(data[0]) : [];
    const isValid = expectedColumns.length === actualColumns.length && expectedColumns.every(col => actualColumns.includes(col));

    if (!isValid) {
      return res.json({ 
        mensaje: 'Archivo no válido. Asegúrese de que el archivo Excel de categorías contenga exactamente la columna "Nombre".',
        errores: [
          'El formato de las columnas del archivo es incorrecto o no corresponde a un archivo de categorías.'
        ],
        exitos: 0
      });
    }

    const exitos = [];
    const errores = [];

    for (const [index, row] of data.entries()) {
      const nombre = row.Nombre;
      const fila = index + 2;

      if (!nombre) {
        errores.push(`Fila ${fila}: Falta el nombre de la categoría.`);
        continue;
      }

      // Validación de caracteres para el nombre de la categoría
      if (!nameValidationRegex.test(nombre)) {
        errores.push(`Fila ${fila} (${nombre.substring(0, 20)}...): El nombre contiene caracteres no válidos (solo letras, números y espacios).`);
        continue;
      }

      // Validación de longitud del nombre
      if (nombre.length > 50) {
        errores.push(`Fila ${fila} (${nombre.substring(0, 20)}...): El nombre es demasiado largo (máximo 50 caracteres).`);
        continue;
      }

      try {
        // 1. Verificar si la categoría ya existe (insensible a mayúsculas/minúsculas)
        // Modificamos la consulta para que también devuelva el estado
        const [existing] = await conexion.promise().query(
          'SELECT id_categoria, estado FROM CategoriaProductos WHERE LOWER(nombre_categoria) = LOWER(?)',
          [nombre]
        );

        if (existing.length > 0) {
          if (existing[0].estado === 1) {
            errores.push(`Fila ${fila} (${nombre}): Ya existe una categoría activa con este nombre.`);
          } else {
            // Reactivar la categoría inactiva
            await conexion.promise().query('UPDATE CategoriaProductos SET estado = 1 WHERE id_categoria = ?', [existing[0].id_categoria]);
            exitos.push(`${nombre} (reactivada)`);
          }
        } else {
          // 2. Si no existe, insertarla
          await conexion.promise().query('INSERT INTO CategoriaProductos (nombre_categoria) VALUES (?)', [nombre]);
          exitos.push(nombre);
        }
      } catch (error) {
        // Añadir un log para depuración en el servidor
        console.error(`Error en fila ${fila} para categoría "${nombre}":`, error);
        // Proveer un mensaje de error más útil
        const motivo = error.code === 'ER_DATA_TOO_LONG' ? 'El nombre es demasiado largo.' : 'Error inesperado en la BD.';
        errores.push(`Fila ${fila} (${nombre.substring(0, 20)}...): ${motivo}`);
      }
    }

    let resumen = `Proceso completado. ${exitos.length} categorías agregadas.`;
    if (errores.length > 0) {
      resumen += ` ${errores.length} con errores.`;
    }

    res.json({ mensaje: resumen, exitos: exitos.length, errores: errores });
  } catch (err) {
    res.status(500).json({ mensaje: 'Error grave al procesar archivo Excel.', error: err.message });
  } finally {
    // Asegurarse de eliminar el archivo temporal
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error al eliminar archivo temporal de categorías:", err);
      });
    }
  }
});

// Obtener todas las categorías (para la tabla de administración)
router.get('/categorias', isAuthenticated, isAdmin, (req, res) => {
  conexion.query('SELECT * FROM CategoriaProductos WHERE estado = 1 ORDER BY id_categoria ASC', (err, results) => {
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

  // Validación de longitud del nombre
  if (nombre_categoria.length > 50) {
    return res.status(400).json({ mensaje: 'El nombre de la categoría no puede exceder los 50 caracteres.' });
  }

  // Validación de caracteres para el nombre de la categoría
  if (!nameValidationRegex.test(nombre_categoria)) {
    return res.status(400).json({ mensaje: 'El nombre de la categoría contiene caracteres no válidos. Solo se permiten letras, números y espacios.' });
  }

  // Verificar si ya existe una categoría con ese nombre (insensible a mayúsculas/minúsculas)
  // Modificamos la consulta para que también devuelva el estado
  conexion.query('SELECT id_categoria, estado FROM CategoriaProductos WHERE LOWER(nombre_categoria) = LOWER(?)', [nombre_categoria], (err, results) => {
    if (err) {
      return res.status(500).json({ mensaje: 'Error al verificar la categoría.', error: err });
    }

    if (results.length > 0) {
      const existingCategory = results[0];
      if (existingCategory.estado === 1) {
        return res.status(409).json({ mensaje: 'Ya existe una categoría activa con ese nombre.' });
      } else {
        // Reactivar la categoría inactiva (el nombre es el mismo)
        const updateSql = 'UPDATE CategoriaProductos SET estado = 1 WHERE id_categoria = ?';
        conexion.query(updateSql, [existingCategory.id_categoria], (err) => {
          if (err) return res.status(500).json({ mensaje: 'Error al reactivar la categoría.', error: err });
          return res.status(200).json({ mensaje: 'Categoría reactivada correctamente.', id: existingCategory.id_categoria });
        });
        return;
      }
    }

    // Si no existe, proceder con la inserción
    conexion.query(
      'INSERT INTO CategoriaProductos (nombre_categoria) VALUES (?)',
      [nombre_categoria],
      (err, result) => {
        if (err) return res.status(500).json({ mensaje: 'Error al crear la categoría', error: err });
        res.status(201).json({ mensaje: 'Categoría creada correctamente', id: result.insertId });
      }
    );
  });
});

// Actualizar categoría
router.put('/categorias/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;
  const { nombre_categoria } = req.body;

  if (!nombre_categoria) {
    return res.status(400).json({ mensaje: 'El nombre de la categoría es obligatorio.' });
  }

  // Validación de longitud del nombre
  if (nombre_categoria.length > 50) {
    return res.status(400).json({ mensaje: 'El nombre de la categoría no puede exceder los 50 caracteres.' });
  }

  // Validación de caracteres para el nombre de la categoría
  if (!nameValidationRegex.test(nombre_categoria)) {
    return res.status(400).json({ mensaje: 'El nombre de la categoría contiene caracteres no válidos. Solo se permiten letras, números y espacios.' });
  }

  // Verificar si OTRA categoría ya tiene ese nombre
  const checkSql = 'SELECT id_categoria FROM CategoriaProductos WHERE LOWER(nombre_categoria) = LOWER(?) AND id_categoria != ?';
  conexion.query(checkSql, [nombre_categoria, id], (err, results) => {
    if (err) {
      return res.status(500).json({ mensaje: 'Error al verificar duplicados.', error: err });
    }

    if (results.length > 0) {
      return res.status(409).json({ mensaje: 'Ya existe otra categoría con ese nombre.' });
    }

    // Si no hay duplicados, proceder a actualizar
    conexion.query(
      'UPDATE CategoriaProductos SET nombre_categoria = ? WHERE id_categoria = ?',
      [nombre_categoria, id],
      (err) => {
        if (err) return res.status(500).json({ mensaje: 'Error al actualizar la categoría.', error: err });
        res.json({ mensaje: 'Categoría actualizada correctamente' });
      }
    );
  });
});

// Eliminar categoría
router.delete('/categorias/:id', isAuthenticated, isAdmin, (req, res) => {
  const { id } = req.params;

  // 1. Verificar si la categoría está en uso por productos ACTIVOS
  const checkUsageSql = 'SELECT COUNT(*) AS count FROM Productos WHERE id_categoria = ? AND estado = 1';
  conexion.query(checkUsageSql, [id], (err, results) => {
    if (err) {
      return res.status(500).json({ mensaje: 'Error al verificar el uso de la categoría.', error: err });
    }

    const count = results[0].count;
    if (count > 0) { // Si está en uso por productos activos, no permitir la eliminación
      return res.status(409).json({
        mensaje: `No se puede eliminar. La categoría está en uso por ${count} producto(s) activo(s).`
      });
    }

    // 2. Si no está en uso por productos activos, proceder a marcar como inactiva
    const updateSql = 'UPDATE CategoriaProductos SET estado = 2 WHERE id_categoria = ?';
    conexion.query(updateSql, [id], (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error al eliminar la categoría.', error: err });
      if (result.affectedRows === 0) return res.status(404).json({ mensaje: 'Categoría no encontrada.' });
      res.json({ mensaje: 'Categoría eliminada con éxito.' });
    });
  });
});


// --- COTIZACIONES ---

// Listar todas las cotizaciones
router.get('/cotizaciones', isAuthenticated, isAdmin, (req, res) => {
  const sql = `
    SELECT c.id_cotizacion, c.id_usuario, c.fecha_cotizacion, c.estado_cotizacion, c.total,
           u.correo AS correo_usuario
    FROM Cotizaciones c
    JOIN Usuario u ON c.id_usuario = u.id_usuario
    ORDER BY c.fecha_cotizacion DESC
  `;
  conexion.query(sql, (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al listar cotizaciones' });
    res.json(results);
  });
});

// Obtener detalles
router.get('/cotizaciones/:id/detalles', isAuthenticated, isAdmin, (req, res) => {
  const id = req.params.id;

  const sql = `
    SELECT d.id_detalle, d.id_cotizacion, d.id_producto, d.cantidad,
           d.precio_unitario, d.subtotal,
           p.nombre_producto, p.ruta_imagen
    FROM DetalleCotizacion d
    JOIN Productos p ON d.id_producto = p.id_producto
    WHERE d.id_cotizacion = ?
  `;
  conexion.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener detalles' });
    res.json(results);
  });
});

// Actualizar detalles (precio_unitario + subtotal)
router.post('/cotizaciones/:id/detalles/update', isAuthenticated, isAdmin, (req, res) => {
  const detalles = req.body;
  const idCot = req.params.id;

  if (!Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({ mensaje: 'No hay detalles para actualizar' });
  }

  conexion.getConnection((err, conn) => {
    if (err) return res.status(500).json({ mensaje: 'Error de conexión' });

    conn.beginTransaction(async txErr => {
      if (txErr) return res.status(500).json({ mensaje: 'Error iniciando transacción' });

      try {
        for (const d of detalles) {
          const precio = d.precio_unitario == null ? null : Number(d.precio_unitario);
          const subtotal = d.subtotal == null ? null : Number(d.subtotal);

          await new Promise((resolve, reject) => {
            conn.query(
              `UPDATE DetalleCotizacion SET precio_unitario=?, subtotal=? 
               WHERE id_detalle=? AND id_cotizacion=?`,
              [precio, subtotal, d.id_detalle, idCot],
              (e) => e ? reject(e) : resolve()
            );
          });
        }

        // Calcular total y actualizar la cotización
        await new Promise((resolve, reject) => {
          conn.query(
            `UPDATE Cotizaciones
             SET total = (SELECT SUM(subtotal) FROM DetalleCotizacion WHERE id_cotizacion = ?)
             WHERE id_cotizacion = ?`,
            [idCot, idCot],
            (e) => e ? reject(e) : resolve()
          );
        });

        conn.commit(() => {
          conn.release();
          res.json({ mensaje: 'Detalles actualizados correctamente' });
        });

      } catch (err2) {
        conn.rollback(() => conn.release());
        res.status(500).json({ mensaje: 'Error en actualización' });
      }
    });
  });
});

// Marcar cotización como Devuelta
router.post('/cotizaciones/:id/mark-returned', isAuthenticated, isAdmin, (req, res) => {
  conexion.query(
    `UPDATE Cotizaciones SET estado_cotizacion='Devuelta' WHERE id_cotizacion=?`,
    [req.params.id],
    err => {
      if (err) return res.status(500).json({ mensaje: 'Error al actualizar estado' });
      res.json({ mensaje: 'Cotización marcada como Devuelta' });
    }
  );
});

// Eliminar detalle de cotización
router.delete('/cotizaciones/:id/detalles/:idDetalle', isAuthenticated, isAdmin, (req, res) => {
  const { id, idDetalle } = req.params;
  
  conexion.query(
    `DELETE FROM DetalleCotizacion WHERE id_detalle = ? AND id_cotizacion = ?`,
    [idDetalle, id],
    (err) => {
      if (err) return res.status(500).json({ mensaje: 'Error al eliminar detalle' });
      
      // Recalcular total
      conexion.query(
        `UPDATE Cotizaciones SET total = (SELECT SUM(cantidad * COALESCE(precio_unitario, 0)) FROM DetalleCotizacion WHERE id_cotizacion = ?) WHERE id_cotizacion = ?`,
        [id, id],
        (err2) => {
          if (err2) return res.status(500).json({ mensaje: 'Error al recalcular total' });
          res.json({ mensaje: 'Detalle eliminado' });
        }
      );
    }
  );
});

// Actualizar cantidades de detalles
router.post('/cotizaciones/:id/cantidades/update', isAuthenticated, isAdmin, (req, res) => {
  const detalles = req.body;
  const idCot = req.params.id;

  if (!Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({ mensaje: 'No hay detalles para actualizar' });
  }

  conexion.getConnection((err, conn) => {
    if (err) return res.status(500).json({ mensaje: 'Error de conexión' });

    conn.beginTransaction(async txErr => {
      if (txErr) return res.status(500).json({ mensaje: 'Error iniciando transacción' });

      try {
        for (const d of detalles) {
          const cantidad = d.cantidad || 1;

          await new Promise((resolve, reject) => {
            conn.query(
              `UPDATE DetalleCotizacion SET cantidad = ? WHERE id_detalle = ? AND id_cotizacion = ?`,
              [cantidad, d.id_detalle, idCot],
              (e) => e ? reject(e) : resolve()
            );
          });
        }

        // Recalcular total
        await new Promise((resolve, reject) => {
          conn.query(
            `UPDATE Cotizaciones SET total = (SELECT SUM(cantidad * COALESCE(precio_unitario, 0)) FROM DetalleCotizacion WHERE id_cotizacion = ?) WHERE id_cotizacion = ?`,
            [idCot, idCot],
            (e) => e ? reject(e) : resolve()
          );
        });

        conn.commit(() => {
          conn.release();
          res.json({ mensaje: 'Cantidades actualizadas' });
        });

      } catch (err2) {
        conn.rollback(() => conn.release());
        res.status(500).json({ mensaje: 'Error en actualización' });
      }
    });
  });
});

// Agregar producto a cotización
router.post('/cotizaciones/:id/productos/add', isAuthenticated, isAdmin, (req, res) => {
  const { id_producto, cantidad } = req.body;
  const idCot = req.params.id;

  if (!id_producto || !cantidad) {
    return res.status(400).json({ mensaje: 'Datos incompletos' });
  }

  // Verificar si el producto ya existe en la cotización
  conexion.query(
    `SELECT id_detalle FROM DetalleCotizacion WHERE id_cotizacion = ? AND id_producto = ?`,
    [idCot, id_producto],
    (err, results) => {
      if (err) return res.status(500).json({ mensaje: 'Error verificando producto' });

      if (results.length > 0) {
        // Si existe, actualizar cantidad
        conexion.query(
          `UPDATE DetalleCotizacion SET cantidad = cantidad + ? WHERE id_detalle = ?`,
          [cantidad, results[0].id_detalle],
          (err2) => {
            if (err2) return res.status(500).json({ mensaje: 'Error actualizando cantidad' });
            res.json({ mensaje: 'Cantidad actualizada' });
          }
        );
      } else {
        // Si no existe, insertar nuevo detalle
        conexion.query(
          `INSERT INTO DetalleCotizacion (id_cotizacion, id_producto, cantidad) VALUES (?, ?, ?)`,
          [idCot, id_producto, cantidad],
          (err3) => {
            if (err3) return res.status(500).json({ mensaje: 'Error al agregar producto' });
            res.json({ mensaje: 'Producto agregado' });
          }
        );
      }
    }
  );
});

// --- Panel de administración ---
router.get('/panel/:archivo', isAuthenticated, isAdmin, (req, res) => {
  const archivosPermitidos = ['admin-users.html', 'admin-products.html', 'admin-suppliers.html', 'admin-categories.html', 'admin-quotes.html'];
  const archivo = req.params.archivo;

  if (!archivosPermitidos.includes(archivo)) {
    return res.status(404).send('Archivo no encontrado');
  }

  res.sendFile(path.join(__dirname, '..', 'Private', archivo));
});

  return router; // Retorna el router configurado
};
