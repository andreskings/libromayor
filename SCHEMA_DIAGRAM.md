# Diagrama de Base de Datos - Libro Mayor MySQL

## 📐 Diagrama Entidad-Relación

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LIBRO MAYOR - SCHEMA MYSQL                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│      empresas        │
├──────────────────────┤
│ • id (PK)            │
│   nombre             │
│   rut (UNIQUE)       │
│   direccion          │
│   giro               │
│   comuna             │
│   fecha_creacion     │
│   fecha_actualizacion│
└──────┬───────────────┘
       │
       │ 1:N
       │
       ├──────────────────────────────────────────────────────────┐
       │                                                          │
       │                                                          │
       ▼                                                          ▼
┌──────────────────────┐                               ┌──────────────────────┐
│   tipos_cuenta       │                               │      registros       │
├──────────────────────┤                               ├──────────────────────┤
│ • id (PK)            │                               │ • id (PK)            │
│   nombre             │◄──────────────────────────────│ • empresa_id (FK)    │
│   es_base            │                          ┌────│   mes                │
│ • empresa_id (FK)    │                          │    │   año                │
│   activo             │                          │    │   control            │
│   fecha_creacion     │                          │    │   total              │
└──────┬───────────────┘                          │    │   fecha_registro     │
       │                                          │    │   fecha_creacion     │
       │                                          │    │   fecha_actualizacion│
       │                                          │    └──────┬───────────────┘
       │                                          │           │
       │                                          │           │ 1:N
       │                                          │           │
       │                                          │           ▼
       │                                          │    ┌──────────────────────┐
       │                                          │    │ registros_detalle    │
       │                                          │    ├──────────────────────┤
       │                                          │    │ • id (PK)            │
       │                                          │    │ • registro_id (FK)   │
       │                                          └────│ • tipo_cuenta_id (FK)│
       │                                               │   detalle            │
       │                                               │   tipo_transaccion   │
       │                                               │   monto              │
       │                                               │   orden              │
       │                                               └──────────────────────┘
       │
       │
       ├───────────────────────────┬───────────────────────────┐
       │                           │                           │
       │                           │                           │
       ▼                           ▼                           ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  movimientos_debe    │  │  movimientos_haber   │  │  totales_anuales     │
├──────────────────────┤  ├──────────────────────┤  ├──────────────────────┤
│ • id (PK)            │  │ • id (PK)            │  │ • id (PK)            │
│ • empresa_id (FK)    │  │ • empresa_id (FK)    │  │ • empresa_id (FK)    │
│   mes                │  │   mes                │  │   año                │
│   año                │  │   año                │  │ • tipo_cuenta_id (FK)│
│   detalle            │  │   detalle            │  │   total_debito       │
│   control            │  │   control            │  │   total_credito      │
│ • tipo_cuenta_id (FK)│  │ • tipo_cuenta_id (FK)│  │   fecha_actualizacion│
│   monto              │  │   monto              │  └──────────────────────┘
│   fecha_movimiento   │  │   fecha_movimiento   │
└──────────────────────┘  └──────────────────────┘


┌────────────────────────────────────────────────────────────────────┐
│                   CONFIGURACIÓN DE BALANCE                          │
└────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐                     ┌──────────────────────┐
│ categorias_balance   │                     │configuracion_balance │
├──────────────────────┤                     ├──────────────────────┤
│ • id (PK)            │◄────────────────────│ • id (PK)            │
│   nombre             │                     │ • empresa_id (FK)    │
│   descripcion        │                     │   año                │
└──────────────────────┘                     │ • tipo_cuenta_id (FK)│
                                             │ • categoria_balance  │
  Valores predefinidos:                      │   _id (FK)           │
  • activo                                   │   ultima_actualizacion│
  • pasivo                                   └──────────────────────┘
  • perdidas
  • ganancias


┌────────────────────────────────────────────────────────────────────┐
│                        AUDITORÍA                                    │
└────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│     auditoria        │
├──────────────────────┤
│ • id (PK)            │
│   tabla              │
│   operacion          │
│   registro_id        │
│   datos_anteriores   │  ◄─── JSON
│   datos_nuevos       │  ◄─── JSON
│   usuario            │
│   ip_address         │
│   fecha              │
└──────────────────────┘


┌────────────────────────────────────────────────────────────────────┐
│                   LEGACY (Opcional)                                 │
└────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐           ┌──────────────────────────────┐
│ transactions_legacy  │           │ transactions_products_legacy │
├──────────────────────┤           ├──────────────────────────────┤
│ • id (PK)            │───────┐   │ • id (PK)                    │
│   firebase_id        │       └───│ • transaction_id (FK)        │
│   fecha              │           │   nombre                     │
│   total              │           │   precio                     │
│   fecha_creacion     │           └──────────────────────────────┘
└──────────────────────┘


═══════════════════════════════════════════════════════════════════════
LEYENDA:
═══════════════════════════════════════════════════════════════════════

• id (PK)         = Primary Key
• campo_id (FK)   = Foreign Key
  campo           = Columna normal
───────>          = Relación 1:N (uno a muchos)
◄───────          = Referencia
```

---

## 🔗 Relaciones Principales

### 1. empresas → tipos_cuenta (1:N)
- Una empresa puede tener **múltiples** tipos de cuenta personalizados
- Los tipos base (`es_base = TRUE`) no tienen `empresa_id`

### 2. empresas → registros (1:N)
- Una empresa puede tener **múltiples** registros contables
- Cada registro pertenece a **una sola** empresa

### 3. registros → registros_detalle (1:N)
- Un registro puede tener **múltiples** líneas de detalle
- Cada detalle pertenece a **un solo** registro
- Cada detalle tiene un `orden` para mantener secuencia

### 4. tipos_cuenta → registros_detalle (1:N)
- Un tipo de cuenta puede usarse en **múltiples** detalles
- Cada detalle usa **un solo** tipo de cuenta

### 5. empresas → movimientos_debe/haber (1:N)
- Una empresa puede tener **múltiples** movimientos
- Tablas desnormalizadas para performance de consultas

### 6. empresas → totales_anuales (1:N)
- Una empresa puede tener totales para **múltiples** años
- Índice único compuesto: `(empresa_id, año, tipo_cuenta_id)`

### 7. empresas → configuracion_balance (1:N)
- Una empresa puede tener configuraciones para **múltiples** años
- Almacena la categorización (activo, pasivo, etc.) de cada tipo de cuenta

---

## 📊 Tipos de Datos Principales

| Tipo SQL | Uso | Ejemplo |
|----------|-----|---------|
| `INT` | IDs, relaciones | `id`, `empresa_id` |
| `VARCHAR(X)` | Textos cortos | `nombre`, `rut` |
| `DECIMAL(15,2)` | Montos monetarios | `monto`, `total` |
| `YEAR` | Año | `año` |
| `ENUM` | Valores fijos | `tipo_transaccion` |
| `JSON` | Datos estructurados | `datos_anteriores` |
| `TIMESTAMP` | Fechas con hora | `fecha_creacion` |
| `DATETIME` | Fechas específicas | `fecha_movimiento` |

---

## 🔐 Constraints e Integridad

### Foreign Keys (ON DELETE)

```sql
tipos_cuenta.empresa_id     → CASCADE   (elimina tipos si empresa se elimina)
registros.empresa_id        → CASCADE   (elimina registros si empresa se elimina)
registros_detalle.registro  → CASCADE   (elimina detalles si registro se elimina)
registros_detalle.tipo      → RESTRICT  (previene eliminar tipo si está en uso)
movimientos_*.empresa_id    → CASCADE
totales_anuales.*           → CASCADE
configuracion_balance.*     → CASCADE
```

### Índices Únicos

```sql
empresas.rut                                    UNIQUE
tipos_cuenta(nombre, empresa_id)                UNIQUE
totales_anuales(empresa_id, año, tipo_cuenta)   UNIQUE
configuracion_balance(empresa_id, año, tipo)    UNIQUE
```

### Índices Compuestos para Performance

```sql
registros(empresa_id, mes, año)
movimientos_debe(empresa_id, mes, año)
movimientos_haber(empresa_id, mes, año)
totales_anuales(empresa_id, año)
```

---

## 🎯 Vistas SQL Predefinidas

### v_resumen_registros
Resumen de registros por empresa y mes
```sql
SELECT * FROM v_resumen_registros
WHERE empresa = 'Mi Empresa';
```

### v_balance_completo
Balance completo con categorías asignadas
```sql
SELECT * FROM v_balance_completo
WHERE empresa = 'Mi Empresa' AND año = 2024;
```

### v_movimientos_consolidados
Movimientos debe + haber unificados
```sql
SELECT * FROM v_movimientos_consolidados
ORDER BY fecha_movimiento DESC
LIMIT 100;
```

---

## ⚙️ Stored Procedures

### sp_calcular_totales_anuales
Recalcula totales anuales desde movimientos
```sql
CALL sp_calcular_totales_anuales(1, 2024);
-- empresa_id, año
```

### sp_validar_balance
Valida que debe = haber en un registro
```sql
CALL sp_validar_balance(123);
-- registro_id
```

---

## 🔍 Funciones Útiles

### fn_obtener_saldo_cuenta
Obtiene el saldo de una cuenta específica
```sql
SELECT fn_obtener_saldo_cuenta(1, 2024, 5);
-- empresa_id, año, tipo_cuenta_id
```

---

## 📏 Normalización

| Nivel | Tabla | Descripción |
|-------|-------|-------------|
| **1NF** | Todas | Sin grupos repetidos, valores atómicos |
| **2NF** | Todas | Sin dependencias parciales |
| **3NF** | Todas | Sin dependencias transitivas |
| **Desnormalizada** | movimientos_debe/haber | Por performance |

### ¿Por qué desnormalizar movimientos_debe/haber?

- **Performance**: Consultas más rápidas sin JOINs complejos
- **Histórico**: Mantiene snapshot de datos
- **Compatibilidad**: Mapeo 1:1 con colecciones Firebase

---

## 💾 Tamaño Estimado por Registro

| Tabla | Bytes/Registro | Notas |
|-------|----------------|-------|
| empresas | ~500 | Incluye strings largos |
| tipos_cuenta | ~150 | Datos simples |
| registros | ~200 | Sin detalles |
| registros_detalle | ~250 | Por línea |
| movimientos_* | ~300 | Por movimiento |
| totales_anuales | ~100 | Datos numéricos |

**Ejemplo**:
- 10 empresas
- 100 registros/año
- 3 líneas/registro promedio
- **Espacio estimado**: ~150 MB/año

---

## 🚀 Optimizaciones Implementadas

✅ Índices en foreign keys
✅ Índices compuestos para queries frecuentes
✅ `DECIMAL(15,2)` para precisión monetaria
✅ `ENGINE=InnoDB` para transacciones ACID
✅ `utf8mb4_unicode_ci` para caracteres especiales
✅ Triggers automáticos de auditoría
✅ Timestamps automáticos (`ON UPDATE`)
✅ Constraints de integridad referencial

---

## 📖 Documentación Relacionada

- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Guía completa de migración
- [README_MIGRACION.md](./README_MIGRACION.md) - Inicio rápido
- [migration_mysql_schema.sql](./migration_mysql_schema.sql) - Schema SQL
- [verificacion_migracion.sql](./verificacion_migracion.sql) - Queries de verificación

---

**Última actualización**: 2025-01-13
**Versión Schema**: 1.0
