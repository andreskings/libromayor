// src/components/historial.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import './historial.css';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const BASE_TYPES = [
  'Caja', 'Ingreso', 'Costo', 'IVA', 'PPM',
  'Ajuste CF', 'Retencion SC', 'Honorarios',
  'Gastos Generales', 'CAPITAL', 'PERDIDA Y GANANCIA',
  'CORRECCION MONETARIA', 'AJUSTE PPM', 'REA REM PPM',
  'REM PPM', 'REV CAP PROPIO'
];

const SPECIAL_TYPES = [
  'PROVEDORES', 'REAJUSTE REMANENTE PPM', 'REMANENTE PPM', 'REV CAPITAL PROPIO'
];

const formatCurrency = (value) => {
  if (!value && value !== 0) return '-';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(numValue || 0);
};

function Historial({ onBack }) {
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState('');
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingEmpresas, setFetchingEmpresas] = useState(true);
  const [loadingYears, setLoadingYears] = useState(false);
  const [error, setError] = useState('');
  const [savingTotals, setSavingTotals] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // ✅ Cache para años por empresa
  const [yearsCache, setYearsCache] = useState({});

  useEffect(() => {
    const fetchEmpresas = async () => {
      try {
        setFetchingEmpresas(true);
        setError('');
        const data = await api.get('/empresas');
        setEmpresas(data);
        if (data.length) {
          setSelectedEmpresa((prev) => prev || data[0].nombre);
        }
      } catch (apiError) {
        setError(apiError.body?.message || 'No se pudieron cargar las empresas');
      } finally {
        setFetchingEmpresas(false);
      }
    };

    fetchEmpresas();
  }, []);

  useEffect(() => {
    if (!selectedEmpresa) {
      setAvailableYears([]);
      setSelectedYear('');
      setTransactions([]);
      return;
    }

    // ✅ Verificar si ya tenemos los años en cache
    if (yearsCache[selectedEmpresa]) {
      setAvailableYears(yearsCache[selectedEmpresa]);
      const years = yearsCache[selectedEmpresa];
      if (years.length) {
        setSelectedYear((prev) => (prev && years.includes(prev) ? prev : years[0]));
      }
      return;
    }

    const fetchYears = async () => {
      try {
        setLoadingYears(true);
        setError('');
        const params = new URLSearchParams();
        params.append('empresa', selectedEmpresa);
        
        // ✅ Solo traer años únicos directamente de la DB
        const registros = await api.get(`/registros?${params.toString()}`);

        const years = [...new Set(registros.map((r) => r.año).filter(Boolean))]
          .map((year) => year.toString())
          .sort((a, b) => b - a);

        setAvailableYears(years);
        setYearsCache(prev => ({ ...prev, [selectedEmpresa]: years }));
        
        if (years.length) {
          setSelectedYear((prev) => (prev && years.includes(prev) ? prev : years[0]));
        } else {
          setSelectedYear('');
        }
      } catch (apiError) {
        setError(apiError.body?.message || 'No se pudieron cargar los años disponibles');
        setAvailableYears([]);
        setSelectedYear('');
      } finally {
        setLoadingYears(false);
      }
    };

    fetchYears();
  }, [selectedEmpresa, yearsCache]);

  // ✅ Memoizar cálculos pesados
  const extractCustomTypes = useCallback((records = []) => {
    const customTypes = new Set();
    records.forEach((transaction) => {
      transaction.datos?.forEach((item) => {
        if (item.tipo && !BASE_TYPES.includes(item.tipo)) {
          customTypes.add(item.tipo);
        }
      });
    });
    return Array.from(customTypes).sort((a, b) => a.localeCompare(b));
  }, []);

  const customTypes = useMemo(() => extractCustomTypes(transactions), [transactions, extractCustomTypes]);

  const calculateTotals = useCallback((records = []) => {
    const totals = {};
    const dynamicTypes = extractCustomTypes(records);
    const allTypes = [...BASE_TYPES, ...dynamicTypes, ...SPECIAL_TYPES];

    allTypes.forEach((tipo) => {
      totals[tipo] = { debe: 0, haber: 0 };
    });

    records.forEach((transaction) => {
      transaction.datos?.forEach((item) => {
        const tipo = item.tipo;
        const monto = parseFloat(item.monto) || 0;
        if (!totals[tipo]) {
          totals[tipo] = { debe: 0, haber: 0 };
        }
        if (item.tipoTransaccion === 'debe') {
          totals[tipo].debe += monto;
        } else if (item.tipoTransaccion === 'haber') {
          totals[tipo].haber += monto;
        }
      });
    });

    return totals;
  }, [extractCustomTypes]);

  const saveTotalsToApi = useCallback(async (records) => {
    if (!selectedEmpresa || !selectedYear || !records?.length) return;
    setSavingTotals(true);
    setSaveSuccess(false);
    setSaveFailed(false);
    try {
      const totals = calculateTotals(records);
      const payload = {
        empresa: selectedEmpresa,
        año: selectedYear,
        totales: Object.entries(totals).reduce((acc, [tipo, valores]) => {
          acc[tipo] = {
            debito: valores.debe || 0,
            credito: valores.haber || 0
          };
          return acc;
        }, {})
      };
      await api.post('/totales', payload);
      setSaveSuccess(true);
    } catch (totalsError) {
      setSaveFailed(true);
      throw totalsError;
    } finally {
      setSavingTotals(false);
      setTimeout(() => {
        setSaveSuccess(false);
        setSaveFailed(false);
      }, 3000);
    }
  }, [calculateTotals, selectedEmpresa, selectedYear]);

  const handleSearch = useCallback(async () => {
    if (!selectedEmpresa) {
      setError('Por favor seleccione una empresa');
      return;
    }
    if (!selectedYear) {
      setError('Por favor seleccione un año');
      return;
    }

    setError('');
    setLoading(true);
    setSaveSuccess(false);
    setSaveFailed(false);
    setTransactions([]);

    try {
      const params = new URLSearchParams();
      params.append('empresa', selectedEmpresa);
      params.append('año', selectedYear);
      const data = await api.get(`/registros?${params.toString()}`);
      setTransactions(data);
      
      if (data.length) {
        // ✅ Guardar totales en background sin bloquear UI
        saveTotalsToApi(data).catch(err => console.error('Error al guardar totales', err));
      }
    } catch (apiError) {
      setError(apiError.body?.message || 'Error al cargar los datos');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [saveTotalsToApi, selectedEmpresa, selectedYear]);

  // ✅ Remover auto-búsqueda, solo buscar cuando el usuario haga click
  // useEffect(() => {
  //   if (selectedEmpresa && selectedYear && !loadingYears && !fetchingEmpresas) {
  //     handleSearch();
  //   }
  // }, [selectedEmpresa, selectedYear, loadingYears, fetchingEmpresas, handleSearch]);

  // ✅ Optimizar agrupación de transacciones por mes
  const getMonthTransactions = useCallback((mes) => {
    if (!transactions.length) return [];

    const monthTransactions = transactions.filter((t) => t.mes === mes);
    const groupedByDetail = {};

    monthTransactions.forEach((transaction) => {
      const detalle = transaction.datos?.[0]?.detalle || 'Sin detalle';
      if (!groupedByDetail[detalle]) {
        groupedByDetail[detalle] = {
          control: transaction.control,
          detalle,
          fecha: transaction.date,
          debe: {},
          haber: {}
        };
      }

      transaction.datos?.forEach((item) => {
        if (item.tipoTransaccion === 'debe') {
          groupedByDetail[detalle].debe[item.tipo] = parseFloat(item.monto);
        } else if (item.tipoTransaccion === 'haber') {
          groupedByDetail[detalle].haber[item.tipo] = parseFloat(item.monto);
        }
      });
    });

    return Object.values(groupedByDetail).sort((a, b) => {
      if (a.fecha && b.fecha) {
        if (a.fecha < b.fecha) return -1;
        if (a.fecha > b.fecha) return 1;
      }
      return 0;
    });
  }, [transactions]);

  const renderMonthRows = (mes) => {
    const monthTransactions = getMonthTransactions(mes);
    const numRows = Math.max(6, monthTransactions.length || 0);
    const rowsToRender = Array(numRows).fill(null);

    monthTransactions.forEach((transaction, index) => {
      rowsToRender[index] = transaction;
    });

    return (
      <React.Fragment key={mes}>
        {rowsToRender.map((rowData, index) => (
          <tr key={`${mes}-row-${index}`} className={index === rowsToRender.length - 1 ? 'last-month-row' : ''}>
            {index === 0 && (
              <td className="mes-cell" rowSpan={rowsToRender.length}>
                <div className="vertical-text">{mes}</div>
              </td>
            )}
            <td className="detalle-cell">{rowData ? rowData.detalle || '-' : '-'}</td>
            <td className="control-cell">{rowData ? formatCurrency(rowData.control) : '-'}</td>
            {BASE_TYPES.map((tipo) => {
              const debeValue = rowData?.debe?.[tipo];
              const haberValue = rowData?.haber?.[tipo];
              return (
                <React.Fragment key={`${mes}-${index}-${tipo}`}>
                  <td className="monto-cell debe">{debeValue !== undefined ? formatCurrency(debeValue) : '-'}</td>
                  <td className="monto-cell haber">{haberValue !== undefined ? formatCurrency(haberValue) : '-'}</td>
                </React.Fragment>
              );
            })}
            {customTypes.map((tipo) => {
              const debeValue = rowData?.debe?.[tipo];
              const haberValue = rowData?.haber?.[tipo];
              return (
                <React.Fragment key={`${mes}-${index}-custom-${tipo}`}>
                  <td className="monto-cell debe">{debeValue !== undefined ? formatCurrency(debeValue) : '-'}</td>
                  <td className="monto-cell haber">{haberValue !== undefined ? formatCurrency(haberValue) : '-'}</td>
                </React.Fragment>
              );
            })}
          </tr>
        ))}
      </React.Fragment>
    );
  };

  const totals = useMemo(() => calculateTotals(transactions), [transactions, calculateTotals]);
  const specialTotals = useMemo(
    () => SPECIAL_TYPES.filter((tipo) => !BASE_TYPES.includes(tipo) && !customTypes.includes(tipo)),
    [customTypes]
  );

  const renderTotalsTable = () => (
    <>
      <div className="totals-header-container">
        <h2 className="totals-title">TOTALES</h2>
        {saveSuccess && <span className="save-success-message">Datos guardados correctamente</span>}
        {saveFailed && <span className="save-error-message">Error al guardar datos</span>}
      </div>

      <table className="totals-table">
        <thead>
          <tr>
            <th colSpan="2" className="totals-header">TOTALES</th>
            {BASE_TYPES.map((tipo) => (
              <th key={`total-header-${tipo}`} colSpan="2" className="tipo-header">
                {tipo}
              </th>
            ))}
            {customTypes.map((tipo) => (
              <th key={`total-header-custom-${tipo}`} colSpan="2" className="tipo-header">
                {tipo}
              </th>
            ))}
            {specialTotals.map((tipo) => (
              <th key={`total-header-special-${tipo}`} colSpan="2" className="tipo-header">
                {tipo}
              </th>
            ))}
          </tr>
          <tr>
            <th className="empty-cell" colSpan="2"></th>
            {[...BASE_TYPES, ...customTypes, ...specialTotals].map((tipo) => (
              <React.Fragment key={`total-subheader-${tipo}`}>
                <th className="debe-header">Debe</th>
                <th className="haber-header">Haber</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="totals-row">
            <td colSpan="2" className="totals-label">Suma Total</td>
            {[...BASE_TYPES, ...customTypes, ...specialTotals].map((tipo) => (
              <React.Fragment key={`total-values-${tipo}`}>
                <td className="monto-cell debe total-value">{formatCurrency(totals[tipo]?.debe || 0)}</td>
                <td className="monto-cell haber total-value">{formatCurrency(totals[tipo]?.haber || 0)}</td>
              </React.Fragment>
            ))}
          </tr>
        </tbody>
      </table>
    </>
  );

  return (
    <div className="historial-container">
      <div className="header-container">
        <button onClick={onBack} className="back-button">
          Volver al Formulario
        </button>

        <h1 className="title">Historial de Registros</h1>

        <div className="controls">
          <div className="control-group">
            <label htmlFor="empresa" className="label">Empresa:</label>
            <select
              id="empresa"
              value={selectedEmpresa}
              onChange={(e) => setSelectedEmpresa(e.target.value)}
              disabled={fetchingEmpresas || loading}
              className="select"
            >
              <option value="">Seleccionar Empresa</option>
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.nombre}>
                  {empresa.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="year" className="label">Año:</label>
            <select
              id="year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              disabled={fetchingEmpresas || loadingYears || loading}
              className="select"
            >
              <option value="">Seleccionar Año</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="button-group">
            <button
              onClick={handleSearch}
              disabled={!selectedEmpresa || !selectedYear || loading || fetchingEmpresas || loadingYears}
              className={`search-button ${loading ? 'loading' : ''} ${savingTotals ? 'saving' : ''}`}
            >
              {loading ? 'Cargando...' : 'Buscar'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Cargando datos...</div>
      ) : (
        <div className="results-container">
          {transactions.length > 0 ? (
            <>
              <div className="table-wrapper">
                <table className="historial-table">
                  <thead>
                    <tr>
                      <th className="fixed-column mes-header" rowSpan="2">Mes</th>
                      <th className="fixed-column detalle-header" rowSpan="2">Detalle</th>
                      <th className="fixed-column control-header" rowSpan="2">Control</th>

                      {BASE_TYPES.map((tipo) => (
                        <th className="tipo-header" key={`header-${tipo}`} colSpan="2">
                          {tipo}
                        </th>
                      ))}

                      {customTypes.map((tipo) => (
                        <th className="tipo-header" key={`header-custom-${tipo}`} colSpan="2">
                          {tipo}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {BASE_TYPES.map((tipo) => (
                        <React.Fragment key={`subheader-${tipo}`}>
                          <th className="debe-header">Debe</th>
                          <th className="haber-header">Haber</th>
                        </React.Fragment>
                      ))}

                      {customTypes.map((tipo) => (
                        <React.Fragment key={`subheader-custom-${tipo}`}>
                          <th className="debe-header">Debe</th>
                          <th className="haber-header">Haber</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>{MESES.map((mes) => renderMonthRows(mes))}</tbody>
                </table>
              </div>

              <div className="totals-section">{renderTotalsTable()}</div>
            </>
          ) : (
            selectedEmpresa && selectedYear && !loading ? (
              <div className="no-results">No se encontraron registros para los criterios seleccionados.</div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

export default Historial;