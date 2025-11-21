import { useState } from 'react';
import { db } from './Firebase'; // Importamos la configuración de Firebase
import { collection, addDoc } from "firebase/firestore"; // Importamos funciones necesarias

const TransactionForm = () => {
  const [incomeForm, setIncomeForm] = useState({
    date: "",
    products: [{ name: "", price: "" }]
  });

  const handleInputChange = (e, index) => {
    const { name, value } = e.target;
    const updatedForm = { ...incomeForm };
    if (name === "date") {
      updatedForm.date = value;
    } else {
      updatedForm.products[index][name] = value;
    }
    setIncomeForm(updatedForm);
  };

  const handleAddProduct = () => {
    setIncomeForm({
      ...incomeForm,
      products: [...incomeForm.products, { name: "", price: "" }]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Calcular el total
      const total = incomeForm.products.reduce((sum, product) => sum + parseFloat(product.price || 0), 0);

      // Convertir la fecha a formato ISO
      const currentDate = new Date(incomeForm.date);
      const formattedDate = currentDate.toISOString().split("T")[0]; // Solo la fecha sin la hora

      // Guardar en Firestore
      await addDoc(collection(db, "transactions"), {
        date: formattedDate,
        products: incomeForm.products,
        total: total
      });

      // Limpiar el formulario después de guardar
      setIncomeForm({ date: "", products: [{ name: "", price: "" }] });
      alert("Transacción guardada con éxito");

    } catch (error) {
      console.error("Error al guardar la transacción: ", error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="date"
        name="date"
        value={incomeForm.date}
        onChange={handleInputChange}
        required
      />
      {incomeForm.products.map((product, index) => (
        <div key={index}>
          <input
            type="text"
            name="name"
            value={product.name}
            placeholder="Nombre del producto"
            onChange={(e) => handleInputChange(e, index)}
            required
          />
          <input
            type="number"
            name="price"
            value={product.price}
            placeholder="Precio"
            onChange={(e) => handleInputChange(e, index)}
            required
          />
        </div>
      ))}
      <button type="button" onClick={handleAddProduct}>Agregar Producto</button>
      <button type="submit">Guardar Transacción</button>
    </form>
  );
};

export default TransactionForm;
