# Migración Firebase a MySQL - Libro Mayor

## 🚀 Inicio Rápido

### Archivos Generados

```
libromayor/
├── migration_mysql_schema.sql          # Schema completo de MySQL
├── firebase_to_mysql_migration.js      # Script de migración Node.js
├── verificacion_migracion.sql          # Script de verificación
├── MIGRATION_GUIDE.md                  # Guía detallada completa
├── .env.example                        # Plantilla de configuración
└── README_MIGRACION.md                 # Este archivo
```

### Pasos Rápidos

#### 1. Instalar Dependencias

```bash
npm install
```

#### 2. Configurar MySQL

```bash
# Copiar plantilla de configuración
cp .env.example .env

# Editar .env con tus credenciales
# MYSQL_HOST=localhost
# MYSQL_USER=root
# MYSQL_PASSWORD=tu_password
# MYSQL_DATABASE=libromayor
```

#### 3. Crear Schema MySQL

```bash
npm run setup-schema
# O manualmente:
# mysql -u root -p < migration_mysql_schema.sql
```

#### 4. Descargar Credenciales Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Proyecto: **cuadernopublico**
3. Settings > Service Accounts
4. Generate New Private Key
5. Guarda como `serviceAccountKey.json` en la raíz del proyecto

#### 5. Ejecutar Migración

```bash
npm run migrate
```

#### 6. Verificar Resultados

```bash
npm run verify
```

---

## 📊 Estructura de Datos Migrada

### Colecciones Firebase → Tablas MySQL

| Firebase | MySQL | Descripción |
|----------|-------|-------------|
| **empresas** | `empresas` | Información de empresas |
| | `tipos_cuenta` | Tipos de cuenta personalizados |
| **registros** | `registros` | Registros contables principales |
| | `registros_detalle` | Detalles de cada registro |
| **debe** | `movimientos_debe` | Movimientos de débito |
| **haber** | `movimientos_haber` | Movimientos de crédito |
| **totales** | `totales_anuales` | Totales agregados por año |
| **balances** | `configuracion_balance` | Configuraciones de balance |

---

## 🔍 Schema MySQL Principal

### Tablas Principales

#### empresas
```sql
- id (PK)
- nombre
- rut (UNIQUE)
- direccion
- giro
- comuna
```

#### registros
```sql
- id (PK)
- empresa_id (FK → empresas)
- mes
- año
- control
- total
- fecha_registro
```

#### registros_detalle
```sql
- id (PK)
- registro_id (FK → registros)
- tipo_cuenta_id (FK → tipos_cuenta)
- detalle
- tipo_transaccion (debe/haber)
- monto
- orden
```

### Características Adicionales

✅ **19 tipos de cuenta base** predefinidos
✅ **Triggers de auditoría** automáticos
✅ **Vistas SQL** para consultas comunes
✅ **Stored Procedures** para cálculos
✅ **Índices optimizados** para performance

---

## 📝 Consultas SQL Útiles

### Ver todas las empresas
```sql
SELECT * FROM empresas;
```

### Ver registros de una empresa
```sql
SELECT r.*, e.nombre AS empresa
FROM registros r
JOIN empresas e ON r.empresa_id = e.id
WHERE e.nombre = 'Mi Empresa'
ORDER BY r.año, r.mes;
```

### Balance completo (vista)
```sql
SELECT *
FROM v_balance_completo
WHERE empresa = 'Mi Empresa' AND año = 2024;
```

### Resumen por mes
```sql
SELECT * FROM v_resumen_registros
WHERE empresa = 'Mi Empresa'
ORDER BY año, mes;
```

### Verificar balances cuadrados
```sql
CALL sp_validar_balance(1); -- ID del registro
```

### Calcular totales anuales
```sql
CALL sp_calcular_totales_anuales(1, 2024); -- empresa_id, año
```

---

## ⚠️ Importante

### Antes de Migrar

1. **Backup de Firebase**: Exporta tus datos de Firebase como respaldo
2. **Ambiente de prueba**: Prueba primero en desarrollo
3. **Verificar conexiones**: Asegúrate de tener acceso a MySQL

### Durante la Migración

- El script muestra progreso en tiempo real
- Los errores no detienen el proceso completo
- Se genera un log detallado de la migración

### Después de Migrar

1. Ejecutar `npm run verify` para validar datos
2. Verificar totales manualmente
3. Probar consultas de negocio
4. Configurar backups de MySQL

---

## 🛠️ Troubleshooting

### Error: "ECONNREFUSED"
**Solución**: MySQL no está ejecutándose
```bash
# Windows
net start MySQL80

# Linux/Mac
sudo service mysql start
```

### Error: "Access denied"
**Solución**: Verificar credenciales en `.env`

### Error: "serviceAccountKey.json not found"
**Solución**: Descargar desde Firebase Console (ver paso 4)

### Datos duplicados
**Solución**: El script maneja duplicados automáticamente con `ON DUPLICATE KEY UPDATE`

---

## 📚 Documentación Completa

Para más detalles, consulta [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) que incluye:

- Explicación detallada de cada tabla
- Mapeo completo de datos
- Procedimientos almacenados
- Vistas SQL
- Optimizaciones
- Plan de rollback
- FAQs

---

## 🔐 Seguridad

### Archivos Sensibles (NO subir a Git)

```
.env
serviceAccountKey.json
```

Agrega a `.gitignore`:
```
.env
serviceAccountKey.json
*.log
```

---

## 📞 Soporte

Si tienes problemas:

1. Revisa [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
2. Verifica los logs de migración
3. Ejecuta `npm run verify` para diagnóstico
4. Consulta la sección Troubleshooting

---

## ✅ Checklist de Migración

- [ ] MySQL 8.0+ instalado
- [ ] Node.js 14+ instalado
- [ ] Dependencias instaladas (`npm install`)
- [ ] Archivo `.env` configurado
- [ ] Schema MySQL creado (`npm run setup-schema`)
- [ ] `serviceAccountKey.json` descargado
- [ ] Migración ejecutada (`npm run migrate`)
- [ ] Verificación ejecutada (`npm run verify`)
- [ ] Datos validados manualmente
- [ ] Backup de MySQL configurado

---

**Fecha de creación**: 2025-01-13
**Versión**: 1.0
**Autor**: Claude Code (Anthropic)
