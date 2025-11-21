// exceljs.js
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

// Función para exportar a Excel
const exportToExcel = async (balanceData, empresa, año) => {
  // Crear un nuevo libro de trabajo
  const workbook = new ExcelJS.Workbook();
  
  // Buscar información adicional de la empresa (RUT, dirección, etc.)
  let empresaData = {};
  try {
    // Suponiendo que hay una función para obtener los datos de la empresa
    const empresaRef = doc(db, 'empresas', empresa);
    const empresaDoc = await getDoc(empresaRef);
    if (empresaDoc.exists()) {
      empresaData = empresaDoc.data();
    }
  } catch (error) {
    console.error("Error al obtener datos de la empresa:", error);
  }
  
  // Agregar una hoja de trabajo
  const worksheet = workbook.addWorksheet('Balance General');
  
  // Configura el ancho de las columnas
  worksheet.columns = [
    { header: '', width: 30 }, // Nombre de cuentas
    { header: '', width: 15 }, // Débito
    { header: '', width: 15 }, // Crédito
    { header: '', width: 15 }, // Deudor
    { header: '', width: 15 }, // Acreedor
    { header: '', width: 15 }, // Activo
    { header: '', width: 15 }, // Pasivo
    { header: '', width: 15 }, // Pérdidas
    { header: '', width: 15 }, // Ganancias
  ];
  
  // Título en el centro
  const titleRow = worksheet.addRow(['BALANCE GENERAL']);
  titleRow.font = { bold: true, size: 16 };
  titleRow.alignment = { horizontal: 'center' };
  worksheet.mergeCells(`A1:I1`);
  
  // Fila en blanco
  worksheet.addRow([]);
  
  // Información de la empresa
  const infoRow1 = worksheet.addRow([`Nombre o razón social: ${empresa}`, '', '', '', '', 'RUT: ' + (empresaData.rut || '')]);
  worksheet.mergeCells(`A3:E3`);
  worksheet.mergeCells(`F3:I3`);
  
  const infoRow2 = worksheet.addRow([`DIRECCIÓN: ${empresaData.direccion || ''}`, '', '', '', '', 'COMUNA: ' + (empresaData.comuna || '')]);
  worksheet.mergeCells(`A4:E4`);
  worksheet.mergeCells(`F4:I4`);
  
  const infoRow3 = worksheet.addRow([`GIRO: ${empresaData.giro || ''}`, '', '', '', '', '']);
  worksheet.mergeCells(`A5:E5`);
  
  // Período del ejercicio
  const periodoRow = worksheet.addRow([`EJERCICIO COMPRENDIDO ENTRE EL 01 DE ENERO DE ${año} AL 31 DE DICIEMBRE DE ${año}`]);
  periodoRow.font = { bold: true };
  worksheet.mergeCells(`A6:I6`);
  
  // Fila de encabezados de la tabla
  const headerRow1 = worksheet.addRow(['Nombre de Cuentas', 'Sumas', '', 'Saldos', '', 'Inventario', '', 'Resultado', '']);
  headerRow1.font = { bold: true };
  worksheet.mergeCells('B7:C7');
  worksheet.mergeCells('D7:E7');
  worksheet.mergeCells('F7:G7');
  worksheet.mergeCells('H7:I7');
  
  // Subencabezados
  const headerRow2 = worksheet.addRow(['', 'Débito', 'Crédito', 'Deudor', 'Acreedor', 'Activo', 'Pasivo', 'Pérdidas', 'Ganancias']);
  headerRow2.font = { bold: true };
  
  // Aplicar estilo a los encabezados
  [headerRow1, headerRow2].forEach(row => {
    row.eachCell(cell => {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });
  });
  
  // Agregar los datos del balance (solo las filas normales, sin los botones de categorización)
  balanceData.forEach((item, index) => {
    if (!item.isBlank) {
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
      
      // Aplicar formato a los números
      row.eachCell((cell, colNumber) => {
        if (colNumber > 1) {  // Las columnas de valores numéricos comienzan desde la segunda columna
          if (cell.value) {
            cell.numFmt = '#,##0.00';
            cell.alignment = { horizontal: 'right' };
          }
        }
        
        // Aplicar bordes a todas las celdas
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      
      // Aplicar estilos especiales para filas de totales, sumas, etc.
      if (item.isSumas || item.isUtilidad || item.isTotal) {
        row.font = { bold: true };
        if (item.isTotal) {
          row.eachCell(cell => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFCCCCCC' }
            };
          });
        }
      }
    } else {
      // Fila en blanco
      worksheet.addRow(['']);
    }
  });
  
  // Agregar línea en blanco después de la tabla
  worksheet.addRow([]);
  
  // Agregar firmas
  const lastRowIndex = worksheet.rowCount + 1;
  const firmaContadorRow = worksheet.addRow(['', '', 'CONTADOR', '', '', '', '', 'REPRESENTANTE LEGAL', '']);
  worksheet.mergeCells(`A${lastRowIndex}:C${lastRowIndex}`);
  worksheet.mergeCells(`F${lastRowIndex}:I${lastRowIndex}`);
  
  // Líneas para firmas
  const lineaFirmaRow = worksheet.addRow(['', '', '___________________', '', '', '', '', '___________________', '']);
  worksheet.mergeCells(`A${lastRowIndex + 1}:C${lastRowIndex + 1}`);
  worksheet.mergeCells(`F${lastRowIndex + 1}:I${lastRowIndex + 1}`);
  
  // Centrar texto de firmas
  [firmaContadorRow, lineaFirmaRow].forEach(row => {
    row.eachCell(cell => {
      cell.alignment = { horizontal: 'center' };
    });
  });
  
  // Generar el archivo Excel
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Balance_${empresa}_${año}.xlsx`);
};

export default exportToExcel;