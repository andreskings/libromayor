// server/routes/registros.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

const getEmpresaId = async (empresaNombre) => {
  const [rows] = await pool.query('SELECT id FROM empresas WHERE nombre = ?', [empresaNombre]);
  return rows[0]?.id;
};

router.get('/', async (req, res, next) => {
  try {
    const { empresa, mes, año } = req.query;

    if (!empresa) {
      return res.status(400).json({ message: 'empresa es obligatoria' });
    }

    const empresaId = await getEmpresaId(empresa);
    if (!empresaId) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    const params = [empresaId];
    let whereClause = 'WHERE r.empresa_id = ?';

    if (mes) {
      whereClause += ' AND r.mes = ?';
      params.push(mes);
    }

    if (año) {
      whereClause += ' AND r.año = ?';
      params.push(año);
    }

    // ✅ OPTIMIZACIÓN: Single query con JOIN para traer todo de una vez
    const [rows] = await pool.query(
      `SELECT 
        r.id, 
        r.mes, 
        r.año, 
        r.control, 
        r.total, 
        r.fecha_registro,
        e.nombre AS empresa,
        rd.detalle,
        rd.tipo_transaccion,
        rd.monto,
        tc.nombre as tipo,
        rd.orden
       FROM registros r
       JOIN empresas e ON e.id = r.empresa_id
       LEFT JOIN registros_detalle rd ON rd.registro_id = r.id
       LEFT JOIN tipos_cuenta tc ON tc.id = rd.tipo_cuenta_id
       ${whereClause}
       ORDER BY r.fecha_registro DESC, rd.orden ASC`,
      params
    );

    // Agrupar los resultados por registro
    const registrosMap = new Map();
    
    rows.forEach(row => {
      if (!registrosMap.has(row.id)) {
        registrosMap.set(row.id, {
          id: row.id,
          empresa: row.empresa,
          mes: row.mes,
          año: row.año,
          control: row.control,
          total: row.total,
          date: row.fecha_registro,
          datos: []
        });
      }

      if (row.detalle) { // Si tiene detalles
        registrosMap.get(row.id).datos.push({
          detalle: row.detalle,
          tipo: row.tipo,
          tipoTransaccion: row.tipo_transaccion,
          monto: row.monto
        });
      }
    });

    const registros = Array.from(registrosMap.values());
    res.json(registros);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { empresa, mes, año, datos, control, total } = req.body;

    if (!empresa || !mes || !año || !Array.isArray(datos) || datos.length === 0) {
      return res.status(400).json({ message: 'empresa, mes, año y datos son obligatorios' });
    }

    const empresaId = await getEmpresaId(empresa);
    if (!empresaId) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    const [insertRegistro] = await connection.query(
      `INSERT INTO registros (empresa_id, mes, año, control, total, fecha_registro)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [empresaId, mes, año, control || 0, total || 0]
    );

    const registroId = insertRegistro.insertId;

    // ✅ OPTIMIZACIÓN: Obtener todos los tipos de cuenta de una vez
    const tiposNombres = [...new Set(datos.map(d => d.tipo))];
    const [tiposCuenta] = await connection.query(
      `SELECT id, nombre FROM tipos_cuenta 
       WHERE nombre IN (?) AND (empresa_id = ? OR empresa_id IS NULL)`,
      [tiposNombres, empresaId]
    );

    const tiposMap = new Map(tiposCuenta.map(t => [t.nombre, t.id]));

    // Verificar que todos los tipos existan
    for (const dato of datos) {
      if (!tiposMap.has(dato.tipo)) {
        throw new Error(`Tipo de cuenta "${dato.tipo}" no existe`);
      }
    }

    // ✅ OPTIMIZACIÓN: Bulk insert para detalles
    const detalleValues = datos.map((dato, i) => [
      registroId,
      dato.detalle,
      tiposMap.get(dato.tipo),
      dato.tipoTransaccion,
      dato.monto,
      i
    ]);

    if (detalleValues.length > 0) {
      await connection.query(
        `INSERT INTO registros_detalle (registro_id, detalle, tipo_cuenta_id, tipo_transaccion, monto, orden)
         VALUES ?`,
        [detalleValues]
      );
    }

    // ✅ OPTIMIZACIÓN: Bulk insert para movimientos
    const movimientosDebe = [];
    const movimientosHaber = [];

    datos.forEach(dato => {
      const values = [
        empresaId,
        mes,
        año,
        dato.detalle,
        control || 0,
        tiposMap.get(dato.tipo),
        dato.monto
      ];

      if (dato.tipoTransaccion === 'debe') {
        movimientosDebe.push(values);
      } else {
        movimientosHaber.push(values);
      }
    });

    if (movimientosDebe.length > 0) {
      await connection.query(
        `INSERT INTO movimientos_debe (empresa_id, mes, año, detalle, control, tipo_cuenta_id, monto, fecha_movimiento)
         VALUES ?`,
        [movimientosDebe.map(v => [...v, new Date()])]
      );
    }

    if (movimientosHaber.length > 0) {
      await connection.query(
        `INSERT INTO movimientos_haber (empresa_id, mes, año, detalle, control, tipo_cuenta_id, monto, fecha_movimiento)
         VALUES ?`,
        [movimientosHaber.map(v => [...v, new Date()])]
      );
    }

    await connection.commit();
    res.status(201).json({ id: registroId });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

module.exports = router;