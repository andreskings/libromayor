-- =====================================================
-- MIGRACIÓN DE FIREBASE A MYSQL - LIBRO MAYOR
-- Sistema de Contabilidad - Esquema Completo
-- =====================================================
-- Versión: 2.1
-- Fecha: 2025-11-19
-- Base de datos objetivo: MySQL 8.0+
-- =====================================================

-- =====================================================
-- LIMPIEZA COMPLETA - DROP DE TODAS LAS TABLAS
-- =====================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Eliminar tablas en orden inverso de dependencias
DROP TABLE IF EXISTS auditoria;
DROP TABLE IF EXISTS balance_configuracion;
DROP TABLE IF EXISTS configuracion_balance;
DROP TABLE IF EXISTS categorias_balance;
DROP TABLE IF EXISTS totales_anuales;
DROP TABLE IF EXISTS movimientos_haber;
DROP TABLE IF EXISTS movimientos_debe;
DROP TABLE IF EXISTS registros_detalle;
DROP TABLE IF EXISTS registros;
DROP TABLE IF EXISTS tipos_cuenta;
DROP TABLE IF EXISTS empresas;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS transactions_products_legacy;
DROP TABLE IF EXISTS transactions_legacy;

-- Eliminar vistas
DROP VIEW IF EXISTS v_movimientos_consolidados;
DROP VIEW IF EXISTS v_balance_completo;
DROP VIEW IF EXISTS v_resumen_registros;

-- Eliminar procedimientos almacenados
DROP PROCEDURE IF EXISTS sp_validar_balance;
DROP PROCEDURE IF EXISTS sp_calcular_totales_anuales;

-- Eliminar funciones
DROP FUNCTION IF EXISTS fn_obtener_saldo_cuenta;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- CREAR BASE DE DATOS
-- =====================================================

CREATE DATABASE IF NOT EXISTS libromayor
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE libromayor;

-- =====================================================
-- CONFIGURACIÓN INICIAL
-- =====================================================

SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET time_zone = '-03:00'; -- Chile Continental

-- =====================================================
-- 1. TABLA: usuarios
-- Sistema multi-usuario (contadores)
-- =====================================================

CREATE TABLE usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL COMMENT 'Nombre completo del usuario',
  email VARCHAR(150) NOT NULL UNIQUE COMMENT 'Email único para login',
  password_hash VARCHAR(255) NOT NULL COMMENT 'Hash bcrypt de la contraseña',
  activo BOOLEAN DEFAULT TRUE COMMENT 'Usuario activo/inactivo',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_activo (activo)
) ENGINE=InnoDB COMMENT='Usuarios del sistema (contadores)';

-- =====================================================
-- 2. TABLA: empresas
-- Almacena información de las empresas/negocios
-- =====================================================

CREATE TABLE empresas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL COMMENT 'ID del contador propietario',
  firebase_id VARCHAR(100) NULL COMMENT 'ID original de Firebase (para migración)',
  nombre VARCHAR(255) NOT NULL COMMENT 'Nombre de la empresa',
  rut VARCHAR(20) NOT NULL COMMENT 'RUT chileno con formato (ej: 12.345.678-9)',
  direccion VARCHAR(500) NULL COMMENT 'Dirección de la empresa',
  giro VARCHAR(255) NULL COMMENT 'Giro o actividad comercial',
  comuna VARCHAR(100) NULL COMMENT 'Comuna',
  activo BOOLEAN DEFAULT TRUE COMMENT 'Empresa activa/inactiva',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  
  UNIQUE INDEX idx_usuario_rut (usuario_id, rut),
  INDEX idx_nombre (nombre),
  INDEX idx_usuario (usuario_id),
  INDEX idx_firebase_id (firebase_id)
) ENGINE=InnoDB COMMENT='Empresas registradas en el sistema';

-- =====================================================
-- 3. TABLA: tipos_cuenta
-- Catálogo de tipos de cuenta (base + personalizados)
-- =====================================================

CREATE TABLE tipos_cuenta (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL COMMENT 'Nombre del tipo de cuenta',
  es_base BOOLEAN DEFAULT FALSE COMMENT 'TRUE si es un tipo predefinido del sistema',
  empresa_id INT NULL COMMENT 'ID de empresa (NULL si es tipo base/global)',
  activo BOOLEAN DEFAULT TRUE COMMENT 'Indica si el tipo está activo',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  
  UNIQUE INDEX idx_tipo_empresa (nombre, empresa_id),
  INDEX idx_nombre (nombre),
  INDEX idx_es_base (es_base),
  INDEX idx_empresa (empresa_id)
) ENGINE=InnoDB COMMENT='Tipos de cuenta base y personalizados por empresa';

-- =====================================================
-- 4. TABLA: registros
-- Registro principal de transacciones contables
-- =====================================================

CREATE TABLE registros (
  id INT AUTO_INCREMENT PRIMARY KEY,
  firebase_id VARCHAR(100) NULL COMMENT 'ID original de Firebase',
  empresa_id INT NOT NULL COMMENT 'ID de la empresa',
  mes VARCHAR(20) NOT NULL COMMENT 'Mes del registro (ej: Enero, Febrero)',
  año INT NOT NULL COMMENT 'Año del registro',
  control DECIMAL(15,2) DEFAULT 0 COMMENT 'Total de control (auto-calculado)',
  total DECIMAL(15,2) DEFAULT 0 COMMENT 'Total neto (debe - haber)',
  fecha_registro DATETIME NOT NULL COMMENT 'Fecha y hora del registro',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  
  INDEX idx_empresa_año (empresa_id, año),
  INDEX idx_empresa_mes_año (empresa_id, mes, año),
  INDEX idx_fecha_registro (fecha_registro),
  INDEX idx_firebase_id (firebase_id)
) ENGINE=InnoDB COMMENT='Registros contables principales';

-- =====================================================
-- 5. TABLA: registros_detalle
-- Detalles de cada registro (múltiples líneas por registro)
-- =====================================================

CREATE TABLE registros_detalle (
  id INT AUTO_INCREMENT PRIMARY KEY,
  registro_id INT NOT NULL COMMENT 'ID del registro padre',
  detalle VARCHAR(500) NOT NULL COMMENT 'Descripción de la transacción',
  tipo_cuenta_id INT NOT NULL COMMENT 'ID del tipo de cuenta',
  tipo_transaccion ENUM('debe', 'haber') NOT NULL COMMENT 'Tipo: debe o haber',
  monto DECIMAL(15,2) NOT NULL COMMENT 'Monto de la transacción',
  orden TINYINT UNSIGNED DEFAULT 0 COMMENT 'Orden dentro del registro',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (registro_id) REFERENCES registros(id) ON DELETE CASCADE,
  FOREIGN KEY (tipo_cuenta_id) REFERENCES tipos_cuenta(id) ON DELETE RESTRICT,
  
  INDEX idx_registro (registro_id),
  INDEX idx_tipo_cuenta (tipo_cuenta_id),
  INDEX idx_tipo_transaccion (tipo_transaccion),
  INDEX idx_detalle (detalle(100))
) ENGINE=InnoDB COMMENT='Detalles de los registros contables';

-- =====================================================
-- 6. TABLA: movimientos_debe
-- Movimientos de débito (desnormalizado para performance)
-- =====================================================

CREATE TABLE movimientos_debe (
  id INT AUTO_INCREMENT PRIMARY KEY,
  firebase_id VARCHAR(100) NULL COMMENT 'ID original de Firebase',
  empresa_id INT NOT NULL,
  mes VARCHAR(20) NOT NULL,
  año INT NOT NULL,
  detalle VARCHAR(500) NOT NULL,
  control DECIMAL(15,2) DEFAULT 0,
  tipo_cuenta_id INT NOT NULL,
  monto DECIMAL(15,2) NOT NULL,
  fecha_movimiento DATETIME NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (tipo_cuenta_id) REFERENCES tipos_cuenta(id) ON DELETE RESTRICT,
  
  INDEX idx_empresa_año (empresa_id, año),
  INDEX idx_empresa_mes_año (empresa_id, mes, año),
  INDEX idx_tipo_cuenta (tipo_cuenta_id),
  INDEX idx_fecha (fecha_movimiento),
  INDEX idx_firebase_id (firebase_id)
) ENGINE=InnoDB COMMENT='Movimientos de débito (tabla desnormalizada)';

-- =====================================================
-- 7. TABLA: movimientos_haber
-- Movimientos de crédito (desnormalizado para performance)
-- =====================================================

CREATE TABLE movimientos_haber (
  id INT AUTO_INCREMENT PRIMARY KEY,
  firebase_id VARCHAR(100) NULL COMMENT 'ID original de Firebase',
  empresa_id INT NOT NULL,
  mes VARCHAR(20) NOT NULL,
  año INT NOT NULL,
  detalle VARCHAR(500) NOT NULL,
  control DECIMAL(15,2) DEFAULT 0,
  tipo_cuenta_id INT NOT NULL,
  monto DECIMAL(15,2) NOT NULL,
  fecha_movimiento DATETIME NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (tipo_cuenta_id) REFERENCES tipos_cuenta(id) ON DELETE RESTRICT,
  
  INDEX idx_empresa_año (empresa_id, año),
  INDEX idx_empresa_mes_año (empresa_id, mes, año),
  INDEX idx_tipo_cuenta (tipo_cuenta_id),
  INDEX idx_fecha (fecha_movimiento),
  INDEX idx_firebase_id (firebase_id)
) ENGINE=InnoDB COMMENT='Movimientos de crédito (tabla desnormalizada)';

-- =====================================================
-- 8. TABLA: totales_anuales
-- Totales agregados por empresa, año y tipo de cuenta
-- =====================================================

CREATE TABLE totales_anuales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  año INT NOT NULL,
  tipo_cuenta_id INT NOT NULL,
  total_debito DECIMAL(15,2) DEFAULT 0,
  total_credito DECIMAL(15,2) DEFAULT 0,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (tipo_cuenta_id) REFERENCES tipos_cuenta(id) ON DELETE CASCADE,
  
  UNIQUE INDEX idx_empresa_año_tipo (empresa_id, año, tipo_cuenta_id),
  INDEX idx_empresa_año (empresa_id, año),
  INDEX idx_año_empresa (año, empresa_id),
  INDEX idx_tipo (tipo_cuenta_id)
) ENGINE=InnoDB COMMENT='Totales anuales por tipo de cuenta';

-- =====================================================
-- 9. TABLA: balance_configuracion
-- Configuración de balance guardada por empresa/año
-- =====================================================

CREATE TABLE balance_configuracion (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL COMMENT 'ID de la empresa',
  año INT NOT NULL COMMENT 'Año del balance',
  tipo_cuenta_id INT NOT NULL COMMENT 'ID del tipo de cuenta',
  categoria ENUM('activo', 'pasivo', 'perdidas', 'ganancias') NOT NULL COMMENT 'Categoría asignada',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
  FOREIGN KEY (tipo_cuenta_id) REFERENCES tipos_cuenta(id) ON DELETE CASCADE,
  
  UNIQUE INDEX unique_config (empresa_id, año, tipo_cuenta_id),
  INDEX idx_balance_config_empresa_año (empresa_id, año),
  INDEX idx_categoria (categoria)
) ENGINE=InnoDB COMMENT='Configuraciones de balance guardadas';

-- =====================================================
-- 10. TABLA: auditoria
-- Log de cambios para auditoría
-- =====================================================

CREATE TABLE auditoria (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tabla VARCHAR(50) NOT NULL,
  operacion ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
  registro_id INT NULL,
  usuario_id INT NULL,
  datos_anteriores JSON NULL,
  datos_nuevos JSON NULL,
  ip_address VARCHAR(45) NULL,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_tabla (tabla),
  INDEX idx_fecha (fecha),
  INDEX idx_operacion (operacion),
  INDEX idx_usuario (usuario_id)
) ENGINE=InnoDB COMMENT='Registro de auditoría de cambios';

-- =====================================================
-- TABLAS LEGACY (OPCIONAL - para compatibilidad)
-- =====================================================

CREATE TABLE transactions_legacy (
  id INT AUTO_INCREMENT PRIMARY KEY,
  firebase_id VARCHAR(100) NULL,
  fecha DATE NOT NULL,
  total DECIMAL(15,2) DEFAULT 0,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_fecha (fecha),
  INDEX idx_firebase_id (firebase_id)
) ENGINE=InnoDB COMMENT='Tabla legacy del prototipo (opcional)';

CREATE TABLE transactions_products_legacy (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  precio DECIMAL(15,2) NOT NULL,
  
  FOREIGN KEY (transaction_id) REFERENCES transactions_legacy(id) ON DELETE CASCADE,
  INDEX idx_transaction (transaction_id)
) ENGINE=InnoDB COMMENT='Productos de transacciones legacy (opcional)';

-- =====================================================
-- DATOS INICIALES - TIPOS DE CUENTA BASE
-- =====================================================

INSERT INTO tipos_cuenta (nombre, es_base, empresa_id, activo) VALUES
  ('Caja', TRUE, NULL, TRUE),
  ('Ingreso', TRUE, NULL, TRUE),
  ('Costo', TRUE, NULL, TRUE),
  ('IVA', TRUE, NULL, TRUE),
  ('PPM', TRUE, NULL, TRUE),
  ('Ajuste CF', TRUE, NULL, TRUE),
  ('Retencion SC', TRUE, NULL, TRUE),
  ('Honorarios', TRUE, NULL, TRUE),
  ('Gastos Generales', TRUE, NULL, TRUE),
  ('CAPITAL', TRUE, NULL, TRUE),
  ('PERDIDA Y GANANCIA', TRUE, NULL, TRUE),
  ('CORRECCION MONETARIA', TRUE, NULL, TRUE),
  ('AJUSTE PPM', TRUE, NULL, TRUE),
  ('REA REM PPM', TRUE, NULL, TRUE),
  ('REM PPM', TRUE, NULL, TRUE),
  ('REV CAP PROPIO', TRUE, NULL, TRUE),
  ('PROVEDORES', TRUE, NULL, TRUE),
  ('REAJUSTE REMANENTE PPM', TRUE, NULL, TRUE),
  ('REMANENTE PPM', TRUE, NULL, TRUE),
  ('REV CAPITAL PROPIO', TRUE, NULL, TRUE);

-- =====================================================
-- TRIGGERS PARA AUDITORÍA
-- =====================================================

DELIMITER //

-- Trigger para registros - INSERT
CREATE TRIGGER trg_registros_insert AFTER INSERT ON registros
FOR EACH ROW
BEGIN
  INSERT INTO auditoria (tabla, operacion, registro_id, datos_nuevos)
  VALUES ('registros', 'INSERT', NEW.id, JSON_OBJECT(
    'empresa_id', NEW.empresa_id,
    'mes', NEW.mes,
    'año', NEW.año,
    'control', NEW.control,
    'total', NEW.total
  ));
END//

-- Trigger para registros - UPDATE
CREATE TRIGGER trg_registros_update AFTER UPDATE ON registros
FOR EACH ROW
BEGIN
  INSERT INTO auditoria (tabla, operacion, registro_id, datos_anteriores, datos_nuevos)
  VALUES ('registros', 'UPDATE', NEW.id,
    JSON_OBJECT(
      'empresa_id', OLD.empresa_id,
      'mes', OLD.mes,
      'año', OLD.año,
      'control', OLD.control,
      'total', OLD.total
    ),
    JSON_OBJECT(
      'empresa_id', NEW.empresa_id,
      'mes', NEW.mes,
      'año', NEW.año,
      'control', NEW.control,
      'total', NEW.total
    )
  );
END//

-- Trigger para registros - DELETE
CREATE TRIGGER trg_registros_delete AFTER DELETE ON registros
FOR EACH ROW
BEGIN
  INSERT INTO auditoria (tabla, operacion, registro_id, datos_anteriores)
  VALUES ('registros', 'DELETE', OLD.id, JSON_OBJECT(
    'empresa_id', OLD.empresa_id,
    'mes', OLD.mes,
    'año', OLD.año,
    'control', OLD.control,
    'total', OLD.total
  ));
END//

DELIMITER ;

-- =====================================================
-- VISTAS ÚTILES
-- =====================================================

-- Vista: Resumen de registros por empresa y mes
CREATE OR REPLACE VIEW v_resumen_registros AS
SELECT
  e.id AS empresa_id,
  e.nombre AS empresa,
  e.rut,
  r.mes,
  r.año,
  COUNT(r.id) AS total_registros,
  SUM(r.control) AS total_control,
  SUM(r.total) AS total_neto,
  MAX(r.fecha_registro) AS ultima_transaccion
FROM empresas e
LEFT JOIN registros r ON e.id = r.empresa_id
GROUP BY e.id, e.nombre, e.rut, r.mes, r.año;

-- Vista: Balance completo con categorías
CREATE OR REPLACE VIEW v_balance_completo AS
SELECT
  e.nombre AS empresa,
  ta.año,
  tc.nombre AS tipo_cuenta,
  ta.total_debito,
  ta.total_credito,
  (ta.total_debito - ta.total_credito) AS saldo,
  CASE
    WHEN ta.total_debito > ta.total_credito THEN ta.total_debito - ta.total_credito
    ELSE 0
  END AS saldo_deudor,
  CASE
    WHEN ta.total_credito > ta.total_debito THEN ta.total_credito - ta.total_debito
    ELSE 0
  END AS saldo_acreedor,
  bc.categoria AS categoria_balance
FROM totales_anuales ta
JOIN empresas e ON ta.empresa_id = e.id
JOIN tipos_cuenta tc ON ta.tipo_cuenta_id = tc.id
LEFT JOIN balance_configuracion bc ON
  bc.empresa_id = ta.empresa_id AND
  bc.año = ta.año AND
  bc.tipo_cuenta_id = ta.tipo_cuenta_id
ORDER BY e.nombre, ta.año, tc.nombre;

-- Vista: Movimientos consolidados (debe + haber)
CREATE OR REPLACE VIEW v_movimientos_consolidados AS
SELECT
  'debe' AS tipo_movimiento,
  e.nombre AS empresa,
  md.mes,
  md.año,
  md.detalle,
  tc.nombre AS tipo_cuenta,
  md.monto,
  md.fecha_movimiento
FROM movimientos_debe md
JOIN empresas e ON md.empresa_id = e.id
JOIN tipos_cuenta tc ON md.tipo_cuenta_id = tc.id

UNION ALL

SELECT
  'haber' AS tipo_movimiento,
  e.nombre AS empresa,
  mh.mes,
  mh.año,
  mh.detalle,
  tc.nombre AS tipo_cuenta,
  mh.monto,
  mh.fecha_movimiento
FROM movimientos_haber mh
JOIN empresas e ON mh.empresa_id = e.id
JOIN tipos_cuenta tc ON mh.tipo_cuenta_id = tc.id
ORDER BY fecha_movimiento DESC;

-- =====================================================
-- STORED PROCEDURES
-- =====================================================

DELIMITER //

-- Procedimiento: Calcular totales anuales
CREATE PROCEDURE sp_calcular_totales_anuales(
  IN p_empresa_id INT,
  IN p_año INT
)
BEGIN
  -- Limpiar totales existentes para recalcular
  DELETE FROM totales_anuales
  WHERE empresa_id = p_empresa_id AND año = p_año;

  -- Calcular totales desde movimientos_debe
  INSERT INTO totales_anuales (empresa_id, año, tipo_cuenta_id, total_debito, total_credito)
  SELECT
    p_empresa_id,
    p_año,
    tipo_cuenta_id,
    SUM(monto) AS total_debito,
    0 AS total_credito
  FROM movimientos_debe
  WHERE empresa_id = p_empresa_id AND año = p_año
  GROUP BY tipo_cuenta_id
  ON DUPLICATE KEY UPDATE
    total_debito = VALUES(total_debito);

  -- Actualizar totales desde movimientos_haber
  INSERT INTO totales_anuales (empresa_id, año, tipo_cuenta_id, total_debito, total_credito)
  SELECT
    p_empresa_id,
    p_año,
    tipo_cuenta_id,
    0 AS total_debito,
    SUM(monto) AS total_credito
  FROM movimientos_haber
  WHERE empresa_id = p_empresa_id AND año = p_año
  GROUP BY tipo_cuenta_id
  ON DUPLICATE KEY UPDATE
    total_credito = VALUES(total_credito);

  SELECT 'Totales anuales calculados exitosamente' AS mensaje;
END//

-- Procedimiento: Validar balance
CREATE PROCEDURE sp_validar_balance(
  IN p_registro_id INT
)
BEGIN
  DECLARE v_total_debe DECIMAL(15,2);
  DECLARE v_total_haber DECIMAL(15,2);
  DECLARE v_diferencia DECIMAL(15,2);

  -- Calcular totales
  SELECT
    COALESCE(SUM(CASE WHEN tipo_transaccion = 'debe' THEN monto ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tipo_transaccion = 'haber' THEN monto ELSE 0 END), 0)
  INTO v_total_debe, v_total_haber
  FROM registros_detalle
  WHERE registro_id = p_registro_id;

  SET v_diferencia = v_total_debe - v_total_haber;

  -- Retornar resultados
  SELECT
    v_total_debe AS total_debe,
    v_total_haber AS total_haber,
    v_diferencia AS diferencia,
    CASE
      WHEN ABS(v_diferencia) < 0.01 THEN 'BALANCEADO'
      ELSE 'DESBALANCEADO'
    END AS estado;
END//

DELIMITER ;

-- =====================================================
-- FUNCIONES ÚTILES
-- =====================================================

DELIMITER //

-- Función: Obtener saldo de cuenta
CREATE FUNCTION fn_obtener_saldo_cuenta(
  p_empresa_id INT,
  p_año INT,
  p_tipo_cuenta_id INT
) RETURNS DECIMAL(15,2)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE v_saldo DECIMAL(15,2);

  SELECT
    COALESCE(total_debito, 0) - COALESCE(total_credito, 0)
  INTO v_saldo
  FROM totales_anuales
  WHERE empresa_id = p_empresa_id
    AND año = p_año
    AND tipo_cuenta_id = p_tipo_cuenta_id;

  RETURN COALESCE(v_saldo, 0);
END//

DELIMITER ;

-- =====================================================
-- INFORMACIÓN FINAL
-- =====================================================

SELECT 
  '✓ SCHEMA CREADO EXITOSAMENTE' AS status,
  DATABASE() AS base_datos,
  NOW() AS fecha_hora,
  VERSION() AS version_mysql,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()) AS total_tablas,
  (SELECT COUNT(*) FROM tipos_cuenta WHERE es_base = TRUE) AS tipos_cuenta_base;

-- =====================================================
-- VERIFICACIÓN DE TABLAS CREADAS
-- =====================================================

SHOW TABLES;

-- =====================================================
-- FIN DEL SCHEMA
-- =====================================================
-- Verificar que todas las tablas existan
USE libromayor;
SHOW TABLES;

-- Verificar la estructura de balance_configuracion
DESCRIBE balance_configuracion;

-- Verificar tipos de cuenta base
SELECT COUNT(*) as total FROM tipos_cuenta WHERE es_base = TRUE;

-- Verificar índices
SHOW INDEX FROM balance_configuracion;