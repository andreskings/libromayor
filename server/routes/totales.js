const express = require('express');
const router = express.Router();
const pool = require('../db');

const getEmpresaId = async (nombre) => {
  const [rows] = await pool.query('SELECT id FROM empresas WHERE nombre = ?', [nombre]);
  return rows[0]?.id;
};

const ensureTipoCuenta = async (nombreTipo, empresaId) => {
  const [rows] = await pool.query(
    'SELECT id FROM tipos_cuenta WHERE nombre = ? AND (empresa_id = ? OR empresa_id IS NULL) LIMIT 1',
    [nombreTipo, empresaId]
  );
  if (rows.length) return rows[0].id;

  const [result] = await pool.query(
    'INSERT INTO tipos_cuenta (nombre, es_base, empresa_id) VALUES (?, FALSE, ?)',
    [nombreTipo, empresaId]
  );
  return result.insertId;
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

    const [rows] = await pool.query(
      `SELECT tc.nombre AS tipo, ta.total_debito, ta.total_credito
       FROM totales_anuales ta
       JOIN tipos_cuenta tc ON tc.id = ta.tipo_cuenta_id
       WHERE ta.empresa_id = ? AND ta.año = ?
       ORDER BY tc.nombre ASC`,
      [empresaId, año]
    );

    res.json({ empresa, año, tipos: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { empresa, año, totales } = req.body;
    if (!empresa || !año || !totales || typeof totales !== 'object') {
      return res.status(400).json({ message: 'empresa, año y totales son obligatorios' });
    }

    const empresaId = await getEmpresaId(empresa);
    if (!empresaId) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    await connection.query('DELETE FROM totales_anuales WHERE empresa_id = ? AND año = ?', [empresaId, año]);

    for (const [tipo, valores] of Object.entries(totales)) {
      const tipoId = await ensureTipoCuenta(tipo, empresaId);
      await connection.query(
        `INSERT INTO totales_anuales (empresa_id, año, tipo_cuenta_id, total_debito, total_credito)
         VALUES (?, ?, ?, ?, ?)`,
        [empresaId, año, tipoId, valores.debito || 0, valores.credito || 0]
      );
    }

    await connection.commit();
    res.status(201).json({ message: 'Totales guardados correctamente' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

module.exports = router;
