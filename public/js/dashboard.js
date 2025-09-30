  // ============================================================================
  // dashboard.js - Heladería Victoria
  // ============================================================================

  const TOKEN_KEY = 'authToken';
  const EXPORT_ENDPOINT = '/api/admin/dashboard/export';

  let salesTrendChart, financeChart, categoryChart;
  let panelElement;
  let fromInput;
  let toInput;
  let quickRangeSelect;
  let refreshButton;
  let exportCsvButton;
  let exportJsonButton;

  const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  function applyQuickRange(preset = '30') {
    if (!fromInput || !toInput || preset === 'custom') {
      return;
    }

    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    switch (preset) {
      case '7':
        start.setDate(end.getDate() - 6);
        break;
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now);
        break;
      case '30':
      default:
        start.setDate(end.getDate() - 29);
        break;
    }

    fromInput.value = formatDateForInput(start);
    toInput.value = formatDateForInput(end);

    if (quickRangeSelect && preset !== 'custom') {
      quickRangeSelect.value = preset;
    }
  }

  function setButtonLoading(button, isLoading) {
    if (!button) return;

    if (!button.dataset.defaultHtml) {
      button.dataset.defaultHtml = button.innerHTML;
    }

    if (isLoading) {
      const loadingText = button.dataset.loadingText || 'Procesando…';
      button.disabled = true;
      button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.defaultHtml;
    }
  }

  async function init() {
    const user = await checkAuth();
    if (!user || user.role !== 'admin') {
      window.location.href = '/login.html';
      return;
    }

  panelElement = document.querySelector('.panel');
    fromInput = document.getElementById('from');
    toInput = document.getElementById('to');
    quickRangeSelect = document.getElementById('quickRange');
    refreshButton = document.getElementById('refreshDashboard');
    exportCsvButton = document.getElementById('exportCsv');
    exportJsonButton = document.getElementById('exportJson');

    const initialPreset = quickRangeSelect && quickRangeSelect.value !== 'custom'
      ? quickRangeSelect.value
      : '30';
    applyQuickRange(initialPreset);


    // Cargar datos iniciales
    initCharts();
    await loadData();

    // Event listeners
    fromInput?.addEventListener('change', () => {
      if (quickRangeSelect) quickRangeSelect.value = 'custom';
      loadData();
    });

    toInput?.addEventListener('change', () => {
      if (quickRangeSelect) quickRangeSelect.value = 'custom';
      loadData();
      const exportButton = document.getElementById('exportReportBtn');
  if (exportButton) {
    exportButton.addEventListener('click', handleExportReport);
  }
    });

    quickRangeSelect?.addEventListener('change', () => {
      const preset = quickRangeSelect.value;
      if (preset === 'custom') {
        return;
      }
      applyQuickRange(preset);
      loadData();
    });

    refreshButton?.addEventListener('click', () => loadData(refreshButton));
    exportCsvButton?.addEventListener('click', () => downloadReport('csv', exportCsvButton));
    exportJsonButton?.addEventListener('click', () => downloadReport('json', exportJsonButton));
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

  async function loadData(triggerButton) {
    const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
      window.location.href = '/login.html';
      return;
    } 

    if (!fromInput || !toInput) {
      return;
    }

    const fromValue = fromInput.value;
    const toValue = toInput.value;

    if (!fromValue || !toValue) {
      alert('Seleccione un rango de fechas para consultar.');
      return;
    }

    const fromDateObj = new Date(fromValue);
    const toDateObj = new Date(toValue);

    if (Number.isNaN(fromDateObj.getTime()) || Number.isNaN(toDateObj.getTime())) {
      alert('Seleccione fechas válidas.');
      return;
    }

    if (fromDateObj > toDateObj) {
      alert('La fecha inicial no puede ser mayor a la final.');
      return;
    }

    const params = new URLSearchParams({ from: fromValue, to: toValue });



    
    try {
      panelElement?.setAttribute('aria-busy', 'true');
      setButtonLoading(triggerButton, true);
      const res = await fetch(`/api/admin/dashboard?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });

      if (!res.ok) {
        throw new Error('Error al cargar datos');
      }

      const data = await res.json();

      // Formateadores
      const numberFormatter = new Intl.NumberFormat('es-GT');
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


      const formatNumber = value => numberFormatter.format(Number(value || 0));
      const formatCurrency = value => currencyFormatter.format(Number(value || 0));
      const formatDailyLabel = date => {
        const parsed = new Date(date);
        return Number.isNaN(parsed.getTime()) ? date : dailyFormatter.format(parsed);
      };
      const formatMonthLabel = ym => {
        if (!ym) return '';
        const [year, month] = ym.split('-').map(Number);
        const parsed = new Date(year, month - 1, 1);
        return Number.isNaN(parsed.getTime()) ? ym : monthFormatter.format(parsed);
      };


      const dailyData = Array.isArray(data.ordersDaily) ? data.ordersDaily : [];
      const monthlyData = Array.isArray(data.monthlyFinancial) ? data.monthlyFinancial : [];
      const categories = Array.isArray(data.salesByCategory) ? data.salesByCategory : [];
      const topProducts = Array.isArray(data.topProducts) ? data.topProducts : [];

      const statUsers = document.getElementById('stat-users');
      const statProducts = document.getElementById('stat-products');
      const statOrders = document.getElementById('stat-orders');
      const statSales = document.getElementById('stat-sales');
      const statExpenses = document.getElementById('stat-expenses');
      const statNetIncome = document.getElementById('stat-net-income');
      const statAvgTicket = document.getElementById('stat-avg-ticket');

      if (statUsers) statUsers.textContent = formatNumber(data.users);
      if (statProducts) statProducts.textContent = formatNumber(data.products);
      if (statOrders) statOrders.textContent = formatNumber(data.orders);
      if (statSales) statSales.textContent = formatCurrency(data.sales);
      if (statExpenses) statExpenses.textContent = formatCurrency(data.expenses);
      if (statNetIncome) statNetIncome.textContent = formatCurrency(data.netIncome);
      if (statAvgTicket) statAvgTicket.textContent = formatCurrency(data.avgTicket);
      salesTrendChart.data.labels = dailyData.map(o => formatDailyLabel(o.date));

      salesTrendChart.data.datasets[0].data = dailyData.map(o => Number(o.total_sales || 0));
      salesTrendChart.update();

    
      financeChart.data.labels = monthlyData.map(item => formatMonthLabel(item.month));
      financeChart.data.datasets[0].data = monthlyData.map(item => Number(item.sales || 0));
      financeChart.data.datasets[1].data = monthlyData.map(item => Number(item.expenses || 0));
      financeChart.update();


      if (categories.length > 0) {
        categoryChart.data.labels = categories.map(item => item.category);
        categoryChart.data.datasets[0].data = categories.map(item => Number(item.revenue || 0));
      } else {
        categoryChart.data.labels = [];
        categoryChart.data.datasets[0].data = [];
      }
      categoryChart.update();

    
      const topProductsBody = document.getElementById('topProductsBody');
    if (topProductsBody) {
        topProductsBody.innerHTML = '';
        if (topProducts.length > 0) {
          topProducts.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
              <td>${product.product_name}</td>
              <td>${formatNumber(product.units_sold)}</td>
              <td>${formatCurrency(product.revenue)}</td>
            `;
            topProductsBody.appendChild(row);
          });
        } else {
          topProductsBody.innerHTML = '<tr><td colspan="3" class="muted">Sin datos en el periodo seleccionado</td></tr>';
        }
      }
      

    
      const monthlySummaryBody = document.getElementById('monthlySummaryBody');
      if (monthlySummaryBody) {
        monthlySummaryBody.innerHTML = '';
        if (monthlyData.length > 0) {
          monthlyData.forEach(item => {
            const utilidad = Number(item.sales || 0) - Number(item.expenses || 0);
            const row = document.createElement('tr');
            row.innerHTML = `
              <td>${formatMonthLabel(item.month)}</td>
              <td>${formatCurrency(item.sales)}</td>
              <td>${formatCurrency(item.expenses)}</td>
              <td>${formatCurrency(utilidad)}</td>
              <td>${formatNumber(item.orders)}</td>
            `;
            monthlySummaryBody.appendChild(row);
          });
        } else {
          monthlySummaryBody.innerHTML = '<tr><td colspan="5" class="muted">Seleccione un rango de fechas para generar el reporte</td></tr>';
        }
      }

      console.log('Dashboard cargado correctamente');

    } catch (error) {
      console.error('Error al cargar dashboard:', error);
      alert('Error al cargar los datos del dashboard. Por favor, intente nuevamente.');
    } finally {
      panelElement?.setAttribute('aria-busy', 'false');
      setButtonLoading(triggerButton, false);
    }
}
async function handleExportReport(event) {
  const button = event.currentTarget;
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    alert('No se encontró una sesión activa. Por favor, inicie sesión nuevamente.');
    return;
  }

  const fromInput = document.getElementById('from');
  const toInput = document.getElementById('to');

  const params = new URLSearchParams({
    from: fromInput?.value || '',
    to: toInput?.value || ''
  });

  const originalContent = button.innerHTML;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> <span>Generando...</span>';

  try {
    const response = await fetch(`${EXPORT_ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error('No se pudo exportar la reportería');
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition');

    const sanitize = value => (value || 'periodo').replace(/[^0-9A-Za-z-]+/g, '-');
    const fallbackName = `reporte-dashboard-${sanitize(fromInput?.value || 'inicio')}-al-${sanitize(
      toInput?.value || 'fin'
    )}.csv`;

    let filename = fallbackName;
    if (disposition) {
      const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
      if (match) {
        const encodedName = match[1] || match[2];
        try {
          filename = decodeURIComponent(encodedName);
        } catch (error) {
          filename = encodedName;
        }
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error al exportar reportería:', error);
    alert('No fue posible descargar la reportería. Intente nuevamente.');
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.innerHTML = originalContent;
  }
}

  async function downloadReport(format, button) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      window.location.href = '/login.html';
      return;
    }

    if (!fromInput || !toInput) {
      return;
    }

    const fromValue = fromInput.value;
    const toValue = toInput.value;

    if (!fromValue || !toValue) {
      alert('Seleccione un rango de fechas antes de exportar.');
      return;
    }

    const fromDateObj = new Date(fromValue);
    const toDateObj = new Date(toValue);

    if (Number.isNaN(fromDateObj.getTime()) || Number.isNaN(toDateObj.getTime())) {
      alert('Seleccione fechas válidas antes de exportar.');
      return;
    }

    if (fromDateObj > toDateObj) {
      alert('La fecha inicial no puede ser mayor a la final.');
      return;
    }

    try {
      setButtonLoading(button, true);

      const params = new URLSearchParams({
        from: fromValue,
        to: toValue,
        format
      });

      const res = await fetch(`/api/admin/dashboard/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });

      if (!res.ok) {
        throw new Error('No se pudo generar el reporte');
      }

      const blob = await res.blob();
      const extension = format === 'json' ? 'json' : 'csv';
      const filename = `dashboard-${fromValue}-al-${toValue}.${extension}`;
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al descargar reporte:', error);
      alert('No se pudo descargar el reporte. Inténtelo nuevamente.');
    } finally {
      setButtonLoading(button, false);
    }
  }
// ============================================================================
// EXPORTADOR AVANZADO DE DASHBOARD A EXCEL CON MÚLTIPLES HOJAS
// Incluye: Resumen, Estadísticas, Ventas Diarias, Top Productos, etc.
// ============================================================================

// Requiere la librería SheetJS (xlsx)
// <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>

/**
 * Función principal para exportar todo el dashboard a Excel
 */
async function exportDashboardToExcel() {
  try {
    // Crear un nuevo libro de Excel
    const workbook = XLSX.utils.book_new();
    
    // Obtener datos del dashboard
    const dashboardData = collectDashboardData();
    
    // 1. HOJA: Resumen Ejecutivo
    createExecutiveSummarySheet(workbook, dashboardData);
    
    // 2. HOJA: Estadísticas Generales
    createStatsSheet(workbook, dashboardData);
    
    // 3. HOJA: Ventas Diarias
    createDailySalesSheet(workbook, dashboardData);
    
    // 4. HOJA: Comparativo Financiero (Ventas vs Gastos)
    createFinancialComparisonSheet(workbook, dashboardData);
    
    // 5. HOJA: Ventas por Categoría
    createCategorySheet(workbook, dashboardData);
    
    // 6. HOJA: Top Productos
    createTopProductsSheet(workbook, dashboardData);
    
    // 7. HOJA: Resumen Mensual
    createMonthlySummarySheet(workbook, dashboardData);
    
    // Generar el archivo
    const fileName = `Dashboard_Heladeria_Victoria_${getCurrentDateFormatted()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    // Notificar éxito
    showNotification('✅ Excel generado correctamente', 'success');
    
  } catch (error) {
    console.error('Error al exportar dashboard:', error);
    showNotification('❌ Error al generar el Excel', 'error');
  }
}

/**
 * Recolectar todos los datos del dashboard
 */
function collectDashboardData() {
  return {
    // Filtros aplicados
    filters: {
      from: document.getElementById('from')?.value || '',
      to: document.getElementById('to')?.value || '',
      range: document.getElementById('quickRange')?.selectedOptions[0]?.text || ''
    },
    
    // Estadísticas principales
    stats: {
      users: document.getElementById('stat-users')?.textContent || '0',
      products: document.getElementById('stat-products')?.textContent || '0',
      orders: document.getElementById('stat-orders')?.textContent || '0',
      sales: document.getElementById('stat-sales')?.textContent || 'Q0.00',
      expenses: document.getElementById('stat-expenses')?.textContent || 'Q0.00',
      netIncome: document.getElementById('stat-net-income')?.textContent || 'Q0.00',
      avgTicket: document.getElementById('stat-avg-ticket')?.textContent || 'Q0.00'
    },
    
    // Datos de gráficos (si existen variables globales)
    charts: {
      dailySales: window.salesChartData || [],
      financial: window.financeChartData || [],
      categories: window.categoryChartData || []
    },
    
    // Tablas
    tables: {
      topProducts: extractTableData('topProductsBody'),
      monthlySummary: extractTableData('monthlySummaryBody')
    }
  };
}

/**
 * 1. HOJA: Resumen Ejecutivo
 */
function createExecutiveSummarySheet(workbook, data) {
  const ws_data = [
    ['HELADERÍA VICTORIA - DASHBOARD EJECUTIVO'],
    [''],
    ['Fecha de generación:', new Date().toLocaleString('es-GT')],
    ['Período analizado:', `${data.filters.from || 'N/A'} - ${data.filters.to || 'N/A'}`],
    ['Rango seleccionado:', data.filters.range],
    [''],
    ['═══════════════════════════════════════════════════════'],
    ['INDICADORES CLAVE DE DESEMPEÑO (KPIs)'],
    ['═══════════════════════════════════════════════════════'],
    [''],
    ['📊 Métrica', 'Valor'],
    ['Usuarios Activos', data.stats.users],
    ['Productos Publicados', data.stats.products],
    ['Pedidos Procesados', data.stats.orders],
    ['Ventas Totales', data.stats.sales],
    ['Gastos Operativos', data.stats.expenses],
    ['Utilidad Neta', data.stats.netIncome],
    ['Ticket Promedio', data.stats.avgTicket],
    [''],
    ['═══════════════════════════════════════════════════════'],
    ['ANÁLISIS FINANCIERO'],
    ['═══════════════════════════════════════════════════════'],
    [''],
    ['Concepto', 'Monto'],
    ['Ingresos Brutos', data.stats.sales],
    ['(-) Gastos', data.stats.expenses],
    ['Utilidad Neta', data.stats.netIncome],
    [''],
    ['Margen de Utilidad:', calculateMargin(data.stats.sales, data.stats.netIncome)]
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  
  // Aplicar estilos (ancho de columnas)
  ws['!cols'] = [
    { wch: 30 },
    { wch: 20 }
  ];
  
  // Agregar la hoja
  XLSX.utils.book_append_sheet(workbook, ws, '📊 Resumen Ejecutivo');
}

/**
 * 2. HOJA: Estadísticas Generales
 */
function createStatsSheet(workbook, data) {
  const ws_data = [
    ['ESTADÍSTICAS GENERALES'],
    [''],
    ['Categoría', 'Métrica', 'Valor', 'Descripción'],
    ['Usuarios', 'Total Activos', data.stats.users, 'Cuentas registradas en el sistema'],
    ['Productos', 'En Catálogo', data.stats.products, 'Artículos disponibles para venta'],
    ['Pedidos', 'Procesados', data.stats.orders, 'Órdenes completadas en el período'],
    ['Finanzas', 'Ventas Totales', data.stats.sales, 'Ingresos brutos confirmados'],
    ['Finanzas', 'Gastos', data.stats.expenses, 'Egresos operativos registrados'],
    ['Finanzas', 'Utilidad Neta', data.stats.netIncome, 'Diferencia entre ingresos y gastos'],
    ['Ventas', 'Ticket Promedio', data.stats.avgTicket, 'Valor promedio por pedido']
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 40 }];
  
  XLSX.utils.book_append_sheet(workbook, ws, '📈 Estadísticas');
}

/**
 * 3. HOJA: Ventas Diarias
 */
function createDailySalesSheet(workbook, data) {
  const ws_data = [
    ['VENTAS DIARIAS'],
    [''],
    ['Fecha', 'Monto', 'Pedidos', 'Ticket Promedio']
  ];
  
  // Si tienes datos del gráfico de ventas diarias
  if (data.charts.dailySales && data.charts.dailySales.length > 0) {
    data.charts.dailySales.forEach(item => {
      ws_data.push([
        item.date || item.label || '',
        item.amount || item.value || 0,
        item.orders || '',
        item.avgTicket || ''
      ]);
    });
  } else {
    ws_data.push(['Sin datos disponibles', '', '', '']);
  }
  
  // Agregar totales
  ws_data.push(['']);
  ws_data.push(['TOTAL', data.stats.sales, data.stats.orders, data.stats.avgTicket]);
  
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 18 }];
  
  XLSX.utils.book_append_sheet(workbook, ws, '📅 Ventas Diarias');
}

/**
 * 4. HOJA: Comparativo Financiero
 */
function createFinancialComparisonSheet(workbook, data) {
  const ws_data = [
    ['COMPARATIVO VENTAS VS GASTOS'],
    [''],
    ['Período', 'Ventas', 'Gastos', 'Utilidad', 'Margen %']
  ];
  
  // Si tienes datos del gráfico financiero
  if (data.charts.financial && data.charts.financial.length > 0) {
    data.charts.financial.forEach(item => {
      const sales = item.sales || 0;
      const expenses = item.expenses || 0;
      const profit = sales - expenses;
      const margin = sales > 0 ? ((profit / sales) * 100).toFixed(2) + '%' : '0%';
      
      ws_data.push([
        item.period || item.label || '',
        formatCurrency(sales),
        formatCurrency(expenses),
        formatCurrency(profit),
        margin
      ]);
    });
  } else {
    ws_data.push(['Sin datos disponibles', '', '', '', '']);
  }
  
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
  
  XLSX.utils.book_append_sheet(workbook, ws, '💰 Comparativo');
}

/**
 * 5. HOJA: Ventas por Categoría
 */
function createCategorySheet(workbook, data) {
  const ws_data = [
    ['VENTAS POR CATEGORÍA'],
    [''],
    ['Categoría', 'Monto', 'Porcentaje', 'Pedidos']
  ];
  
  if (data.charts.categories && data.charts.categories.length > 0) {
    const total = data.charts.categories.reduce((sum, cat) => sum + (cat.amount || 0), 0);
    
    data.charts.categories.forEach(cat => {
      const percentage = total > 0 ? ((cat.amount / total) * 100).toFixed(2) + '%' : '0%';
      ws_data.push([
        cat.name || cat.category || '',
        formatCurrency(cat.amount || 0),
        percentage,
        cat.count || cat.orders || ''
      ]);
    });
    
    // Total
    ws_data.push(['']);
    ws_data.push(['TOTAL', formatCurrency(total), '100%', '']);
  } else {
    ws_data.push(['Sin datos disponibles', '', '', '']);
  }
  
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
  
  XLSX.utils.book_append_sheet(workbook, ws, '🍦 Categorías');
}

/**
 * 6. HOJA: Top Productos
 */
function createTopProductsSheet(workbook, data) {
  const ws_data = [
    ['TOP PRODUCTOS MÁS VENDIDOS'],
    [''],
    ['Ranking', 'Producto', 'Unidades Vendidas', 'Ingresos Generados']
  ];
  
  if (data.tables.topProducts && data.tables.topProducts.length > 0) {
    data.tables.topProducts.forEach((product, index) => {
      ws_data.push([
        index + 1,
        product[0] || '',
        product[1] || '',
        product[2] || ''
      ]);
    });
  } else {
    ws_data.push(['', 'Sin datos disponibles', '', '']);
  }
  
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [{ wch: 10 }, { wch: 35 }, { wch: 18 }, { wch: 20 }];
  
  XLSX.utils.book_append_sheet(workbook, ws, '🏆 Top Productos');
}

/**
 * 7. HOJA: Resumen Mensual
 */
function createMonthlySummarySheet(workbook, data) {
  const ws_data = [
    ['RESUMEN MENSUAL'],
    [''],
    ['Mes', 'Ventas', 'Gastos', 'Utilidad', 'Pedidos', 'Margen %']
  ];
  
  if (data.tables.monthlySummary && data.tables.monthlySummary.length > 0) {
    data.tables.monthlySummary.forEach(row => {
      const sales = parseFloat(row[1]?.replace(/[Q,]/g, '') || 0);
      const expenses = parseFloat(row[2]?.replace(/[Q,]/g, '') || 0);
      const margin = sales > 0 ? (((sales - expenses) / sales) * 100).toFixed(2) + '%' : '0%';
      
      ws_data.push([
        row[0] || '',
        row[1] || '',
        row[2] || '',
        row[3] || '',
        row[4] || '',
        margin
      ]);
    });
  } else {
    ws_data.push(['Sin datos disponibles', '', '', '', '', '']);
  }
  
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
  
  XLSX.utils.book_append_sheet(workbook, ws, '📆 Resumen Mensual');
}

/**
 * FUNCIONES AUXILIARES
 */

// Extraer datos de una tabla HTML
function extractTableData(tableBodyId) {
  const tbody = document.getElementById(tableBodyId);
  if (!tbody) return [];
  
  const rows = [];
  const trs = tbody.querySelectorAll('tr');
  
  trs.forEach(tr => {
    const cells = tr.querySelectorAll('td');
    if (cells.length > 0 && !tr.textContent.includes('Sin datos')) {
      const rowData = Array.from(cells).map(cell => cell.textContent.trim());
      rows.push(rowData);
    }
  });
  
  return rows;
}

// Formatear moneda
function formatCurrency(value) {
  if (typeof value === 'string' && value.includes('Q')) {
    return value;
  }
  return `Q${parseFloat(value || 0).toFixed(2)}`;
}

// Calcular margen de utilidad
function calculateMargin(sales, netIncome) {
  const salesNum = parseFloat(sales.replace(/[Q,]/g, '') || 0);
  const incomeNum = parseFloat(netIncome.replace(/[Q,]/g, '') || 0);
  
  if (salesNum === 0) return '0%';
  return ((incomeNum / salesNum) * 100).toFixed(2) + '%';
}

// Obtener fecha formateada
function getCurrentDateFormatted() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}_${hours}-${minutes}`;
}

// Notificación visual
function showNotification(message, type) {
  // Implementa tu sistema de notificaciones
  // Ejemplo simple:
  alert(message);
  
  // O usa un toast moderno:
  // Toastify({ text: message, className: type }).showToast();
}

/**
 * INTEGRACIÓN CON TU BOTÓN
 * Agregar en dashboard.js:
 */

// Event listener para el botón de exportar
document.getElementById('exportCsv')?.addEventListener('click', exportDashboardToExcel);

// O crear un botón específico:
/*
<button type="button" id="exportExcel" class="action-btn">
  <i class="fas fa-file-excel"></i>
  Exportar Dashboard Completo
</button>
*/

// Luego en JS:
// document.getElementById('exportExcel')?.addEventListener('click', exportDashboardToExcel);

  // Iniciar cuando el DOM esté listo
  document.addEventListener('DOMContentLoaded', init);