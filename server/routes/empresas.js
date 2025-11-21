const express = require('express');
const router = express.Router();
const pool = require('../db');

const fields = ['nombre', 'rut', 'direccion', 'giro', 'comuna'];

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const [rows] = await pool.query(
      'SELECT id, nombre, rut, direccion, giro, comuna FROM empresas WHERE usuario_id = ? ORDER BY nombre ASC',
      [userId]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const data = fields.reduce((acc, field) => {
      acc[field] = req.body[field] || null;
      return acc;
    }, {});

    if (!data.nombre || !data.rut) {
      return res.status(400).json({ message: 'nombre y rut son obligatorios' });
    }

    const [result] = await pool.query(
      `INSERT INTO empresas (usuario_id, nombre, rut, direccion, giro, comuna) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, data.nombre, data.rut, data.direccion, data.giro, data.comuna]
    );

    const [empresa] = await pool.query('SELECT id, nombre, rut, direccion, giro, comuna FROM empresas WHERE id = ?', [result.insertId]);
    res.status(201).json(empresa[0]);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const empresaId = req.params.id;
    const userId = req.user?.id;
    const data = fields.reduce((acc, field) => {
      acc[field] = req.body[field] ?? null;
      return acc;
    }, {});

    const [result] = await pool.query(
      `UPDATE empresas SET nombre = ?, rut = ?, direccion = ?, giro = ?, comuna = ?
       WHERE id = ? AND usuario_id = ?`,
      [data.nombre, data.rut, data.direccion, data.giro, data.comuna, empresaId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    const [empresa] = await pool.query('SELECT id, nombre, rut, direccion, giro, comuna FROM empresas WHERE id = ?', [empresaId]);
    res.json(empresa[0]);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const empresaId = req.params.id;
    const userId = req.user?.id;
    const [result] = await pool.query('DELETE FROM empresas WHERE id = ? AND usuario_id = ?', [empresaId, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
