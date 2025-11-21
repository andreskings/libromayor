import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import './registro.css';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const TIPOS_BASE = [
  'Caja', 'Ingreso', 'Costo', 'IVA', 'PPM', 'Ajuste CF',
  'Retencion SC', 'Honorarios', 'Gastos Generales'
];

const DEFAULT_DATO = { detalle: '', tipo: '', tipoTransaccion: 'debe', monto: '' };

// ✅ Funciones de formateo
const formatearNumero = (valor) => {
  if (!valor || valor === '') return '';
  const numero = parseFloat(valor);
  if (isNaN(numero)) return valor;
  return numero.toLocaleString('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

const limpiarNumero = (valorFormateado) => {
  if (!valorFormateado) return '';
  return valorFormateado.replace(/\./g, '').replace(/,/g, '.');
};

const Registro = ({ onBack }) => {
  const [registroForm, setRegistroForm] = useState({
    empresa: '',
    mes: '',
    año: '',
    datos: [{ ...DEFAULT_DATO }],
    total: 0
  });
  const [empresas, setEmpresas] = useState([]);
  const [tiposPersonalizados, setTiposPersonalizados] = useState([]);
  const [registroEditId, setRegistroEditId] = useState(null);
  const [errors, setErrors] = useState({});
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showNewTipoInput, setShowNewTipoInput] = useState(false);
  const [newTipoInput, setNewTipoInput] = useState('');

  const isEditing = Boolean(registroEditId);

  const combinedTipos = useMemo(() => {
    const unique = new Set([...TIPOS_BASE, ...tiposPersonalizados]);
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [tiposPersonalizados]);

  const { totalDebe, totalHaber } = useMemo(() => {
    return registroForm.datos.reduce(
      (acc, dato) => {
        const monto = parseFloat(dato.monto) || 0;
        if (dato.tipoTransaccion === 'debe') {
          acc.totalDebe += monto;
        } else {
          acc.totalHaber += monto;
        }
        return acc;
      },
      { totalDebe: 0, totalHaber: 0 }
    );
  }, [registroForm.datos]);

  useEffect(() => {
    const fetchEmpresas = async () => {
      try {
        const data = await api.get('/empresas');
        setEmpresas(data);
      } catch (error) {
        setNotification({
          show: true,
          type: 'error',
          message: error.body?.message || 'No se pudieron cargar las empresas'
        });
      }
    };
    fetchEmpresas();
  }, []);

  useEffect(() => {
    if (!registroForm.empresa) {
      setTiposPersonalizados([]);
      return;
    }
    let cancelled = false;
    const fetchTipos = async () => {
      try {
        const params = new URLSearchParams();
        params.append('empresa', registroForm.empresa);
        const data = await api.get(`/tipos?${params.toString()}`);
        if (!cancelled) {
          setTiposPersonalizados(data.map(tipo => tipo.nombre));
        }
      } catch (error) {
        if (!cancelled) {
          setNotification({
            show: true,
            type: 'error',
            message: error.body?.message || 'No se pudieron cargar las cuentas'
          });
        }
      }
    };
    fetchTipos();
    return () => {
      cancelled = true;
    };
  }, [registroForm.empresa]);

  useEffect(() => {
    if (!registroForm.empresa || !registroForm.mes || !registroForm.año || !registroForm.datos[0]?.detalle) {
      setRegistroEditId(null);
      return;
    }
    let cancelled = false;
    const buscarRegistro = async () => {
      setSearchLoading(true);
      try {
        const params = new URLSearchParams();
        params.append('empresa', registroForm.empresa);
        params.append('mes', registroForm.mes);
        params.append('año', registroForm.año);
        const registros = await api.get(`/registros?${params.toString()}`);
        const detalleBuscado = registroForm.datos[0].detalle.trim().toLowerCase();
        const registroExistente = registros.find(registro => {
          const detalle = registro.datos?.[0]?.detalle || '';
          return detalle.trim().toLowerCase() === detalleBuscado;
        });
        if (!cancelled && registroExistente) {
          setRegistroEditId(registroExistente.id);
          setRegistroForm(prev => ({
            ...prev,
            datos: registroExistente.datos.map(item => ({
              detalle: item.detalle,
              tipo: item.tipo,
              tipoTransaccion: item.tipoTransaccion,
              monto: String(item.monto)
            })),
            total: registroExistente.total
          }));
          setNotification({
            show: true,
            type: 'info',
            message: 'Registro existente encontrado, se cargaron sus datos.'
          });
        } else if (!cancelled) {
          setRegistroEditId(null);
        }
      } catch (error) {
        if (!cancelled) {
          setNotification({
            show: true,
            type: 'error',
            message: error.body?.message || 'No se pudieron buscar registros previos'
          });
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    };
    buscarRegistro();
    return () => {
      cancelled = true;
    };
  }, [registroForm.empresa, registroForm.mes, registroForm.año, registroForm.datos[0]?.detalle]);

  useEffect(() => {
    if (!notification.show) return undefined;
    const timer = setTimeout(() => setNotification({ show: false, type: '', message: '' }), 3000);
    return () => clearTimeout(timer);
  }, [notification.show]);

  const calculateControl = () => {
    if (totalDebe > 0 && totalHaber > 0) return totalDebe;
    if (totalDebe > 0) return totalDebe;
    return totalHaber;
  };

  const handleDatoChange = (index, field, value) => {
    setRegistroForm(prev => {
      const nuevosDatos = prev.datos.map((dato, i) => {
        if (i === index) {
          // ✅ Si es el campo monto, guardamos el valor limpio
          if (field === 'monto') {
            const valorLimpio = limpiarNumero(value);
            return { ...dato, [field]: valorLimpio };
          }
          return { ...dato, [field]: value };
        }
        return dato;
      });
      return { ...prev, datos: nuevosDatos };
    });
    
    if (errors[`${field}${index}`]) {
      setErrors(prev => {
        const nextErrors = { ...prev };
        delete nextErrors[`${field}${index}`];
        return nextErrors;
      });
    }
    
    if (index === 0 && field === 'detalle') {
      setRegistroEditId(null);
    }
  };

  const handleTipoTransaccionChange = (index, tipo) => {
    setRegistroForm(prev => ({
      ...prev,
      datos: prev.datos.map((dato, i) => (i === index ? { ...dato, tipoTransaccion: tipo } : dato))
    }));
  };

  const handleInputChange = (field, value) => {
    setRegistroForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const nextErrors = { ...prev };
        delete nextErrors[field];
        return nextErrors;
      });
    }
    if (['empresa', 'mes', 'año'].includes(field)) {
      setRegistroEditId(null);
    }
  };

  const addDatoRow = () => {
    setRegistroForm(prev => ({
      ...prev,
      datos: [...prev.datos, { ...DEFAULT_DATO, detalle: prev.datos[0]?.detalle || '' }]
    }));
  };

  const removeDatoRow = (index) => {
    if (registroForm.datos.length === 1) return;
    setRegistroForm(prev => ({
      ...prev,
      datos: prev.datos.filter((_, i) => i !== index)
    }));
  };

  const getTiposDisponibles = (currentTipo) => {
    if (currentTipo) return combinedTipos;
    const usos = registroForm.datos.reduce((acc, dato) => {
      if (dato.tipo) acc[dato.tipo] = (acc[dato.tipo] || 0) + 1;
      return acc;
    }, {});
    return combinedTipos.filter(tipo => (usos[tipo] || 0) < 2);
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!registroForm.empresa) nextErrors.empresa = 'Seleccione una empresa';
    if (!registroForm.mes) nextErrors.mes = 'Seleccione un mes';
    if (!registroForm.año) nextErrors.año = 'Ingrese el año';
    registroForm.datos.forEach((dato, index) => {
      if (!dato.detalle) nextErrors[`detalle${index}`] = 'Complete el campo de detalle';
      if (!dato.tipo) nextErrors[`tipo${index}`] = 'Seleccione el tipo';
      if (!dato.monto) nextErrors[`monto${index}`] = 'Ingrese el monto';
    });
    if (totalDebe > 0 && totalHaber > 0 && Math.abs(totalDebe - totalHaber) > 0.01) {
      nextErrors.balance = 'El total DEBE y HABER deben ser iguales';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetForm = () => {
    setRegistroForm({
      empresa: registroForm.empresa,
      mes: registroForm.mes,
      año: registroForm.año,
      datos: [{ ...DEFAULT_DATO }],
      total: 0
    });
    setRegistroEditId(null);
    setErrors({});
  };

  const handleAddNewTipo = async () => {
    if (!registroForm.empresa) {
      setNotification({ show: true, type: 'error', message: 'Seleccione una empresa antes de crear una cuenta' });
      return;
    }
    const nombre = newTipoInput.trim();
    if (!nombre) {
      setNotification({ show: true, type: 'error', message: 'Ingrese el nombre de la nueva cuenta' });
      return;
    }
    try {
      await api.post('/tipos', { empresa: registroForm.empresa, nombre });
      setNewTipoInput('');
      setShowNewTipoInput(false);
      setNotification({ show: true, type: 'success', message: 'Cuenta creada correctamente' });
      const params = new URLSearchParams();
      params.append('empresa', registroForm.empresa);
      const data = await api.get(`/tipos?${params.toString()}`);
      setTiposPersonalizados(data.map(tipo => tipo.nombre));
    } catch (error) {
      setNotification({
        show: true,
        type: 'error',
        message: error.body?.message || 'No se pudo crear la cuenta'
      });
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      setNotification({ show: true, type: 'error', message: 'Complete los campos obligatorios' });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        empresa: registroForm.empresa,
        mes: registroForm.mes,
        año: registroForm.año,
        datos: registroForm.datos,
        control: calculateControl(),
        total: registroForm.datos.reduce((acc, dato) => acc + (parseFloat(dato.monto) || 0), 0)
      };
      if (registroEditId) {
        await api.delete(`/registros/${registroEditId}`);
      }
      await api.post('/registros', payload);
      resetForm();
      setNotification({
        show: true,
        type: 'success',
        message: registroEditId ? 'Registro actualizado correctamente' : 'Registro creado correctamente'
      });
    } catch (error) {
      setNotification({
        show: true,
        type: 'error',
        message: error.body?.message || 'No se pudo guardar el registro'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRegistro = async () => {
    if (!registroEditId) return;
    if (!window.confirm('¿Eliminar definitivamente este registro?')) return;
    setLoading(true);
    try {
      await api.delete(`/registros/${registroEditId}`);
      resetForm();
      setRegistroForm(prev => ({
        ...prev,
        empresa: '',
        mes: '',
        año: '',
        datos: [{ ...DEFAULT_DATO }]
      }));
      setNotification({ show: true, type: 'success', message: 'Registro eliminado' });
    } catch (error) {
      setNotification({
        show: true,
        type: 'error',
        message: error.body?.message || 'No se pudo eliminar el registro'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      {notification.show && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
      
      <div className="header">
        <h2>{isEditing ? 'Editar Registro' : 'Hacer Registro'}</h2>
        <div className="header-buttons">
          <button onClick={onBack} className="back-btn">
            Atrás
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>Empresa Correspondiente:</label>
        <select
          value={registroForm.empresa}
          onChange={(e) => handleInputChange('empresa', e.target.value)}
          className={`select-empresa ${errors.empresa ? 'error' : ''}`}
        >
          <option value="">Seleccione una empresa</option>
          {empresas.map(empresa => (
            <option key={empresa.id} value={empresa.nombre}>
              {empresa.nombre} - {empresa.rut}
            </option>
          ))}
        </select>
        {errors.empresa && <span className="error-message">{errors.empresa}</span>}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Mes Correspondiente:</label>
          <select
            value={registroForm.mes}
            onChange={(e) => handleInputChange('mes', e.target.value)}
            className={errors.mes ? 'error' : ''}
          >
            <option value="">Seleccione mes</option>
            {MESES.map(mes => (
              <option key={mes} value={mes}>{mes}</option>
            ))}
          </select>
          {errors.mes && <span className="error-message">{errors.mes}</span>}
        </div>

        <div className="form-group">
          <label>Año:</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="YYYY"
            value={registroForm.año}
            onChange={(e) => handleInputChange('año', e.target.value)}
            maxLength="4"
            className={errors.año ? 'error' : ''}
          />
          {errors.año && <span className="error-message">{errors.año}</span>}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Detalle:</label>
          <input
            type="text"
            placeholder="Detalle"
            value={registroForm.datos[0].detalle}
            onChange={(e) => handleDatoChange(0, 'detalle', e.target.value)}
            className={errors[`detalle0`] ? 'error' : ''}
          />
          {errors[`detalle0`] && <span className="error-message">{errors[`detalle0`]}</span>}
        </div>
      </div>

      {registroForm.empresa && (
        <div className="create-new-tipo-section">
          {!showNewTipoInput ? (
            <button 
              onClick={() => setShowNewTipoInput(true)} 
              className="add-tipo-button"
              type="button"
            >
              Crear Nueva Cuenta
            </button>
          ) : (
            <div className="new-tipo-input-container">
              <input
                type="text"
                placeholder="Nombre de la nueva Cuenta"
                value={newTipoInput}
                onChange={(e) => setNewTipoInput(e.target.value)}
                className="new-tipo-input"
              />
              <div className="new-tipo-buttons">
                <button 
                  onClick={handleAddNewTipo} 
                  className="save-tipo-button"
                  type="button"
                >
                  Guardar
                </button>
                <button 
                  onClick={() => {
                    setShowNewTipoInput(false);
                    setNewTipoInput("");
                  }} 
                  className="cancel-tipo-button"
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {searchLoading && (
        <div className="search-indicator">
          <p>Buscando registros existentes...</p>
        </div>
      )}

      {isEditing && (
        <div className="edit-indicator">
          <p>Editando registro existente. Los cambios sobrescribirán el registro anterior.</p>
        </div>
      )}

      <div className="datos-section">
        <h3>Cuentas ({registroForm.datos.length})</h3>
        
        {registroForm.datos.map((dato, index) => (
          <div key={index} className="dato-container">
            <div className="dato-row">
              <div className="form-group">
                <label>Tipo:</label>
                <select
                  value={dato.tipo}
                  onChange={(e) => handleDatoChange(index, 'tipo', e.target.value)}
                  className={errors[`tipo${index}`] ? 'error' : ''}
                >
                  <option value="">Seleccione tipo</option>
                  {getTiposDisponibles(dato.tipo, index).map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
                {errors[`tipo${index}`] && <span className="error-message">{errors[`tipo${index}`]}</span>}
              </div>
              
              <div className="transaction-type">
                <button
                  type="button"
                  className={`transaction-button ${dato.tipoTransaccion === 'debe' ? 'active' : ''}`}
                  onClick={() => handleTipoTransaccionChange(index, 'debe')}
                >
                  Debe
                </button>
                <button
                  type="button"
                  className={`transaction-button ${dato.tipoTransaccion === 'haber' ? 'active' : ''}`}
                  onClick={() => handleTipoTransaccionChange(index, 'haber')}
                >
                  Haber
                </button>
              </div>
              
              {/* ✅ Input de monto con formato */}
              <div className="form-group">
                <label>Monto:</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Monto"
                  value={formatearNumero(dato.monto)}
                  onChange={(e) => handleDatoChange(index, 'monto', e.target.value)}
                  onBlur={(e) => {
                    const valorLimpio = limpiarNumero(e.target.value);
                    handleDatoChange(index, 'monto', valorLimpio);
                  }}
                  className={errors[`monto${index}`] ? 'error' : ''}
                />
                {errors[`monto${index}`] && <span className="error-message">{errors[`monto${index}`]}</span>}
              </div>
              
              {registroForm.datos.length > 1 && (
                <button 
                  onClick={() => removeDatoRow(index)} 
                  className="remove-button"
                  title="Eliminar registro"
                  type="button"
                >
                  ✕
                </button>
              )}
            </div>
            {index < registroForm.datos.length - 1 && <hr className="dato-divider" />}
          </div>
        ))}
        
        <button onClick={addDatoRow} className="add-button" type="button">
          Agregar Cuentas
        </button>
      </div>

      {/* ✅ Totales con formato */}
      <div className="totals-container">
        <div className="total-item">
          Total DEBE: ${formatearNumero(totalDebe)}
        </div>
        <div className="total-item">
          Total HABER: ${formatearNumero(totalHaber)}
        </div>
        <div className="total">
          Diferencia: ${formatearNumero(Math.abs(totalDebe - totalHaber))}
        </div>
        {errors.balance && <span className="error-message balance-error">{errors.balance}</span>}
      </div>

      <div className="button-group">
        <button 
          onClick={handleSubmit} 
          className="save-button"
          disabled={loading}
          type="button"
        >
          {loading ? 'Guardando...' : isEditing ? 'Actualizar Registro' : 'Guardar Registro'}
        </button>
        
        {isEditing && (
          <button 
            onClick={handleDeleteRegistro} 
            className="delete-button"
            disabled={loading}
            type="button"
          >
            Eliminar Registro
          </button>
        )}
        
        <button 
          onClick={onBack} 
          className="back-btn"
          disabled={loading}
          type="button"
        >
          Volver al Menú Principal
        </button>
      </div>
    </div>
  );
};

export default Registro;