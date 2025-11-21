import { useEffect, useState } from 'react';
import { db } from './Firebase'; // Importamos la configuración de Firebase
import { collection, getDocs } from "firebase/firestore"; // Funciones necesarias para leer datos

const TransactionList = () => {
  const [transactions, setTransactions] = useState([]);

  const fetchTransactions = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "transactions"));
      const transactionsList = querySnapshot.docs.map(doc => doc.data());
      setTransactions(transactionsList); // Guardamos las transacciones en el estado
    } catch (error) {
      console.error("Error al obtener las transacciones: ", error);
    }
  };

  useEffect(() => {
    fetchTransactions(); // Llamamos a la función al cargar el componente
  }, []); // Solo se ejecuta una vez cuando el componente se monta

  return (
    <div>
      <h2>Lista de Transacciones</h2>
      <ul>
        {transactions.map((transaction, index) => (
          <li key={index}>
            <strong>Fecha:</strong> {transaction.date}<br />
            <strong>Total:</strong> ${transaction.total}<br />
            <strong>Productos:</strong>
            <ul>
              {transaction.products.map((product, i) => (
                <li key={i}>{product.name}: ${product.price}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TransactionList;
