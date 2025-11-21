const express = require('express');
const router = express.Router();
const pool = require('../db');

const getEmpresaByNombre = async (nombre, userId) => {
  const [rows] = await pool.query(
    'SELECT id FROM empresas WHERE nombre = ? AND usuario_id = ? LIMIT 1',
    [nombre, userId]
  );
  return rows[0];
};

router.get('/', async (req, res, next) => {
  try {
    const { empresa } = req.query;
    const userId = req.user?.id;

    if (!empresa) {
      return res.status(400).json({ message: 'empresa es obligatoria' });
    }
    if (!userId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const empresaRow = await getEmpresaByNombre(empresa, userId);
    if (!empresaRow) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    const [rows] = await pool.query(
      `SELECT id, nombre, es_base AS esBase, empresa_id IS NULL AS esGlobal
       FROM tipos_cuenta
       WHERE empresa_id IS NULL OR empresa_id = ?
       ORDER BY es_base DESC, nombre ASC`,
      [empresaRow.id]
    );

    res.json(rows.map(row => ({
      id: row.id,
      nombre: row.nombre,
      esBase: !!row.esBase,
      esGlobal: !!row.esGlobal
    })));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { empresa, nombre } = req.body;
    const userId = req.user?.id;

    if (!empresa || !nombre) {
      return res.status(400).json({ message: 'empresa y nombre son obligatorios' });
    }
    if (!userId) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    const nombreNormalizado = nombre.trim();
    if (!nombreNormalizado) {
      return res.status(400).json({ message: 'El nombre del tipo no puede estar vacío' });
    }

    const empresaRow = await getEmpresaByNombre(empresa, userId);
    if (!empresaRow) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM tipos_cuenta WHERE nombre = ? AND (empresa_id = ? OR empresa_id IS NULL) LIMIT 1',
      [nombreNormalizado, empresaRow.id]
    );

    if (existing.length) {
      return res.status(409).json({ message: 'El tipo de cuenta ya existe' });
    }

    const [result] = await pool.query(
      'INSERT INTO tipos_cuenta (nombre, es_base, empresa_id, activo) VALUES (?, FALSE, ?, TRUE)',
      [nombreNormalizado, empresaRow.id]
    );

    res.status(201).json({ id: result.insertId, nombre: nombreNormalizado, esBase: false, esGlobal: false });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
