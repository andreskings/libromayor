# Guía de Migración: Firebase a MySQL

## 📋 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Requisitos Previos](#requisitos-previos)
3. [Estructura de Datos](#estructura-de-datos)
4. [Pasos de Migración](#pasos-de-migración)
5. [Verificación](#verificación)
6. [Rollback](#rollback)
7. [Soporte](#soporte)

---

## Resumen Ejecutivo

Esta guía documenta el proceso completo de migración del sistema **Libro Mayor** desde Firebase Firestore a MySQL.

### ¿Por qué migrar?

- **Integridad Relacional**: MySQL ofrece foreign keys y constraints
- **Transacciones ACID**: Mayor seguridad en operaciones críticas
- **Consultas SQL Complejas**: Mejor performance en reportes
- **Auditoría**: Sistema completo de trazabilidad
- **Costos**: Reducción de costos operativos

### Datos a migrar

| Colección Firebase | Tabla MySQL | Registros Estimados |
|-------------------|-------------|---------------------|
| empresas | empresas | Variable |
| registros | registros + registros_detalle | Variable |
| debe | movimientos_debe | Variable |
| haber | movimientos_haber | Variable |
| totales | totales_anuales | Variable |
| balances | configuracion_balance | Variable |
| transactions | transactions_legacy | Variable (legacy) |

---

## Requisitos Previos

### Software Necesario

1. **MySQL Server 8.0+**
   ```bash
   # Verificar instalación
   mysql --version
   ```

2. **Node.js 14+**
   ```bash
   # Verificar instalación
   node --version
   npm --version
   ```

3. **Git** (opcional, para control de versiones)

### Credenciales Firebase

Necesitas descargar el archivo de credenciales de Firebase:

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto: **cuadernopublico**
3. Ve a **Project Settings** > **Service Accounts**
4. Click en **Generate New Private Key**
5. Guarda el archivo como `serviceAccountKey.json` en la raíz del proyecto

### Acceso a MySQL

Asegúrate de tener:
- Usuario con permisos de CREATE, INSERT, UPDATE, DELETE
- Acceso al host (localhost o remoto)
- Puerto disponible (default: 3306)

---

## Estructura de Datos

### Mapeo Firebase → MySQL

#### 1. Empresas
```
Firebase: empresas/{id}
MySQL: empresas (tabla)

Campos:
- nombre: VARCHAR(255)
- rut: VARCHAR(20)
- direccion: VARCHAR(500)
- giro: VARCHAR(255)
- comuna: VARCHAR(100)
- tipos_personalizados: → tipos_cuenta (tabla separada)
```

#### 2. Registros
```
Firebase: registros/{id}
MySQL: registros + registros_detalle (tablas relacionadas)

Campos principales:
- empresa: → empresa_id (FK)
- mes: VARCHAR(20)
- año: YEAR
- datos: Array[] → registros_detalle (1:N)
- control: DECIMAL(15,2)
- total: DECIMAL(15,2)
```

#### 3. Movimientos
```
Firebase: debe/{id}, haber/{id}
MySQL: movimientos_debe, movimientos_haber (tablas separadas)

Campos:
- empresa: → empresa_id (FK)
- tipo: → tipo_cuenta_id (FK)
- monto: DECIMAL(15,2)
- mes, año, detalle, control, fecha
```

#### 4. Totales Anuales
```
Firebase: totales/{empresa}_{año}
  {
    "Caja": { debito: X, credito: Y },
    "Ingreso": { debito: X, credito: Y },
    ...
  }

MySQL: totales_anuales (tabla normalizada)
- empresa_id (FK)
- año
- tipo_cuenta_id (FK)
- total_debito
- total_credito
```

#### 5. Configuración de Balance
```
Firebase: balances/{empresa}_{año}
  {
    categorias: [
      { tipo: "Caja", categoria: "activo" },
      ...
    ]
  }

MySQL: configuracion_balance
- empresa_id (FK)
- año
- tipo_cuenta_id (FK)
- categoria_balance_id (FK)
```

---

## Pasos de Migración

### Paso 1: Preparar el Entorno

```bash
# 1. Navegar al directorio del proyecto
cd c:\Users\pc\Desktop\libromayor

# 2. Instalar dependencias de Node.js
npm install firebase mysql2 dotenv

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de MySQL
```

### Paso 2: Crear el Schema MySQL

```bash
# 1. Conectar a MySQL
mysql -u root -p

# 2. Ejecutar el script de schema
mysql -u root -p < migration_mysql_schema.sql

# 3. Verificar que las tablas se crearon
mysql -u root -p libromayor -e "SHOW TABLES;"
```

Deberías ver estas tablas:
```
+------------------------------+
| Tables_in_libromayor        |
+------------------------------+
| auditoria                   |
| categorias_balance          |
| configuracion_balance       |
| empresas                    |
| movimientos_debe            |
| movimientos_haber           |
| registros                   |
| registros_detalle           |
| tipos_cuenta                |
| totales_anuales             |
| transactions_legacy         |
| transactions_products_legacy|
+------------------------------+
```

### Paso 3: Configurar Firebase

```bash
# 1. Colocar serviceAccountKey.json en la raíz del proyecto
# (descargado desde Firebase Console)

# 2. Verificar que el archivo existe
ls -la serviceAccountKey.json
```

### Paso 4: Ejecutar la Migración

```bash
# Ejecutar el script de migración
node firebase_to_mysql_migration.js
```

El script mostrará el progreso en tiempo real:

```
============================================================
MIGRACIÓN DE FIREBASE A MYSQL - LIBRO MAYOR
============================================================

Conectando a MySQL...
✓ Conectado a MySQL

────────────────────────────────────────────────────────────
Ejecutando: Empresas
────────────────────────────────────────────────────────────
[2025-01-13T...] empresas - INICIO: Iniciando migración de empresas
[2025-01-13T...] empresas - SUCCESS: Migrado: Mi Empresa (12.345.678-9)
[2025-01-13T...] empresas - COMPLETO: 5/5 migrados

────────────────────────────────────────────────────────────
Ejecutando: Registros
────────────────────────────────────────────────────────────
...
```

### Paso 5: Verificar la Migración

```bash
# Ejecutar script de verificación
mysql -u root -p libromayor < verificacion_migracion.sql
```

---

## Verificación

### Verificaciones Automáticas

```sql
-- 1. Verificar cantidad de registros migrados
SELECT
  'empresas' AS tabla,
  COUNT(*) AS total
FROM empresas
UNION ALL
SELECT 'registros', COUNT(*) FROM registros
UNION ALL
SELECT 'movimientos_debe', COUNT(*) FROM movimientos_debe
UNION ALL
SELECT 'movimientos_haber', COUNT(*) FROM movimientos_haber
UNION ALL
SELECT 'totales_anuales', COUNT(*) FROM totales_anuales;

-- 2. Verificar integridad referencial
SELECT
  TABLE_NAME,
  CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'libromayor'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- 3. Verificar balances cuadrados
SELECT
  r.id,
  e.nombre AS empresa,
  r.mes,
  r.año,
  SUM(CASE WHEN rd.tipo_transaccion = 'debe' THEN rd.monto ELSE 0 END) AS total_debe,
  SUM(CASE WHEN rd.tipo_transaccion = 'haber' THEN rd.monto ELSE 0 END) AS total_haber,
  r.control,
  ABS(SUM(CASE WHEN rd.tipo_transaccion = 'debe' THEN rd.monto ELSE -rd.monto END)) AS diferencia
FROM registros r
JOIN empresas e ON r.empresa_id = e.id
JOIN registros_detalle rd ON r.id = rd.registro_id
GROUP BY r.id, e.nombre, r.mes, r.año, r.control
HAVING diferencia > 0.01;
-- Si esta consulta retorna 0 filas, todos los balances están cuadrados
```

### Verificación Manual

1. **Comparar totales generales**:
   - Total empresas en Firebase vs MySQL
   - Total registros en Firebase vs MySQL
   - Total movimientos debe/haber

2. **Verificar casos específicos**:
   - Seleccionar una empresa conocida
   - Verificar sus registros en Firebase
   - Comparar con los datos en MySQL

3. **Probar consultas de negocio**:
   ```sql
   -- Ejemplo: Balance de una empresa específica en un año
   SELECT * FROM v_balance_completo
   WHERE empresa = 'Mi Empresa' AND año = 2024;
   ```

---

## Rollback

Si necesitas revertir la migración:

### Opción 1: Eliminar solo los datos

```sql
-- Deshabilitar checks de foreign keys temporalmente
SET FOREIGN_KEY_CHECKS = 0;

-- Truncar tablas (mantiene estructura)
TRUNCATE TABLE configuracion_balance;
TRUNCATE TABLE totales_anuales;
TRUNCATE TABLE movimientos_haber;
TRUNCATE TABLE movimientos_debe;
TRUNCATE TABLE registros_detalle;
TRUNCATE TABLE registros;
TRUNCATE TABLE tipos_cuenta;
TRUNCATE TABLE empresas;
TRUNCATE TABLE transactions_products_legacy;
TRUNCATE TABLE transactions_legacy;
TRUNCATE TABLE auditoria;

-- Re-habilitar checks
SET FOREIGN_KEY_CHECKS = 1;

-- Re-insertar tipos de cuenta base
INSERT INTO tipos_cuenta (nombre, es_base, empresa_id) VALUES
  ('Caja', TRUE, NULL),
  ('Ingreso', TRUE, NULL),
  ... (ver migration_mysql_schema.sql línea 529-547)
```

### Opción 2: Eliminar completamente la base de datos

```sql
DROP DATABASE libromayor;
```

Luego puedes volver a ejecutar el schema desde el Paso 2.

---

## Troubleshooting

### Problema: "Error: ECONNREFUSED"

**Causa**: MySQL no está ejecutándose

**Solución**:
```bash
# Windows
net start MySQL80

# Linux/Mac
sudo service mysql start
```

### Problema: "Access denied for user"

**Causa**: Credenciales incorrectas en .env

**Solución**:
1. Verificar usuario y contraseña en .env
2. Probar conexión manual:
   ```bash
   mysql -u root -p
   ```

### Problema: "Firebase service account error"

**Causa**: Archivo serviceAccountKey.json no encontrado o inválido

**Solución**:
1. Verificar que el archivo existe en la raíz del proyecto
2. Verificar que el JSON es válido
3. Descargar nuevamente desde Firebase Console

### Problema: "Duplicate entry for key"

**Causa**: Datos duplicados o migración ejecutada múltiples veces

**Solución**:
```sql
-- Opción 1: Limpiar datos y volver a ejecutar
-- (ver sección Rollback)

-- Opción 2: Continuar desde donde falló
-- (el script maneja duplicados con ON DUPLICATE KEY UPDATE)
```

### Problema: Performance lenta

**Causa**: Gran volumen de datos

**Solución**:
1. Ejecutar la migración en horario de baja actividad
2. Aumentar límites de MySQL:
   ```sql
   SET GLOBAL max_allowed_packet = 1073741824; -- 1GB
   SET GLOBAL innodb_buffer_pool_size = 2147483648; -- 2GB
   ```
3. Considerar migración por lotes (modificar script)

---

## Optimizaciones Post-Migración

### 1. Índices Adicionales

Si tienes consultas frecuentes específicas, considera agregar índices:

```sql
-- Ejemplo: Si consultas frecuentemente por detalle
CREATE INDEX idx_detalle ON registros_detalle(detalle(100));

-- Ejemplo: Si filtras mucho por rango de fechas
CREATE INDEX idx_fecha_rango ON registros(fecha_registro, empresa_id);
```

### 2. Mantenimiento Regular

```sql
-- Optimizar tablas
OPTIMIZE TABLE empresas, registros, movimientos_debe, movimientos_haber;

-- Analizar tablas para actualizar estadísticas
ANALYZE TABLE empresas, registros, movimientos_debe, movimientos_haber;
```

### 3. Backup Automático

Configurar backup diario:

```bash
#!/bin/bash
# backup_libromayor.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/path/to/backups"
MYSQL_USER="root"
MYSQL_PASSWORD="tu_password"

mysqldump -u $MYSQL_USER -p$MYSQL_PASSWORD libromayor > "$BACKUP_DIR/libromayor_$DATE.sql"

# Mantener solo backups de últimos 30 días
find $BACKUP_DIR -name "libromayor_*.sql" -mtime +30 -delete
```

---

## Próximos Pasos

Una vez completada la migración:

1. **Actualizar la aplicación**:
   - Modificar [firebaseConfig.js](src/components/firebaseConfig.js) para usar MySQL
   - Instalar cliente MySQL para Node.js: `npm install mysql2`
   - Actualizar queries en todos los componentes

2. **Implementar autenticación**:
   - Crear tabla `usuarios`
   - Implementar JWT o sessions
   - Agregar middleware de autenticación

3. **Agregar validaciones**:
   - Constraints CHECK en MySQL
   - Validaciones a nivel de aplicación

4. **Monitoring**:
   - Configurar logs de MySQL
   - Implementar alertas de errores
   - Dashboard de métricas

---

## Soporte

### Recursos

- **Documentación MySQL**: https://dev.mysql.com/doc/
- **Node.js MySQL2**: https://github.com/sidorares/node-mysql2
- **Firebase Admin SDK**: https://firebase.google.com/docs/admin/setup

### Contacto

Para preguntas o issues:
1. Revisar esta documentación
2. Consultar logs de migración
3. Verificar configuración de MySQL

---

## Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 2025-01-13 | Versión inicial del schema y script de migración |

---

## Licencia

Este script de migración es parte del proyecto Libro Mayor.

---

**¡IMPORTANTE!**: Antes de ejecutar en producción, prueba la migración en un ambiente de desarrollo/staging con una copia de los datos de Firebase.
