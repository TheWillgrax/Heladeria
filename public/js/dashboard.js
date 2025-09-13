const TOKEN_KEY = 'authToken';

async function init() {
  const user = await checkAuth();
  if (!user || user.role !== 'admin') {
    window.location.href = '/login.html';
    return;
  }

  const token = localStorage.getItem(TOKEN_KEY);
  const fromInput = document.getElementById('from');
  const toInput = document.getElementById('to');

  const today = new Date().toISOString().slice(0, 10);
  const lastMonth = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  fromInput.value = lastMonth;
  toInput.value = today;

  const ctx = document.getElementById('salesChart').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Ventas',
        data: [],
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.1)',
        tension: 0.1
      }]
    },
    options: { responsive: true }
  });

  async function loadData() {
    const params = new URLSearchParams({ from: fromInput.value, to: toInput.value });
    const res = await fetch(`/api/admin/dashboard?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('stat-users').textContent = data.users;
      document.getElementById('stat-products').textContent = data.products;
      document.getElementById('stat-orders').textContent = data.orders;
      document.getElementById('stat-sales').textContent = `Q${Number(data.sales).toFixed(2)}`;

      chart.data.labels = data.ordersDaily.map(o => o.date);
      chart.data.datasets[0].data = data.ordersDaily.map(o => o.total_sales);
      chart.update();
    }
  }

  fromInput.addEventListener('change', loadData);
  toInput.addEventListener('change', loadData);

  await loadData();
}

document.addEventListener('DOMContentLoaded', init);
