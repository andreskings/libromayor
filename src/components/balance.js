import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import './balance.css';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const BASE_ACCOUNT_ORDER = [
  'Caja', 'Ingreso', 'Costo', 'IVA', 'PPM', 'Ajuste CF',
  'Retencion SC', 'Honorarios', 'Gastos Generales'
];

const CATEGORY_FIELDS = {
  activo: 'activoInventario',
  pasivo: 'pasivoInventario',
  perdidas: 'perdidas',
  ganancias: 'ganancias'
};

const CATEGORY_LABELS = {
  activo: 'ACT',
  pasivo: 'PAS',
  perdidas: 'PER',
  ganancias: 'GAN'
};

const CATEGORY_COLORS = {
  activo: '#28a745',
  pasivo: '#6c757d',
  perdidas: '#dc3545',
  ganancias: '#007bff'
};

const formatValue = (value) => (
  value > 0
    ? value.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : ''
);

const buildBaseRows = (tipos = []) => {
  const rows = tipos.map(({ tipo, total_debito, total_credito }) => {
    const debe = parseFloat(total_debito) || 0;
    const haber = parseFloat(total_credito) || 0;
    const saldo = debe - haber;
    return {
      tipo,
      debe,
      haber,
      saldoDeudor: saldo > 0 ? saldo : 0,
      saldoAcreedor: saldo < 0 ? Math.abs(saldo) : 0,
      activoInventario: 0,
      pasivoInventario: 0,
      perdidas: 0,
      ganancias: 0,
      assignedCategory: null
    };
  });

  rows.sort((a, b) => {
    const indexA = BASE_ACCOUNT_ORDER.indexOf(a.tipo);
    const indexB = BASE_ACCOUNT_ORDER.indexOf(b.tipo);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.tipo.localeCompare(b.tipo);
  });

  return rows;
};

const applyCategoriesFromConfig = (rows, configuraciones = []) => {
  if (!configuraciones.length) return rows;
  return rows.map((row) => {
    const match = configuraciones.find((config) => config.tipo === row.tipo);
    if (!match || !CATEGORY_FIELDS[match.categoria]) {
      return row;
    }
    const value = row.saldoDeudor > 0 ? row.saldoDeudor : row.saldoAcreedor;
    if (value <= 0) return row;
    return {
      ...row,
      activoInventario: match.categoria === 'activo' ? value : 0,
      pasivoInventario: match.categoria === 'pasivo' ? value : 0,
      perdidas: match.categoria === 'perdidas' ? value : 0,
      ganancias: match.categoria === 'ganancias' ? value : 0,
      assignedCategory: match.categoria
    };
  });
};

const calculateTotals = (rows) => rows.reduce((acc, item) => {
  acc.debe += item.debe || 0;
  acc.haber += item.haber || 0;
  acc.saldoDeudor += item.saldoDeudor || 0;
  acc.saldoAcreedor += item.saldoAcreedor || 0;
  acc.activo += item.activoInventario || 0;
  acc.pasivo += item.pasivoInventario || 0;
  acc.perdidas += item.perdidas || 0;
  acc.ganancias += item.ganancias || 0;
  return acc;
}, {
  debe: 0,
  haber: 0,
  saldoDeudor: 0,
  saldoAcreedor: 0,
  activo: 0,
  pasivo: 0,
  perdidas: 0,
  ganancias: 0
});

const getNormalRows = (rows) => rows.filter((row) => !row.isBlank && !row.isSumas && !row.isUtilidad && !row.isTotal);

const appendSummaryRows = (rows) => {
  const totals = calculateTotals(rows);
  const difference = totals.ganancias - totals.perdidas;

  const blankRow = {
    tipo: '',
    debe: 0,
    haber: 0,
    saldoDeudor: 0,
    saldoAcreedor: 0,
    activoInventario: 0,
    pasivoInventario: 0,
    perdidas: 0,
    ganancias: 0,
    isBlank: true
  };

  const sumRow = {
    tipo: 'SUMAS',
    debe: totals.debe,
    haber: totals.haber,
    saldoDeudor: totals.saldoDeudor,
    saldoAcreedor: totals.saldoAcreedor,
    activoInventario: totals.activo,
    pasivoInventario: totals.pasivo,
    perdidas: totals.perdidas,
    ganancias: totals.ganancias,
    isSumas: true
  };

  const utilidadRow = {
    tipo: difference < 0 ? 'PÉRDIDA DEL EJERCICIO' : 'UTILIDAD DEL EJERCICIO',
    debe: 0,
    haber: 0,
    saldoDeudor: 0,
    saldoAcreedor: 0,
    activoInventario: difference < 0 ? Math.abs(difference) : 0,
    pasivoInventario: difference > 0 ? difference : 0,
    perdidas: difference > 0 ? difference : 0,
    ganancias: difference < 0 ? Math.abs(difference) : 0,
    isUtilidad: true
  };

  const totalRow = {
    tipo: 'TOTALES',
    debe: totals.debe,
    haber: totals.haber,
    saldoDeudor: totals.saldoDeudor,
    saldoAcreedor: totals.saldoAcreedor,
    activoInventario: totals.activo + (difference < 0 ? Math.abs(difference) : 0),
    pasivoInventario: totals.pasivo + (difference > 0 ? difference : 0),
    perdidas: totals.perdidas + (difference > 0 ? difference : 0),
    ganancias: totals.ganancias + (difference < 0 ? Math.abs(difference) : 0),
    isTotal: true
  };

  return [...rows, blankRow, sumRow, utilidadRow, totalRow];
};

const BalanceContable = ({ onBack }) => {
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [selectedAño, setSelectedAño] = useState('');
  const [balanceData, setBalanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchEmpresas = async () => {
      try {
        const data = await api.get('/empresas');
        setEmpresas(data);
      } catch (apiError) {
        setError(apiError.body?.message || 'No se pudieron cargar las empresas');
      }
    };
    fetchEmpresas();
  }, []);

  const fetchBalanceData = useCallback(async () => {
    if (!selectedEmpresa || !selectedAño) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.append('empresa', selectedEmpresa);
      params.append('año', selectedAño);
      const totales = await api.get(`/totales?${params.toString()}`);
      const baseRows = buildBaseRows(totales.tipos || []);

      let configuraciones = [];
      try {
        const configuracion = await api.get(`/balances?${params.toString()}`);
        configuraciones = configuracion.configuraciones || [];
      } catch (configError) {
        if (configError.status !== 404) {
          console.error('Error cargando configuraciones', configError);
        }
      }

      const rowsWithCategories = applyCategoriesFromConfig(baseRows, configuraciones);
      setBalanceData(appendSummaryRows(rowsWithCategories));
    } catch (apiError) {
      setError(apiError.body?.message || 'No se pudo cargar el balance');
      setBalanceData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEmpresa, selectedAño]);

  useEffect(() => {
    fetchBalanceData();
  }, [fetchBalanceData]);

  useEffect(() => {
    if (!saveSuccess) return undefined;
    const timeout = setTimeout(() => setSaveSuccess(false), 3000);
    return () => clearTimeout(timeout);
  }, [saveSuccess]);

  const exportToExcel = useCallback(async () => {
    if (!selectedEmpresa || !selectedAño || !balanceData.length) {
      setError('No hay datos para exportar');
      return;
    }

    const empresaData = empresas.find((e) => e.nombre === selectedEmpresa) || {};
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Balance General');

    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'BALANCE GENERAL';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };

    worksheet.getCell('A3').value = `Nombre o razón social: ${selectedEmpresa}`;
    worksheet.getCell('A3').font = { bold: true };
    worksheet.getCell('H3').value = `RUT: ${empresaData.rut || ''}`;
    worksheet.getCell('H3').font = { bold: true };

    worksheet.getCell('A4').value = `DIRECCIÓN: ${empresaData.direccion || ''}`;
    worksheet.getCell('A4').font = { bold: true };
    worksheet.getCell('H4').value = `COMUNA: ${empresaData.comuna || ''}`;
    worksheet.getCell('H4').font = { bold: true };

    worksheet.getCell('A5').value = `GIRO: ${empresaData.giro || ''}`;
    worksheet.getCell('A5').font = { bold: true };

    worksheet.getCell('A6').value = `EJERCICIO COMPRENDIDO ENTRE EL 01 DE ENERO DE ${selectedAño} AL 31 DE DICIEMBRE DE ${selectedAño}`;
    worksheet.getCell('A6').font = { bold: true };
    worksheet.mergeCells('A6:J6');

    const headerRow = worksheet.addRow([
      'Nombre de Cuentas',
      'Débito',
      'Crédito',
      'Deudor',
      'Acreedor',
      'Activo',
      'Pasivo',
      'Pérdidas',
      'Ganancias'
    ]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center' };
      cell.border = { 
        top: { style: 'thin' }, 
        left: { style: 'thin' }, 
        bottom: { style: 'thin' }, 
        right: { style: 'thin' } 
      };
    });

    worksheet.columns = [
      { key: 'tipo', width: 35 },
      { key: 'debe', width: 15 },
      { key: 'haber', width: 15 },
      { key: 'saldoDeudor', width: 15 },
      { key: 'saldoAcreedor', width: 15 },
      { key: 'activoInventario', width: 15 },
      { key: 'pasivoInventario', width: 15 },
      { key: 'perdidas', width: 15 },
      { key: 'ganancias', width: 15 }
    ];

    balanceData.forEach((item) => {
      if (item.isBlank) {
        worksheet.addRow([]);
        return;
      }
      const row = worksheet.addRow([
        item.tipo,
        item.debe > 0 ? item.debe : '',
        item.haber > 0 ? item.haber : '',
        item.saldoDeudor > 0 ? item.saldoDeudor : '',
        item.saldoAcreedor > 0 ? item.saldoAcreedor : '',
        item.activoInventario > 0 ? item.activoInventario : '',
        item.pasivoInventario > 0 ? item.pasivoInventario : '',
        item.perdidas > 0 ? item.perdidas : '',
        item.ganancias > 0 ? item.ganancias : ''
      ]);
      row.eachCell((cell, col) => {
        cell.border = { 
          top: { style: 'thin' }, 
          left: { style: 'thin' }, 
          bottom: { style: 'thin' }, 
          right: { style: 'thin' } 
        };
        if (col > 1) {
          cell.numFmt = '#,##0.00';
        }
        if (item.isSumas || item.isUtilidad || item.isTotal) {
          cell.font = { bold: true };
        }
      });
    });

    worksheet.addRow([]);
    const lastRow = worksheet.lastRow?.number || 0;
    worksheet.mergeCells(`B${lastRow + 1}:D${lastRow + 1}`);
    worksheet.getCell(`B${lastRow + 1}`).value = '_______________________';
    worksheet.mergeCells(`B${lastRow + 2}:D${lastRow + 2}`);
    worksheet.getCell(`B${lastRow + 2}`).value = 'CONTADOR';
    worksheet.getCell(`B${lastRow + 2}`).font = { bold: true };
    worksheet.getCell(`B${lastRow + 2}`).alignment = { horizontal: 'center' };

    worksheet.mergeCells(`F${lastRow + 1}:H${lastRow + 1}`);
    worksheet.getCell(`F${lastRow + 1}`).value = '_______________________';
    worksheet.mergeCells(`F${lastRow + 2}:H${lastRow + 2}`);
    worksheet.getCell(`F${lastRow + 2}`).value = 'REPRESENTANTE LEGAL';
    worksheet.getCell(`F${lastRow + 2}`).font = { bold: true };
    worksheet.getCell(`F${lastRow + 2}`).alignment = { horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Balance_${selectedEmpresa}_${selectedAño}.xlsx`);
  }, [balanceData, empresas, selectedEmpresa, selectedAño]);

  const handleCategoryAssign = (index, category) => {
    if (!CATEGORY_FIELDS[category] || !balanceData[index]) return;
    const target = balanceData[index];
    if (target.isBlank || target.isSumas || target.isUtilidad || target.isTotal) return;
    const value = target.saldoDeudor > 0 ? target.saldoDeudor : target.saldoAcreedor;
    if (value <= 0) return;

    setBalanceData((current) => {
      const updatedRows = current.map((row, idx) => {
        if (row.isBlank || row.isSumas || row.isUtilidad || row.isTotal) {
          return row;
        }
        if (idx !== index) return row;
        return {
          ...row,
          activoInventario: category === 'activo' ? value : 0,
          pasivoInventario: category === 'pasivo' ? value : 0,
          perdidas: category === 'perdidas' ? value : 0,
          ganancias: category === 'ganancias' ? value : 0,
          assignedCategory: category
        };
      });
      return appendSummaryRows(getNormalRows(updatedRows));
    });
  };

  const handleSaveConfiguration = async () => {
    if (!selectedEmpresa || !selectedAño || !balanceData.length) {
      setError('Debe seleccionar empresa, año y tener datos cargados');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      const configuraciones = balanceData
        .filter(item => !item.isBlank && !item.isSumas && !item.isUtilidad && !item.isTotal)
        .map((item) => {
          const categoria = Object.keys(CATEGORY_FIELDS).find((key) => item[CATEGORY_FIELDS[key]] > 0);
          if (!categoria) return null;
          return {
            tipo: item.tipo,
            categoria
          };
        })
        .filter(Boolean);

      await api.post('/balances', { 
        empresa: selectedEmpresa,
        año: parseInt(selectedAño, 10),
        configuraciones 
      });
      
      setSaveSuccess(true);
    } catch (apiError) {
      console.error('Error guardando configuración:', apiError);
      setError(apiError.body?.message || 'No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const renderTable = () => {
    if (!balanceData.length) return null;
    
    return (
      <div className="balance-table-container">
        <table className="balance-table">
          <thead>
            <tr>
              <th rowSpan="2" className="balance-cuenta-header">Nombre de Cuentas</th>
              <th colSpan="2" className="balance-category-header">Sumas</th>
              <th colSpan="2" className="balance-category-header">Saldos</th>
              <th colSpan="2" className="balance-category-header">Inventario</th>
              <th colSpan="2" className="balance-category-header">Resultado</th>
              <th rowSpan="2" className="balance-actions-header">Acciones</th>
            </tr>
            <tr>
              <th className="balance-debe-header">Débito</th>
              <th className="balance-haber-header">Crédito</th>
              <th className="balance-debe-header">Deudor</th>
              <th className="balance-haber-header">Acreedor</th>
              <th className="balance-activo-header">Activo</th>
              <th className="balance-pasivo-header">Pasivo</th>
              <th className="balance-perdidas-header">Pérdidas</th>
              <th className="balance-ganancias-header">Ganancias</th>
            </tr>
          </thead>
          <tbody>
            {balanceData.map((item, index) => {
              if (item.isBlank) {
                return <tr key={`blank-${index}`} className="balance-blank-row"><td colSpan="10">&nbsp;</td></tr>;
              }

              const rowClass = item.isSumas 
                ? 'balance-sumas-row' 
                : item.isUtilidad 
                ? 'balance-utilidad-row' 
                : item.isTotal 
                ? 'balance-total-row' 
                : 'balance-data-row';

              return (
                <tr key={index} className={rowClass}>
                  <td className="balance-tipo-cell">{item.tipo}</td>
                  <td className="balance-monto-cell">{formatValue(item.debe)}</td>
                  <td className="balance-monto-cell">{formatValue(item.haber)}</td>
                  <td className="balance-monto-cell">{formatValue(item.saldoDeudor)}</td>
                  <td className="balance-monto-cell">{formatValue(item.saldoAcreedor)}</td>
                  <td className="balance-monto-cell balance-activo-cell">{formatValue(item.activoInventario)}</td>
                  <td className="balance-monto-cell balance-pasivo-cell">{formatValue(item.pasivoInventario)}</td>
                  <td className="balance-monto-cell balance-perdidas-cell">{formatValue(item.perdidas)}</td>
                  <td className="balance-monto-cell balance-ganancias-cell">{formatValue(item.ganancias)}</td>
                  <td className="balance-actions-cell">
                    {!item.isSumas && !item.isUtilidad && !item.isTotal && (
                      <div className="balance-button-group">
                        {Object.keys(CATEGORY_FIELDS).map((category) => (
                          <button
                            key={category}
                            type="button"
                            className={`balance-category-btn balance-${category}-btn ${
                              item.assignedCategory === category ? 'active' : ''
                            }`}
                            onClick={() => handleCategoryAssign(index, category)}
                            title={`Asignar a ${category}`}
                            style={{
                              backgroundColor: item.assignedCategory === category 
                                ? CATEGORY_COLORS[category] 
                                : 'transparent',
                              color: item.assignedCategory === category ? 'white' : CATEGORY_COLORS[category],
                              borderColor: CATEGORY_COLORS[category]
                            }}
                          >
                            {CATEGORY_LABELS[category]}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return <div className="balance-loading">Cargando datos...</div>;
    }
    if (error) {
      return <div className="balance-error-message">{error}</div>;
    }
    if (!balanceData.length) {
      if (selectedEmpresa && selectedAño) {
        return <div className="balance-no-data">No se encontraron datos para los filtros seleccionados</div>;
      }
      return <div className="balance-no-data">Seleccione empresa y año para ver el balance</div>;
    }
    return renderTable();
  };

  return (
    <div className="balance-container">
      <div className="balance-header">
        <h1 className="balance-title">Balance Contable Anual</h1>
        
        <div className="balance-controls-wrapper">
          <div className="balance-filters-row">
            <div className="balance-filter-group">
              <label htmlFor="empresa-select">Empresa:</label>
              <select
                id="empresa-select"
                className="balance-empresa-select"
                value={selectedEmpresa}
                onChange={(e) => setSelectedEmpresa(e.target.value)}
                disabled={loading}
              >
                <option value="">Seleccione una empresa</option>
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.nombre}>
                    {empresa.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="balance-filter-group">
              <label htmlFor="year-input">Año:</label>
              <input
                id="year-input"
                type="text"
                className="balance-year-input"
                placeholder="YYYY"
                maxLength={4}
                value={selectedAño}
                onChange={(e) => setSelectedAño(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="balance-actions-row">
            <button 
              className="balance-btn balance-return-btn" 
              onClick={onBack}
            >
              ← Volver
            </button>
            
            <button
              className="balance-btn balance-save-btn"
              disabled={!balanceData.length || loading || saving}
              onClick={handleSaveConfiguration}
            >
              {saving ? '💾 Guardando...' : '💾 Guardar'}
            </button>
            
            <button
              className="balance-btn balance-excel-btn"
              disabled={!balanceData.length || loading}
              onClick={exportToExcel}
            >
              📊 Exportar Excel
            </button>

            {saveSuccess && (
              <span className="balance-save-success">✓ Guardado correctamente</span>
            )}
          </div>
        </div>
      </div>

      <div className="balance-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default BalanceContable;