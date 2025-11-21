-- =====================================================
-- SCRIPT DE VERIFICACIÓN DE MIGRACIÓN
-- Libro Mayor - Firebase a MySQL
-- =====================================================
-- Este script verifica la integridad de los datos migrados
-- =====================================================

USE libromayor;

-- Configurar formato de salida
SET @line = REPEAT('=', 70);
SET @separator = REPEAT('-', 70);

-- =====================================================
-- 1. RESUMEN GENERAL DE REGISTROS
-- =====================================================
SELECT @line AS '';
SELECT 'RESUMEN GENERAL DE REGISTROS MIGRADOS' AS '';
SELECT @line AS '';
SELECT '' AS '';

SELECT
  'empresas' AS Tabla,
  COUNT(*) AS Total_Registros,
  MIN(fecha_creacion) AS Primera_Creacion,
  MAX(fecha_actualizacion) AS Ultima_Actualizacion
FROM empresas
UNION ALL
SELECT 'tipos_cuenta', COUNT(*), MIN(fecha_creacion), MAX(fecha_creacion) FROM tipos_cuenta
UNION ALL
SELECT 'registros', COUNT(*), MIN(fecha_creacion), MAX(fecha_actualizacion) FROM registros
UNION ALL
SELECT 'registros_detalle', COUNT(*), NULL, NULL FROM registros_detalle
UNION ALL
SELECT 'movimientos_debe', COUNT(*), NULL, NULL FROM movimientos_debe
UNION ALL
SELECT 'movimientos_haber', COUNT(*), NULL, NULL FROM movimientos_haber
UNION ALL
SELECT 'totales_anuales', COUNT(*), NULL, MAX(fecha_actualizacion) FROM totales_anuales
UNION ALL
SELECT 'configuracion_balance', COUNT(*), NULL, MAX(ultima_actualizacion) FROM configuracion_balance
UNION ALL
SELECT 'transactions_legacy', COUNT(*), MIN(fecha_creacion), MAX(fecha_creacion) FROM transactions_legacy;

SELECT '' AS '';

-- =====================================================
-- 2. EMPRESAS MIGRADAS
-- =====================================================
SELECT @separator AS '';
SELECT 'DETALLE DE EMPRESAS MIGRADAS' AS '';
SELECT @separator AS '';
SELECT '' AS '';

SELECT
  id,
  nombre,
  rut,
  COALESCE(direccion, '(no especificada)') AS direccion,
  COALESCE(giro, '(no especificado)') AS giro,
  COALESCE(comuna, '(no especificada)') AS comuna,
  fecha_creacion
FROM empresas
ORDER BY nombre;

SELECT '' AS '';
SELECT CONCAT('Total empresas: ', COUNT(*)) AS Resumen FROM empresas;
SELECT '' AS '';

-- =====================================================
-- 3. TIPOS DE CUENTA
-- =====================================================
SELECT @separator AS '';
SELECT 'TIPOS DE CUENTA (BASE Y PERSONALIZADOS)' AS '';
SELECT @separator AS '';
SELECT '' AS '';

-- Tipos base
SELECT 'TIPOS BASE DEL SISTEMA:' AS '';
SELECT '' AS '';
SELECT
  id,
  nombre,
  'BASE' AS tipo
FROM tipos_cuenta
WHERE es_base = TRUE
ORDER BY nombre;

SELECT '' AS '';

-- Tipos personalizados por empresa
SELECT 'TIPOS PERSONALIZADOS POR EMPRESA:' AS '';
SELECT '' AS '';
SELECT
  tc.id,
  tc.nombre AS tipo_cuenta,
  e.nombre AS empresa,
  tc.fecha_creacion
FROM tipos_cuenta tc
JOIN empresas e ON tc.empresa_id = e.id
WHERE tc.es_base = FALSE
ORDER BY e.nombre, tc.nombre;

SELECT '' AS '';
SELECT
  CONCAT('Tipos base: ', SUM(CASE WHEN es_base THEN 1 ELSE 0 END)) AS Resumen,
  CONCAT('Tipos personalizados: ', SUM(CASE WHEN NOT es_base THEN 1 ELSE 0 END)) AS ''
FROM tipos_cuenta;
SELECT '' AS '';

-- =====================================================
-- 4. REGISTROS POR EMPRESA Y AÑO
-- =====================================================
SELECT @separator AS '';
SELECT 'REGISTROS POR EMPRESA Y AÑO' AS '';
SELECT @separator AS '';
SELECT '' AS '';

SELECT
  e.nombre AS Empresa,
  r.año AS Año,
  COUNT(DISTINCT r.id) AS Total_Registros,
  COUNT(rd.id) AS Total_Lineas_Detalle,
  SUM(r.control) AS Suma_Control,
  SUM(r.total) AS Suma_Total
FROM empresas e
LEFT JOIN registros r ON e.id = r.empresa_id
LEFT JOIN registros_detalle rd ON r.id = rd.registro_id
GROUP BY e.nombre, r.año
ORDER BY e.nombre, r.año;

SELECT '' AS '';

-- =====================================================
-- 5. DISTRIBUCIÓN DE REGISTROS POR MES
-- =====================================================
SELECT @separator AS '';
SELECT 'DISTRIBUCIÓN DE REGISTROS POR MES' AS '';
SELECT @separator AS '';
SELECT '' AS '';

SELECT
  r.año AS Año,
  r.mes AS Mes,
  COUNT(*) AS Cantidad_Registros,
  SUM(r.control) AS Total_Control
FROM registros r
GROUP BY r.año, r.mes
ORDER BY r.año, FIELD(r.mes,
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre');

SELECT '' AS '';

-- =====================================================
-- 6. VALIDACIÓN DE BALANCES
-- =====================================================
SELECT @separator AS '';
SELECT 'VALIDACIÓN DE BALANCES (DEBE = HABER)' AS '';
SELECT @separator AS '';
SELECT '' AS '';

SELECT
  r.id AS ID_Registro,
  e.nombre AS Empresa,
  r.mes AS Mes,
  r.año AS Año,
  SUM(CASE WHEN rd.tipo_transaccion = 'debe' THEN rd.monto ELSE 0 END) AS Total_Debe,
  SUM(CASE WHEN rd.tipo_transaccion = 'haber' THEN rd.monto ELSE 0 END) AS Total_Haber,
  r.control AS Control,
  ABS(
    SUM(CASE WHEN rd.tipo_transaccion = 'debe' THEN rd.monto ELSE 0 END) -
    SUM(CASE WHEN rd.tipo_transaccion = 'haber' THEN rd.monto ELSE 0 END)
  ) AS Diferencia,
  CASE
    WHEN ABS(
      SUM(CASE WHEN rd.tipo_transaccion = 'debe' THEN rd.monto ELSE 0 END) -
      SUM(CASE WHEN rd.tipo_transaccion = 'haber' THEN rd.monto ELSE 0 END)
    ) < 0.01 THEN '✓ OK'
    ELSE '✗ DESBALANCEADO'
  END AS Estado
FROM registros r
JOIN empresas e ON r.empresa_id = e.id
JOIN registros_detalle rd ON r.id = rd.registro_id
GROUP BY r.id, e.nombre, r.mes, r.año, r.control
HAVING ABS(
  SUM(CASE WHEN rd.tipo_transaccion = 'debe' THEN rd.monto ELSE 0 END) -
  SUM(CASE WHEN rd.tipo_transaccion = 'haber' THEN rd.monto ELSE 0 END)
) > 0.01;

-- Si no hay resultados, todos los balances están OK
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✓ TODOS LOS BALANCES ESTÁN CORRECTOS'
    ELSE CONCAT('✗ HAY ', COUNT(*), ' REGISTROS DESBALANCEADOS')
  END AS Resultado_Validacion
FROM (
  SELECT r.id
  FROM registros r
  JOIN registros_detalle rd ON r.id = rd.registro_id
  GROUP BY r.id
  HAVING ABS(
    SUM(CASE WHEN rd.tipo_transaccion = 'debe' THEN rd.monto ELSE 0 END) -
    SUM(CASE WHEN rd.tipo_transaccion = 'haber' THEN rd.monto ELSE 0 END)
  ) > 0.01
) AS desbalanceados;

SELECT '' AS '';

-- =====================================================
-- 7. MOVIMIENTOS DEBE Y HABER
-- =====================================================
SELECT @separator AS '';
SELECT 'RESUMEN DE MOVIMIENTOS DEBE Y HABER' AS '';
SELECT @separator AS '';
SELECT '' AS '';

SELECT
  e.nombre AS Empresa,
  COUNT(md.id) AS Movimientos_Debe,
  SUM(md.monto) AS Total_Debe,
  COUNT(mh.id) AS Movimientos_Haber,
  SUM(mh.monto) AS Total_Haber
FROM empresas e
LEFT JOIN movimientos_debe md ON e.id = md.empresa_id
LEFT JOIN movimientos_haber mh ON e.id = mh.empresa_id
GROUP BY e.nombre
ORDER BY e.nombre;

SELECT '' AS '';

-- =====================================================
-- 8. TOTALES ANUALES
-- =====================================================
SELECT @separator AS '';
SELECT 'TOTALES ANUALES POR EMPRESA Y AÑO' AS '';
SELECT @separator AS '';
SELECT '' AS '';

SELECT
  e.nombre AS Empresa,
  ta.año AS Año,
  COUNT(DISTINCT ta.tipo_cuenta_id) AS Tipos_Cuenta,
  SUM(ta.total_debito) AS Total_Debito,
  SUM(ta.total_credito) AS Total_Credito,
  SUM(ta.total_debito - ta.total_credito) AS Saldo_Neto
FROM totales_anuales ta
JOIN empresas e ON ta.empresa_id = e.id
GROUP BY e.nombre, ta.año
ORDER BY e.nombre, ta.año;

SELECT '' AS '';

-- =====================================================
-- 9. CONFIGURACIÓN DE BALANCE
-- =====================================================
SELECT @separator AS '';
SELECT 'CONFIGURACIONES DE BALANCE GUARDADAS' AS '';
SELECT @separator AS '';
SELECT '' AS '';

SELECT
  e.nombre AS Empresa,
  cb.año AS Año,
  COUNT(*) AS Tipos_Configurados,
  SUM(CASE WHEN cat.nombre = 'activo' THEN 1 ELSE 0 END) AS Activos,
  SUM(CASE WHEN cat.nombre = 'pasivo' THEN 1 ELSE 0 END) AS Pasivos,
  SUM(CASE WHEN cat.nombre = 'perdidas' THEN 1 ELSE 0 END) AS Perdidas,
  SUM(CASE WHEN cat.nombre = 'ganancias' THEN 1 ELSE 0 END) AS Ganancias,
  MAX(cb.ultima_actualizacion) AS Ultima_Actualizacion
FROM configuracion_balance cb
JOIN empresas e ON cb.empresa_id = e.id
JOIN categorias_balance cat ON cb.categoria_balance_id = cat.id
GROUP BY e.nombre, cb.año
ORDER BY e.nombre, cb.año;

SELECT '' AS '';

-- =====================================================
-- 10. INTEGRIDAD REFERENCIAL
-- =====================================================
SELECT @separator AS '';
SELECT 'VERIFICACIÓN DE INTEGRIDAD REFERENCIAL' AS '';
SELECT @separator AS '';
SELECT '' AS '';

-- Registros huérfanos (sin empresa)
SELECT
  'Registros sin empresa' AS Verificacion,
  COUNT(*) AS Registros_Afectados,
  CASE WHEN COUNT(*) = 0 THEN '✓ OK' ELSE '✗ PROBLEMA' END AS Estado
FROM registros r
LEFT JOIN empresas e ON r.empresa_id = e.id
WHERE e.id IS NULL

UNION ALL

-- Registros_detalle huérfanos (sin registro padre)
SELECT
  'Detalles sin registro padre',
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ OK' ELSE '✗ PROBLEMA' END
FROM registros_detalle rd
LEFT JOIN registros r ON rd.registro_id = r.id
WHERE r.id IS NULL

UNION ALL

-- Registros_detalle sin tipo de cuenta
SELECT
  'Detalles sin tipo de cuenta',
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ OK' ELSE '✗ PROBLEMA' END
FROM registros_detalle rd
LEFT JOIN tipos_cuenta tc ON rd.tipo_cuenta_id = tc.id
WHERE tc.id IS NULL

UNION ALL

-- Movimientos_debe sin empresa
SELECT
  'Movimientos debe sin empresa',
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ OK' ELSE '✗ PROBLEMA' END
FROM movimientos_debe md
LEFT JOIN empresas e ON md.empresa_id = e.id
WHERE e.id IS NULL

UNION ALL

-- Movimientos_haber sin empresa
SELECT
  'Movimientos haber sin empresa',
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✓ OK' ELSE '✗ PROBLEMA' END
FROM movimientos_haber mh
LEFT JOIN empresas e ON mh.empresa_id = e.id
WHERE e.id IS NULL;

SELECT '' AS '';

-- =====================================================
-- 11. AUDITORÍA
-- =====================================================
SELECT @separator AS '';
SELECT 'REGISTROS DE AUDITORÍA' AS '';
SELECT @separator AS '';
SELECT '' AS '';

SELECT
  tabla AS Tabla,
  operacion AS Operacion,
  COUNT(*) AS Cantidad,
  MIN(fecha) AS Primer_Registro,
  MAX(fecha) AS Ultimo_Registro
FROM auditoria
GROUP BY tabla, operacion
ORDER BY tabla, operacion;

SELECT '' AS '';
SELECT CONCAT('Total eventos auditados: ', COUNT(*)) AS Resumen FROM auditoria;
SELECT '' AS '';

-- =====================================================
-- 12. ÍNDICES Y PERFORMANCE
-- =====================================================
SELECT @separator AS '';
SELECT 'ÍNDICES CREADOS' AS '';
SELECT @separator AS '';
SELECT '' AS '';

SELECT
  TABLE_NAME AS Tabla,
  INDEX_NAME AS Indice,
  COLUMN_NAME AS Columna,
  NON_UNIQUE AS No_Unico,
  SEQ_IN_INDEX AS Orden
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'libromayor'
  AND TABLE_NAME NOT LIKE '%_legacy'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

SELECT '' AS '';

-- =====================================================
-- 13. TAMAÑO DE TABLAS
-- =====================================================
SELECT @separator AS '';
SELECT 'TAMAÑO DE TABLAS' AS '';
SELECT @separator AS '';
SELECT '' AS '';

SELECT
  TABLE_NAME AS Tabla,
  ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS Tamaño_MB,
  TABLE_ROWS AS Filas_Aprox,
  ROUND((DATA_LENGTH + INDEX_LENGTH) / TABLE_ROWS, 2) AS Bytes_Por_Fila
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'libromayor'
  AND TABLE_ROWS > 0
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;

SELECT '' AS '';

-- =====================================================
-- 14. RESUMEN FINAL
-- =====================================================
SELECT @line AS '';
SELECT 'RESUMEN FINAL DE VERIFICACIÓN' AS '';
SELECT @line AS '';
SELECT '' AS '';

SELECT
  'Base de datos' AS Item,
  DATABASE() AS Valor
UNION ALL
SELECT 'Versión MySQL', VERSION()
UNION ALL
SELECT 'Zona horaria', @@time_zone
UNION ALL
SELECT 'Fecha verificación', NOW()
UNION ALL
SELECT 'Total empresas', CAST(COUNT(*) AS CHAR) FROM empresas
UNION ALL
SELECT 'Total registros', CAST(COUNT(*) AS CHAR) FROM registros
UNION ALL
SELECT 'Total movimientos', CAST((SELECT COUNT(*) FROM movimientos_debe) + (SELECT COUNT(*) FROM movimientos_haber) AS CHAR)
UNION ALL
SELECT 'Tamaño total BD (MB)', CAST(ROUND(SUM(DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS CHAR)
  FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'libromayor';

SELECT '' AS '';
SELECT @line AS '';
SELECT '✓ VERIFICACIÓN COMPLETADA' AS '';
SELECT @line AS '';

-- =====================================================
-- FIN DE VERIFICACIÓN
-- =====================================================
