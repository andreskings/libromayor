import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import './empresas.css';

function Empresas({ onBack }) {
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [rutFormateado, setRutFormateado] = useState('');
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchEmpresas = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.get('/empresas');
      setEmpresas(data);
    } catch (err) {
      setError(err.body?.message || 'No se pudieron cargar las empresas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  // ✅ Función corregida para formatear el RUT
  const formatearRut = (rutInput) => {
    // Eliminar todos los caracteres no alfanuméricos
    let rutLimpio = rutInput.replace(/[^0-9kK]/g, '');
    
    // Validar que tenga al menos 2 caracteres
    if (rutLimpio.length < 2) {
      return rutLimpio;
    }
    
    // Separar dígito verificador
    let dv = rutLimpio.slice(-1).toUpperCase();
    let rutNumeros = rutLimpio.slice(0, -1);
    
    // Validar que tenga números
    if (rutNumeros.length === 0) {
      return rutLimpio;
    }
    
    // ✅ Formatear con puntos de miles (de derecha a izquierda)
    let rutFormateado = '';
    let contador = 0;
    
    for (let i = rutNumeros.length - 1; i >= 0; i--) {
      if (contador === 3) {
        rutFormateado = '.' + rutFormateado;
        contador = 0;
      }
      rutFormateado = rutNumeros[i] + rutFormateado;
      contador++;
    }
    
    // Agregar dígito verificador
    return rutFormateado + '-' + dv;
  };

  // Actualizar el estado del RUT formateado cuando cambie el RUT
  useEffect(() => {
    if (rut) {
      if (rut.length >= 2) {
        setRutFormateado(formatearRut(rut));
      } else {
        setRutFormateado('');
      }
    } else {
      setRutFormateado('');
    }
  }, [rut]);

  const handleAddEmpresa = async (e) => {
    e.preventDefault();
    
    if (!nombre || !rut) {
      setError('Por favor, complete ambos campos');
      return;
    }

    try {
      const rutFinal = rutFormateado || formatearRut(rut);

      // ✅ Validar que el RUT no esté vacío después del formateo
      if (!rutFinal || rutFinal.length < 3) {
        setError('Por favor, ingrese un RUT válido');
        return;
      }

      await api.post('/empresas', {
        nombre,
        rut: rutFinal,
        direccion: '',
        giro: '',
        comuna: ''
      });
      
      setNombre('');
      setRut('');
      setRutFormateado('');
      setError('');
      fetchEmpresas();
    } catch (error) {
      console.error('Error al agregar la empresa:', error);
      setError(error.body?.message || 'No se pudo guardar la empresa');
    }
  };

  const handleDeleteEmpresa = async (id) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta empresa?')) {
      try {
        await api.delete(`/empresas/${id}`);
        setError('');
        fetchEmpresas();
      } catch (error) {
        console.error('Error al eliminar la empresa:', error);
        setError(error.body?.message || 'No se pudo eliminar la empresa');
      }
    }
  };

  const handleEditEmpresa = async (id) => {
    const empresa = empresas.find(e => e.id === id);
    if (!empresa) return;
    
    const newNombre = prompt('Nuevo nombre de la empresa:', empresa.nombre);
    
    // Mostrar el RUT sin formato para editar
    const rutSinFormato = empresa.rut.replace(/\./g, '').replace('-', '');
    const newRut = prompt('Nuevo RUT de la empresa:', rutSinFormato);
    
    if (newNombre && newRut) {
      try {
        // Formatear el nuevo RUT antes de guardar
        const newRutFormateado = formatearRut(newRut);
        
        // ✅ Validar que el RUT formateado sea válido
        if (!newRutFormateado || newRutFormateado.length < 3) {
          setError('Por favor, ingrese un RUT válido');
          return;
        }
        
        await api.put(`/empresas/${id}`, {
          nombre: newNombre,
          rut: newRutFormateado,
          direccion: empresa.direccion || '',
          giro: empresa.giro || '',
          comuna: empresa.comuna || ''
        });
        
        setError('');
        fetchEmpresas();
      } catch (error) {
        console.error('Error al editar la empresa:', error);
        setError(error.body?.message || 'No se pudo actualizar la empresa');
      }
    } else if (newNombre !== null && newRut !== null) {
      setError('Por favor, ingrese un nuevo nombre y RUT válidos');
    }
  };

  return (
    <div className="container">
      <h2>Gestión de Empresas</h2>
      
      <button onClick={onBack} className="back-bttn">
        Volver al Menú Principal
      </button>

      <form onSubmit={handleAddEmpresa}>
        <div className="form-group">
          <label htmlFor="nombre">Nombre de la Empresa</label>
          <input
            id="nombre"
            type="text"
            placeholder="Nombre de la empresa"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="rut">RUT de la Empresa</label>
          <input
            id="rut"
            type="text"
            placeholder="RUT de la empresa (ej: 12345678-9)"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            required
          />
          {rutFormateado && (
            <div className="rut-preview">
              <small>Vista previa: <strong>{rutFormateado}</strong></small>
            </div>
          )}
        </div>
        <button type="submit" className="add-button">Agregar Empresa</button>
      </form>

      {error && <p className="error-message">{error}</p>}
      
      <h3>Lista de Empresas</h3>
      {loading && <p>Cargando...</p>}
      {empresas.length === 0 ? (
        <p className="no-data">No hay empresas registradas</p>
      ) : (
        <ul className="empresas-list">
          {empresas.map((empresa) => (
            <li key={empresa.id} className="empresa-item">
              <span><strong>{empresa.nombre}</strong> - {empresa.rut}</span>
              <div className="button-group">
                <button className="edit-button" onClick={() => handleEditEmpresa(empresa.id)}>
                  Editar
                </button>
                <button className="delete-button" onClick={() => handleDeleteEmpresa(empresa.id)}>
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Empresas;