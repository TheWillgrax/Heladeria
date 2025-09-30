// ============================================================================
// dashboard.js - Heladería Victoria
// ============================================================================

const TOKEN_KEY = 'authToken';
let salesTrendChart, financeChart, categoryChart;

async function init() {
  const user = await checkAuth();
  if (!user || user.role !== 'admin') {
    window.location.href = '/login.html';
    return;
  }

  const token = localStorage.getItem(TOKEN_KEY);
  
  // Configurar fechas por defecto
  const fromInput = document.getElementById('from');
  const toInput = document.getElementById('to');
  const today = new Date().toISOString().slice(0, 10);
  const lastMonth = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  fromInput.value = lastMonth;
  toInput.value = today;

  // Inicializar gráficos
  initCharts();

  // Cargar datos iniciales
  await loadData();

  // Event listeners
  fromInput.addEventListener('change', loadData);
  toInput.addEventListener('change', loadData);
}

function initCharts() {
  const dailyCtx = document.getElementById('salesChart').getContext('2d');
  const financeCtx = document.getElementById('financeChart').getContext('2d');
  const categoryCtx = document.getElementById('categoryChart').getContext('2d');

  salesTrendChart = new Chart(dailyCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Ventas diarias',
        data: [],
        backgroundColor: 'rgba(37,99,235,0.15)',
        borderColor: '#2563eb',
        tension: 0.2,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#2563eb'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  financeChart = new Chart(financeCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Ventas',
          data: [],
          backgroundColor: 'rgba(37, 99, 235, 0.7)'
        },
        {
          label: 'Gastos',
          data: [],
          backgroundColor: 'rgba(245, 158, 11, 0.7)'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  const palette = ['#ff6b8b', '#42b89e', '#2563eb', '#f59e0b', '#a855f7', '#ec4899', '#34d399'];
  categoryChart = new Chart(categoryCtx, {
    type: 'doughnut',
    data: {
      labels: [],
      datasets: [{
        data: [],
        backgroundColor: palette,
        borderWidth: 1,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

async function loadData() {
  const token = localStorage.getItem(TOKEN_KEY);
  const fromInput = document.getElementById('from');
  const toInput = document.getElementById('to');
  
  const params = new URLSearchParams({ 
    from: fromInput.value, 
    to: toInput.value 
  });

  try {
    const res = await fetch(`/api/admin/dashboard?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      throw new Error('Error al cargar datos');
    }

    const data = await res.json();

    // Formateadores
    const currencyFormatter = new Intl.NumberFormat('es-GT', { 
      style: 'currency', 
      currency: 'GTQ' 
    });
    const dailyFormatter = new Intl.DateTimeFormat('es', { 
      day: '2-digit', 
      month: 'short' 
    });
    const monthFormatter = new Intl.DateTimeFormat('es', { 
      month: 'short', 
      year: 'numeric' 
    });

    const formatCurrency = value => currencyFormatter.format(Number(value || 0));
    const formatDailyLabel = date => {
      const parsed = new Date(date);
      return Number.isNaN(parsed.getTime()) ? date : dailyFormatter.format(parsed);
    };
    const formatMonthLabel = ym => {
      const [year, month] = ym.split('-');
      const parsed = new Date(Number(year), Number(month) - 1, 1);
      return Number.isNaN(parsed.getTime()) ? ym : monthFormatter.format(parsed);
    };

    // Actualizar stats
    document.getElementById('stat-users').textContent = data.users;
    document.getElementById('stat-products').textContent = data.products;
    document.getElementById('stat-orders').textContent = data.orders;
    document.getElementById('stat-sales').textContent = formatCurrency(data.sales);
    document.getElementById('stat-expenses').textContent = formatCurrency(data.expenses);
    document.getElementById('stat-net-income').textContent = formatCurrency(data.netIncome);
    document.getElementById('stat-avg-ticket').textContent = formatCurrency(data.avgTicket);

    // Actualizar gráfico de ventas diarias
    const dailyData = Array.isArray(data.ordersDaily) ? data.ordersDaily : [];
    salesTrendChart.data.labels = dailyData.map(o => formatDailyLabel(o.date));
    salesTrendChart.data.datasets[0].data = dailyData.map(o => Number(o.total_sales || 0));
    salesTrendChart.update();

    // Actualizar gráfico financiero
    const monthlyData = Array.isArray(data.monthlyFinancial) ? data.monthlyFinancial : [];
    financeChart.data.labels = monthlyData.map(item => formatMonthLabel(item.month));
    financeChart.data.datasets[0].data = monthlyData.map(item => Number(item.sales || 0));
    financeChart.data.datasets[1].data = monthlyData.map(item => Number(item.expenses || 0));
    financeChart.update();

    // Actualizar gráfico de categorías
    const categories = data.salesByCategory || [];
    if (categories.length > 0) {
      categoryChart.data.labels = categories.map(item => item.category);
      categoryChart.data.datasets[0].data = categories.map(item => Number(item.revenue || 0));
    } else {
      categoryChart.data.labels = [];
      categoryChart.data.datasets[0].data = [];
    }
    categoryChart.update();

    // Actualizar tabla de top productos
    const topProductsBody = document.getElementById('topProductsBody');
    topProductsBody.innerHTML = '';
    if (data.topProducts && data.topProducts.length > 0) {
      data.topProducts.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${product.product_name}</td>
          <td>${product.units_sold}</td>
          <td>${formatCurrency(product.revenue)}</td>
        `;
        topProductsBody.appendChild(row);
      });
    } else {
      topProductsBody.innerHTML = '<tr><td colspan="3" class="muted">Sin datos en el periodo seleccionado</td></tr>';
    }

    // Actualizar tabla de resumen mensual
    const monthlySummaryBody = document.getElementById('monthlySummaryBody');
    monthlySummaryBody.innerHTML = '';
    if (monthlyData.length > 0) {
      monthlyData.forEach(item => {
        const util = Number(item.sales || 0) - Number(item.expenses || 0);
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${formatMonthLabel(item.month)}</td>
          <td>${formatCurrency(item.sales)}</td>
          <td>${formatCurrency(item.expenses)}</td>
          <td>${formatCurrency(util)}</td>
          <td>${item.orders}</td>
        `;
        monthlySummaryBody.appendChild(row);
      });
    } else {
      monthlySummaryBody.innerHTML = '<tr><td colspan="5" class="muted">Seleccione un rango de fechas para generar el reporte</td></tr>';
    }

    console.log('Dashboard cargado correctamente');

  } catch (error) {
    console.error('Error al cargar dashboard:', error);
    alert('Error al cargar los datos del dashboard. Por favor, intente nuevamente.');
  }
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);