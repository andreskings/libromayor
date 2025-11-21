const express = require('express');
const router = express.Router();
const pool = require('../db');

const getEmpresaId = async (nombre, connection = null) => {
  const db = connection || pool;
  const [rows] = await db.query('SELECT id FROM empresas WHERE nombre = ?', [nombre]);
  return rows[0]?.id;
};

router.get('/', async (req, res, next) => {
  try {
    const { empresa, año } = req.query;
    
    if (!empresa || !año) {
      return res.status(400).json({ message: 'empresa y año son obligatorios' });
    }

    const empresaId = await getEmpresaId(empresa);
    if (!empresaId) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    const añoNumero = parseInt(año, 10);

    const [rows] = await pool.query(
      `SELECT tc.nombre AS tipo, bc.categoria
       FROM balance_configuracion bc
       JOIN tipos_cuenta tc ON tc.id = bc.tipo_cuenta_id
       WHERE bc.empresa_id = ? AND bc.año = ?
       ORDER BY tc.nombre ASC`,
      [empresaId, añoNumero]
    );

    const configuraciones = rows.map(row => ({
      tipo: row.tipo,
      categoria: row.categoria
    }));

    res.json({ empresa, año: añoNumero, configuraciones });
  } catch (error) {
    console.error('[GET /balances] Error:', error);
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { empresa, año, configuraciones } = req.body;

    if (!empresa || !año || !Array.isArray(configuraciones)) {
      await connection.rollback();
      return res.status(400).json({ message: 'empresa, año y configuraciones son obligatorios' });
    }

    const añoNumero = parseInt(año, 10);
    
    if (isNaN(añoNumero) || añoNumero < 1900 || añoNumero > 2100) {
      await connection.rollback();
      return res.status(400).json({ message: 'año debe ser un número válido' });
    }

    const empresaId = await getEmpresaId(empresa, connection);
    if (!empresaId) {
      await connection.rollback();
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    await connection.query(
      'DELETE FROM balance_configuracion WHERE empresa_id = ? AND año = ?',
      [empresaId, añoNumero]
    );

    if (configuraciones.length === 0) {
      await connection.commit();
      return res.status(201).json({ 
        message: 'Configuración guardada correctamente',
        total: 0
      });
    }

    const tiposNombres = [...new Set(configuraciones.map(c => c.tipo))];
    
    const [tiposCuenta] = await connection.query(
      `SELECT id, nombre FROM tipos_cuenta 
       WHERE nombre IN (?) AND (empresa_id = ? OR empresa_id IS NULL)`,
      [tiposNombres, empresaId]
    );

    const tiposMap = new Map(tiposCuenta.map(t => [t.nombre, t.id]));

    const values = configuraciones
      .filter(c => c.tipo && c.categoria && tiposMap.has(c.tipo))
      .map(c => [empresaId, añoNumero, tiposMap.get(c.tipo), c.categoria]);

    if (values.length > 0) {
      await connection.query(
        `INSERT INTO balance_configuracion (empresa_id, año, tipo_cuenta_id, categoria)
         VALUES ?`,
        [values]
      );
    }

    await connection.commit();
    
    res.status(201).json({ 
      message: 'Configuración guardada correctamente',
      total: values.length
    });
  } catch (error) {
    await connection.rollback();
    console.error('[POST /balances] Error:', error);
    next(error);
  } finally {
    connection.release();
  }
});

module.exports = router;