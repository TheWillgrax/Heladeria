// factura.js - renderiza la factura y permite descargarla en PDF

document.addEventListener('DOMContentLoaded', () => {
  const order = JSON.parse(localStorage.getItem('lastOrder') || 'null');
  if (!order) {
    document.querySelector('.invoice-container').innerHTML = '<p>No hay factura disponible.</p>';
    return;
  }

  // Mostrar meta e información del cliente
  const metaEl = document.getElementById('invoice-meta');
  const customerEl = document.getElementById('customer-info');
  metaEl.innerHTML = `<p><strong>Orden #</strong> ${order.orderId} - ${new Date(order.createdAt).toLocaleString()}</p>`;
  customerEl.innerHTML = `
    <p><strong>Nombre:</strong> ${order.customer.name}</p>
    <p><strong>Email:</strong> ${order.customer.email}</p>
    <p><strong>Dirección:</strong> ${order.customer.address}</p>
  `;

  // Renderizar items
  const itemsBody = document.getElementById('invoice-items');
  let total = 0;
  order.items.forEach(it => {
    const subtotal = it.price * it.quantity;
    total += subtotal;
    itemsBody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${it.name}</td>
        <td>${it.quantity}</td>
        <td>Q${it.price.toFixed(2)}</td>
        <td>Q${subtotal.toFixed(2)}</td>
      </tr>
    `);
  });
  document.getElementById('invoice-total').textContent = `Q${total.toFixed(2)}`;

  // Descargar factura
  document.getElementById('download-invoice').addEventListener('click', () => {
    if (window.jspdf && window.jspdf.jsPDF) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.text('Factura - Heladería Victoria', 10, 10);
      doc.text(`Orden #: ${order.orderId}`, 10, 20);
      doc.text(`Nombre: ${order.customer.name}`, 10, 30);
      doc.text(`Email: ${order.customer.email}`, 10, 40);
      let y = 50;
      order.items.forEach(it => {
        doc.text(`${it.name} x${it.quantity} - Q${(it.price * it.quantity).toFixed(2)}`, 10, y);
        y += 10;
      });
      doc.text(`Total: Q${total.toFixed(2)}`, 10, y + 10);
      doc.save(`factura_${order.orderId}.pdf`);
    } else {
      // Fallback al diálogo de impresión
      window.print();
    }
  });
});
