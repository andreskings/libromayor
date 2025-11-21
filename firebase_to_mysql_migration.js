/**
 * =====================================================
 * SCRIPT DE MIGRACIÓN: FIREBASE A MYSQL
 * Sistema Libro Mayor - Migración de Datos
 * =====================================================
 *
 * Este script migra todos los datos desde Firebase Firestore
 * hacia una base de datos MySQL siguiendo el nuevo esquema.
 *
 * REQUISITOS:
 * - Node.js 14+
 * - npm install firebase mysql2 dotenv
 *
 * USO:
 * 1. Crear archivo .env con credenciales de MySQL
 * 2. Ejecutar: node firebase_to_mysql_migration.js
 *
 * =====================================================
 */

const admin = require('firebase-admin');
const mysql = require('mysql2/promise');
require('dotenv').config();

// =====================================================
// CONFIGURACIÓN DE FIREBASE
// =====================================================
const firebaseConfig = {
  apiKey: "AIzaSyCAshyoEbkhu40kw0WYMg98wDm99B59KZ8",
  authDomain: "cuadernopublico.firebaseapp.com",
  projectId: "cuadernopublico",
  storageBucket: "cuadernopublico.firebasestorage.app",
  messagingSenderId: "48382330347",
  appId: "1:48382330347:web:247499ab1b8489369d85ae"
};

// Inicializar Firebase Admin (requiere service account)
// Para producción, descarga el archivo de credenciales desde Firebase Console
// y colócalo como 'serviceAccountKey.json'
let db;
try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log('✓ Firebase inicializado correctamente');
} catch (error) {
  console.error('✗ Error al inicializar Firebase:', error.message);
  console.log('\nNOTA: Necesitas descargar el archivo serviceAccountKey.json desde:');
  console.log('Firebase Console > Project Settings > Service Accounts > Generate New Private Key');
  process.exit(1);
}

// =====================================================
// CONFIGURACIÓN DE MYSQL
// =====================================================
const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'libromayor',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// =====================================================
// UTILIDADES
// =====================================================
class MigrationLogger {
  constructor() {
    this.stats = {
      empresas: { total: 0, migrados: 0, errores: 0 },
      tipos_cuenta: { total: 0, migrados: 0, errores: 0 },
      registros: { total: 0, migrados: 0, errores: 0 },
      registros_detalle: { total: 0, migrados: 0, errores: 0 },
      movimientos_debe: { total: 0, migrados: 0, errores: 0 },
      movimientos_haber: { total: 0, migrados: 0, errores: 0 },
      totales_anuales: { total: 0, migrados: 0, errores: 0 },
      configuracion_balance: { total: 0, migrados: 0, errores: 0 },
      transactions_legacy: { total: 0, migrados: 0, errores: 0 }
    };
    this.startTime = Date.now();
  }

  log(table, status, message = '') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${table} - ${status}: ${message}`);
  }

  incrementStat(table, type) {
    if (this.stats[table]) {
      this.stats[table][type]++;
    }
  }

  printSummary() {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(60));
    console.log('RESUMEN DE MIGRACIÓN');
    console.log('='.repeat(60));
    console.log(`Duración total: ${duration} segundos\n`);

    Object.entries(this.stats).forEach(([table, stats]) => {
      if (stats.total > 0) {
        console.log(`${table}:`);
        console.log(`  Total: ${stats.total}`);
        console.log(`  Migrados: ${stats.migrados} ✓`);
        console.log(`  Errores: ${stats.errores} ✗`);
        console.log('');
      }
    });
    console.log('='.repeat(60));
  }
}

const logger = new MigrationLogger();

// =====================================================
// FUNCIONES DE MIGRACIÓN
// =====================================================

/**
 * Migrar empresas
 */
async function migrateEmpresas(connection) {
  logger.log('empresas', 'INICIO', 'Iniciando migración de empresas');

  try {
    const snapshot = await db.collection('empresas').get();
    logger.stats.empresas.total = snapshot.size;

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();

        const [result] = await connection.execute(
          `INSERT INTO empresas (firebase_id, nombre, rut, direccion, giro, comuna)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            doc.id,
            data.nombre || '',
            data.rut || '',
            data.direccion || null,
            data.giro || null,
            data.comuna || null
          ]
        );

        logger.incrementStat('empresas', 'migrados');
        logger.log('empresas', 'SUCCESS', `Migrado: ${data.nombre} (${data.rut})`);
      } catch (error) {
        logger.incrementStat('empresas', 'errores');
        logger.log('empresas', 'ERROR', `${doc.id}: ${error.message}`);
      }
    }

    logger.log('empresas', 'COMPLETO', `${logger.stats.empresas.migrados}/${logger.stats.empresas.total} migrados`);
    return true;
  } catch (error) {
    logger.log('empresas', 'ERROR FATAL', error.message);
    return false;
  }
}

/**
 * Migrar tipos de cuenta personalizados
 */
async function migrateTiposCuenta(connection) {
  logger.log('tipos_cuenta', 'INICIO', 'Migrando tipos personalizados');

  try {
    // Obtener empresas de MySQL
    const [empresas] = await connection.execute('SELECT id, firebase_id, nombre FROM empresas');

    for (const empresa of empresas) {
      try {
        // Obtener documento de Firebase
        const empresaDoc = await db.collection('empresas').doc(empresa.firebase_id).get();

        if (empresaDoc.exists) {
          const data = empresaDoc.data();
          const tiposPersonalizados = data.tipos_personalizados || [];

          for (const tipoNombre of tiposPersonalizados) {
            try {
              logger.stats.tipos_cuenta.total++;

              await connection.execute(
                `INSERT INTO tipos_cuenta (nombre, es_base, empresa_id)
                 VALUES (?, FALSE, ?)
                 ON DUPLICATE KEY UPDATE nombre = nombre`,
                [tipoNombre, empresa.id]
              );

              logger.incrementStat('tipos_cuenta', 'migrados');
              logger.log('tipos_cuenta', 'SUCCESS', `${tipoNombre} para ${empresa.nombre}`);
            } catch (error) {
              logger.incrementStat('tipos_cuenta', 'errores');
              logger.log('tipos_cuenta', 'ERROR', `${tipoNombre}: ${error.message}`);
            }
          }
        }
      } catch (error) {
        logger.log('tipos_cuenta', 'ERROR', `Empresa ${empresa.nombre}: ${error.message}`);
      }
    }

    logger.log('tipos_cuenta', 'COMPLETO', `${logger.stats.tipos_cuenta.migrados}/${logger.stats.tipos_cuenta.total} migrados`);
    return true;
  } catch (error) {
    logger.log('tipos_cuenta', 'ERROR FATAL', error.message);
    return false;
  }
}

/**
 * Obtener ID de tipo de cuenta
 */
async function getTipoCuentaId(connection, nombreTipo, empresaId) {
  // Buscar primero en tipos base
  let [rows] = await connection.execute(
    'SELECT id FROM tipos_cuenta WHERE nombre = ? AND es_base = TRUE LIMIT 1',
    [nombreTipo]
  );

  if (rows.length > 0) {
    return rows[0].id;
  }

  // Buscar en tipos personalizados de la empresa
  [rows] = await connection.execute(
    'SELECT id FROM tipos_cuenta WHERE nombre = ? AND empresa_id = ? LIMIT 1',
    [nombreTipo, empresaId]
  );

  if (rows.length > 0) {
    return rows[0].id;
  }

  // Si no existe, crear como tipo personalizado
  const [result] = await connection.execute(
    'INSERT INTO tipos_cuenta (nombre, es_base, empresa_id) VALUES (?, FALSE, ?)',
    [nombreTipo, empresaId]
  );

  return result.insertId;
}

/**
 * Migrar registros contables
 */
async function migrateRegistros(connection) {
  logger.log('registros', 'INICIO', 'Migrando registros contables');

  try {
    const snapshot = await db.collection('registros').get();
    logger.stats.registros.total = snapshot.size;

    // Obtener mapeo de empresas
    const [empresas] = await connection.execute(
      'SELECT id, nombre, firebase_id FROM empresas'
    );
    const empresaMap = new Map();
    empresas.forEach(e => empresaMap.set(e.nombre, e.id));

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const empresaId = empresaMap.get(data.empresa);

        if (!empresaId) {
          logger.log('registros', 'SKIP', `Empresa no encontrada: ${data.empresa}`);
          continue;
        }

        // Parsear fecha
        let fechaRegistro = new Date();
        if (data.date) {
          fechaRegistro = new Date(data.date);
        }

        // Insertar registro principal
        const [registroResult] = await connection.execute(
          `INSERT INTO registros (firebase_id, empresa_id, mes, año, control, total, fecha_registro)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            doc.id,
            empresaId,
            data.mes || '',
            data.año || new Date().getFullYear(),
            parseFloat(data.control) || 0,
            parseFloat(data.total) || 0,
            fechaRegistro
          ]
        );

        const registroId = registroResult.insertId;
        logger.incrementStat('registros', 'migrados');

        // Migrar detalles del registro
        if (data.datos && Array.isArray(data.datos)) {
          for (let i = 0; i < data.datos.length; i++) {
            try {
              const dato = data.datos[i];
              logger.stats.registros_detalle.total++;

              const tipoCuentaId = await getTipoCuentaId(connection, dato.tipo, empresaId);

              await connection.execute(
                `INSERT INTO registros_detalle
                 (registro_id, detalle, tipo_cuenta_id, tipo_transaccion, monto, orden)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                  registroId,
                  dato.detalle || '',
                  tipoCuentaId,
                  dato.tipoTransaccion || 'debe',
                  parseFloat(dato.monto) || 0,
                  i
                ]
              );

              logger.incrementStat('registros_detalle', 'migrados');
            } catch (error) {
              logger.incrementStat('registros_detalle', 'errores');
              logger.log('registros_detalle', 'ERROR', error.message);
            }
          }
        }

        logger.log('registros', 'SUCCESS', `${data.empresa} - ${data.mes}/${data.año}`);
      } catch (error) {
        logger.incrementStat('registros', 'errores');
        logger.log('registros', 'ERROR', `${doc.id}: ${error.message}`);
      }
    }

    logger.log('registros', 'COMPLETO', `${logger.stats.registros.migrados}/${logger.stats.registros.total} migrados`);
    return true;
  } catch (error) {
    logger.log('registros', 'ERROR FATAL', error.message);
    return false;
  }
}

/**
 * Migrar movimientos de débito
 */
async function migrateMovimientosDebe(connection) {
  logger.log('movimientos_debe', 'INICIO', 'Migrando movimientos de débito');

  try {
    const snapshot = await db.collection('debe').get();
    logger.stats.movimientos_debe.total = snapshot.size;

    const [empresas] = await connection.execute('SELECT id, nombre FROM empresas');
    const empresaMap = new Map();
    empresas.forEach(e => empresaMap.set(e.nombre, e.id));

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const empresaId = empresaMap.get(data.empresa);

        if (!empresaId) {
          logger.log('movimientos_debe', 'SKIP', `Empresa no encontrada: ${data.empresa}`);
          continue;
        }

        const tipoCuentaId = await getTipoCuentaId(connection, data.tipo, empresaId);
        const fechaMovimiento = data.date ? new Date(data.date) : new Date();

        await connection.execute(
          `INSERT INTO movimientos_debe
           (firebase_id, empresa_id, mes, año, detalle, control, tipo_cuenta_id, monto, fecha_movimiento)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            doc.id,
            empresaId,
            data.mes || '',
            data.año || new Date().getFullYear(),
            data.detalle || '',
            parseFloat(data.control) || 0,
            tipoCuentaId,
            parseFloat(data.monto) || 0,
            fechaMovimiento
          ]
        );

        logger.incrementStat('movimientos_debe', 'migrados');
      } catch (error) {
        logger.incrementStat('movimientos_debe', 'errores');
        logger.log('movimientos_debe', 'ERROR', `${doc.id}: ${error.message}`);
      }
    }

    logger.log('movimientos_debe', 'COMPLETO', `${logger.stats.movimientos_debe.migrados}/${logger.stats.movimientos_debe.total} migrados`);
    return true;
  } catch (error) {
    logger.log('movimientos_debe', 'ERROR FATAL', error.message);
    return false;
  }
}

/**
 * Migrar movimientos de crédito
 */
async function migrateMovimientosHaber(connection) {
  logger.log('movimientos_haber', 'INICIO', 'Migrando movimientos de crédito');

  try {
    const snapshot = await db.collection('haber').get();
    logger.stats.movimientos_haber.total = snapshot.size;

    const [empresas] = await connection.execute('SELECT id, nombre FROM empresas');
    const empresaMap = new Map();
    empresas.forEach(e => empresaMap.set(e.nombre, e.id));

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const empresaId = empresaMap.get(data.empresa);

        if (!empresaId) {
          logger.log('movimientos_haber', 'SKIP', `Empresa no encontrada: ${data.empresa}`);
          continue;
        }

        const tipoCuentaId = await getTipoCuentaId(connection, data.tipo, empresaId);
        const fechaMovimiento = data.date ? new Date(data.date) : new Date();

        await connection.execute(
          `INSERT INTO movimientos_haber
           (firebase_id, empresa_id, mes, año, detalle, control, tipo_cuenta_id, monto, fecha_movimiento)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            doc.id,
            empresaId,
            data.mes || '',
            data.año || new Date().getFullYear(),
            data.detalle || '',
            parseFloat(data.control) || 0,
            tipoCuentaId,
            parseFloat(data.monto) || 0,
            fechaMovimiento
          ]
        );

        logger.incrementStat('movimientos_haber', 'migrados');
      } catch (error) {
        logger.incrementStat('movimientos_haber', 'errores');
        logger.log('movimientos_haber', 'ERROR', `${doc.id}: ${error.message}`);
      }
    }

    logger.log('movimientos_haber', 'COMPLETO', `${logger.stats.movimientos_haber.migrados}/${logger.stats.movimientos_haber.total} migrados`);
    return true;
  } catch (error) {
    logger.log('movimientos_haber', 'ERROR FATAL', error.message);
    return false;
  }
}

/**
 * Migrar totales anuales
 */
async function migrateTotalesAnuales(connection) {
  logger.log('totales_anuales', 'INICIO', 'Migrando totales anuales');

  try {
    const snapshot = await db.collection('totales').get();
    logger.stats.totales_anuales.total = snapshot.size;

    const [empresas] = await connection.execute('SELECT id, nombre FROM empresas');
    const empresaMap = new Map();
    empresas.forEach(e => empresaMap.set(e.nombre, e.id));

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const empresaId = empresaMap.get(data.empresa);

        if (!empresaId) {
          logger.log('totales_anuales', 'SKIP', `Empresa no encontrada: ${data.empresa}`);
          continue;
        }

        const año = data.año || new Date().getFullYear();

        // Procesar cada tipo de cuenta en el documento
        const camposExcluir = ['empresa', 'año', 'fechaActualizacion'];

        for (const [tipoNombre, valores] of Object.entries(data)) {
          if (camposExcluir.includes(tipoNombre)) continue;

          if (valores && typeof valores === 'object' && ('debito' in valores || 'credito' in valores)) {
            try {
              const tipoCuentaId = await getTipoCuentaId(connection, tipoNombre, empresaId);

              await connection.execute(
                `INSERT INTO totales_anuales (empresa_id, año, tipo_cuenta_id, total_debito, total_credito)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   total_debito = VALUES(total_debito),
                   total_credito = VALUES(total_credito)`,
                [
                  empresaId,
                  año,
                  tipoCuentaId,
                  parseFloat(valores.debito) || 0,
                  parseFloat(valores.credito) || 0
                ]
              );

              logger.incrementStat('totales_anuales', 'migrados');
            } catch (error) {
              logger.incrementStat('totales_anuales', 'errores');
              logger.log('totales_anuales', 'ERROR', `${tipoNombre}: ${error.message}`);
            }
          }
        }

        logger.log('totales_anuales', 'SUCCESS', `${data.empresa} - ${año}`);
      } catch (error) {
        logger.log('totales_anuales', 'ERROR', `${doc.id}: ${error.message}`);
      }
    }

    logger.log('totales_anuales', 'COMPLETO', `${logger.stats.totales_anuales.migrados} registros migrados`);
    return true;
  } catch (error) {
    logger.log('totales_anuales', 'ERROR FATAL', error.message);
    return false;
  }
}

/**
 * Migrar configuraciones de balance
 */
async function migrateConfiguracionBalance(connection) {
  logger.log('configuracion_balance', 'INICIO', 'Migrando configuraciones de balance');

  try {
    const snapshot = await db.collection('balances').get();
    logger.stats.configuracion_balance.total = snapshot.size;

    const [empresas] = await connection.execute('SELECT id, nombre FROM empresas');
    const empresaMap = new Map();
    empresas.forEach(e => empresaMap.set(e.nombre, e.id));

    const [categorias] = await connection.execute('SELECT id, nombre FROM categorias_balance');
    const categoriaMap = new Map();
    categorias.forEach(c => categoriaMap.set(c.nombre, c.id));

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const empresaId = empresaMap.get(data.empresa);

        if (!empresaId) {
          logger.log('configuracion_balance', 'SKIP', `Empresa no encontrada: ${data.empresa}`);
          continue;
        }

        const año = data.año || new Date().getFullYear();

        if (data.categorias && Array.isArray(data.categorias)) {
          for (const cat of data.categorias) {
            if (!cat.categoria || !cat.tipo) continue;

            try {
              const tipoCuentaId = await getTipoCuentaId(connection, cat.tipo, empresaId);
              const categoriaBalanceId = categoriaMap.get(cat.categoria);

              if (!categoriaBalanceId) {
                logger.log('configuracion_balance', 'SKIP', `Categoría no encontrada: ${cat.categoria}`);
                continue;
              }

              await connection.execute(
                `INSERT INTO configuracion_balance (empresa_id, año, tipo_cuenta_id, categoria_balance_id)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   categoria_balance_id = VALUES(categoria_balance_id)`,
                [empresaId, año, tipoCuentaId, categoriaBalanceId]
              );

              logger.incrementStat('configuracion_balance', 'migrados');
            } catch (error) {
              logger.incrementStat('configuracion_balance', 'errores');
              logger.log('configuracion_balance', 'ERROR', error.message);
            }
          }
        }

        logger.log('configuracion_balance', 'SUCCESS', `${data.empresa} - ${año}`);
      } catch (error) {
        logger.log('configuracion_balance', 'ERROR', `${doc.id}: ${error.message}`);
      }
    }

    logger.log('configuracion_balance', 'COMPLETO', `${logger.stats.configuracion_balance.migrados} configuraciones migradas`);
    return true;
  } catch (error) {
    logger.log('configuracion_balance', 'ERROR FATAL', error.message);
    return false;
  }
}

/**
 * Migrar transacciones legacy (opcional)
 */
async function migrateTransactionsLegacy(connection) {
  logger.log('transactions_legacy', 'INICIO', 'Migrando transacciones legacy');

  try {
    const snapshot = await db.collection('transactions').get();
    logger.stats.transactions_legacy.total = snapshot.size;

    if (snapshot.size === 0) {
      logger.log('transactions_legacy', 'SKIP', 'No hay transacciones legacy');
      return true;
    }

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const fecha = data.date ? new Date(data.date) : new Date();

        const [result] = await connection.execute(
          `INSERT INTO transactions_legacy (firebase_id, fecha, total)
           VALUES (?, ?, ?)`,
          [
            doc.id,
            fecha,
            parseFloat(data.total) || 0
          ]
        );

        const transactionId = result.insertId;

        // Migrar productos
        if (data.products && Array.isArray(data.products)) {
          for (const product of data.products) {
            await connection.execute(
              `INSERT INTO transactions_products_legacy (transaction_id, nombre, precio)
               VALUES (?, ?, ?)`,
              [
                transactionId,
                product.name || '',
                parseFloat(product.price) || 0
              ]
            );
          }
        }

        logger.incrementStat('transactions_legacy', 'migrados');
      } catch (error) {
        logger.incrementStat('transactions_legacy', 'errores');
        logger.log('transactions_legacy', 'ERROR', `${doc.id}: ${error.message}`);
      }
    }

    logger.log('transactions_legacy', 'COMPLETO', `${logger.stats.transactions_legacy.migrados}/${logger.stats.transactions_legacy.total} migrados`);
    return true;
  } catch (error) {
    logger.log('transactions_legacy', 'ERROR FATAL', error.message);
    return false;
  }
}

// =====================================================
// FUNCIÓN PRINCIPAL
// =====================================================
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('MIGRACIÓN DE FIREBASE A MYSQL - LIBRO MAYOR');
  console.log('='.repeat(60) + '\n');

  let connection;

  try {
    // Conectar a MySQL
    console.log('Conectando a MySQL...');
    connection = await mysql.createConnection(mysqlConfig);
    console.log('✓ Conectado a MySQL\n');

    // Ejecutar migraciones en orden
    const migrations = [
      { name: 'Empresas', fn: migrateEmpresas },
      { name: 'Tipos de Cuenta', fn: migrateTiposCuenta },
      { name: 'Registros', fn: migrateRegistros },
      { name: 'Movimientos Debe', fn: migrateMovimientosDebe },
      { name: 'Movimientos Haber', fn: migrateMovimientosHaber },
      { name: 'Totales Anuales', fn: migrateTotalesAnuales },
      { name: 'Configuración Balance', fn: migrateConfiguracionBalance },
      { name: 'Transacciones Legacy', fn: migrateTransactionsLegacy }
    ];

    for (const migration of migrations) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`Ejecutando: ${migration.name}`);
      console.log('─'.repeat(60));

      const success = await migration.fn(connection);

      if (!success) {
        console.log(`⚠ Advertencia: ${migration.name} completado con errores`);
      }
    }

    // Mostrar resumen
    logger.printSummary();

    console.log('\n✓ MIGRACIÓN COMPLETADA EXITOSAMENTE\n');

  } catch (error) {
    console.error('\n✗ ERROR FATAL EN LA MIGRACIÓN:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✓ Conexión a MySQL cerrada');
    }
  }
}

// Ejecutar migración
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
