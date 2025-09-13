// ============================================================================
// store.js — Carga de productos desde base de datos
// ============================================================================

// --------------------------------------------------------------------------
// Inicialización principal al cargar el DOM
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
  initStore();
});

// --------------------------------------------------------------------------
// Función principal de inicialización de la tienda
// --------------------------------------------------------------------------
function initStore() {
  loadProducts();   // Cargar productos desde la base de datos
  initProducts();   // Configura listeners para ver detalles de productos
  initSearch();     // Configura la barra de búsqueda
  initCart();       // Inicializar funcionalidad del carrito
}

// --------------------------------------------------------------------------
// Cargar productos desde la base de datos
// --------------------------------------------------------------------------
async function loadProducts() {
  const productsGrid = document.getElementById('products-grid');
  const statusContainer = document.getElementById('products-status');
  
  // Mostrar indicador de carga
  statusContainer.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <p>Cargando productos...</p>
    </div>
  `;
  
  try {
    // Obtener productos desde la API
    const products = await fetchProducts();
    
    // Limpiar el contenedor
    statusContainer.innerHTML = '';
    
    if (products.length === 0) {
      statusContainer.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-circle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
          <h3>No hay productos disponibles</h3>
          <p>Vuelve a intentarlo más tarde.</p>
        </div>
      `;
      return;
    }
    
    // Renderizar productos
    renderProducts(products);
    
  } catch (error) {
    console.error('Error al cargar productos:', error);
    statusContainer.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <h3>Error al cargar los productos</h3>
        <p>Intenta recargar la página.</p>
      </div>
    `;
  }
}

// --------------------------------------------------------------------------
// Función para obtener productos desde la API
// --------------------------------------------------------------------------
async function fetchProducts(term = '') {
  try {
    const url = term ? `/api/products?q=${encodeURIComponent(term)}` : '/api/products';
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`Error ${res.status}: ${res.statusText}`);
    }
    
    return await res.json();
  } catch (e) {
    console.error('Error fetching products:', e);
    throw new Error('No se pudieron cargar los productos. Verifica tu conexión.');
  }
}

// --------------------------------------------------------------------------
// Renderizar productos en el grid
// --------------------------------------------------------------------------
function renderProducts(products) {
  const productsGrid = document.getElementById('products-grid');
  productsGrid.innerHTML = ''; // Limpiar grid
  
  products.forEach(product => {
    const productCard = document.createElement('div');
    productCard.className = 'product-card';
    productCard.dataset.id = `producto-${product.id}`;
    productCard.dataset.category = product.category_id;
    productCard.dataset.price = product.price;
    
    // Determinar si hay precio original (para mostrar descuento)
    const hasOriginalPrice = product.original_price && product.original_price > product.price;
    
    productCard.innerHTML = `
      <div class="product-image">
        <img src="${product.image_url || 'https://placehold.co/300x200/cccccc/FFFFFF?text=Imagen+No+Disponible'}" alt="${product.name}">
        ${product.badge ? `<span class="product-badge ${product.badge.toLowerCase()}">${product.badge}</span>` : ''}
      </div>
      <div class="product-info">
        <h3>${product.name}</h3>
        <p class="product-desc">${product.description}</p>
        <div class="product-price">
          ${hasOriginalPrice ? `<span class="original-price">Q${product.original_price.toFixed(2)}</span>` : ''}
          <span class="${hasOriginalPrice ? 'sale-price' : ''}">Q${product.price.toFixed(2)}</span>
        </div>
        <div class="product-actions">
          <button class="card-btn outline" title="Ver detalles">
            <i class="fas fa-eye"></i>
          </button>
          <button class="card-btn" title="Añadir al carrito">
            <i class="fas fa-shopping-cart"></i>
          </button>
        </div>
      </div>
    `;
    
    productsGrid.appendChild(productCard);
  });
}

// --------------------------------------------------------------------------
// Inicialización de productos: solo ver detalles (sin carrito)
// --------------------------------------------------------------------------
function initProducts() {
  // Usamos delegación de eventos para manejar productos dinámicos
  document.addEventListener('click', function(e) {
    // Manejar clic en botón de ver detalles
    if (e.target.closest('.card-btn.outline')) {
      const productCard = e.target.closest('.product-card');
      const productNameEl = productCard ? productCard.querySelector('h3') : null;
      const productName = productNameEl ? productNameEl.textContent : '';
      viewProductDetails(productName);
    }
    
    // Manejar clic en botón de añadir al carrito
    if (e.target.closest('.card-btn:not(.outline)')) {
      const productCard = e.target.closest('.product-card');
      const productId = productCard ? productCard.dataset.id : '';
      const productNameEl = productCard ? productCard.querySelector('h3') : null;
      const productName = productNameEl ? productNameEl.textContent : '';
      const productPriceEl = productCard ? productCard.querySelector('.product-price span:last-child') : null;
      let productPrice = 0;
      if (productPriceEl) {
        productPrice = parseFloat(productPriceEl.textContent.replace('Q', '').trim());
      }
      const productImageEl = productCard ? productCard.querySelector('img') : null;
      const productImage = productImageEl ? productImageEl.src : '';
      
      const product = {
        id: productId,
        name: productName,
        price: productPrice,
        image: productImage
      };
      
      // Usar la función global addToCart desde cart.js
      if (typeof window.addToCart === 'function') {
        window.addToCart(product);
      } else {
        // Fallback si la función no está disponible
        console.error('La función addToCart no está disponible');
        alert(`Añadiendo al carrito: ${product.name}\nPrecio: Q${product.price.toFixed(2)}`);
      }
    }
  });
}

// --------------------------------------------------------------------------
// Inicialización del carrito
// --------------------------------------------------------------------------
function initCart() {
  // Verificar si la función global addToCart está disponible
  if (typeof window.addToCart !== 'function') {
    console.warn('La función addToCart no está disponible. El carrito podría no funcionar correctamente.');
  }
  
  // Actualizar contador de carrito al cargar la página
  updateCartCount();
}

// --------------------------------------------------------------------------
// Actualizar contador de carrito
// --------------------------------------------------------------------------
function updateCartCount() {
  if (typeof window.getCartItemCount === 'function') {
    const count = window.getCartItemCount();
    const cartCountElements = document.querySelectorAll('.cart-count');
    cartCountElements.forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  }
}

// --------------------------------------------------------------------------
// Mostrar detalles del producto (simulación con alerta)
// --------------------------------------------------------------------------
function viewProductDetails(productName) {
  alert(`Ver detalles de: ${productName}\n\nEsta funcionalidad mostrará una vista detallada del producto.`);
}

// --------------------------------------------------------------------------
// Inicialización de la barra de búsqueda
// --------------------------------------------------------------------------
function initSearch() {
  const searchInput = document.getElementById('store-search-input');
  const searchButton = document.querySelector('.store-search-form button');

  if (searchInput && searchButton) {  
    searchButton.addEventListener('click', function() {  
      performSearch(searchInput.value);  
    });  

    searchInput.addEventListener('keypress', function(e) {  
      if (e.key === 'Enter') performSearch(this.value);  
    });  
  }  
}

// --------------------------------------------------------------------------
// Ejecuta la búsqueda de productos según el término ingresado
// --------------------------------------------------------------------------
async function performSearch(searchTerm) {
  const statusContainer = document.getElementById('products-status');
  
  if (!searchTerm || !searchTerm.trim()) {
    // Si no hay término de búsqueda, recargar todos los productos
    loadProducts();
    return;  
  }  
  
  // Mostrar indicador de carga durante la búsqueda
  statusContainer.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <p>Buscando productos...</p>
    </div>
  `;
  
  try {
    const products = await fetchProducts(searchTerm);
    
    // Limpiar el contenedor
    statusContainer.innerHTML = '';
    
    if (products.length === 0) {
      showNoResultsMessage(true, searchTerm);
    } else {
      const noResultsMessage = document.getElementById('no-results-message');  
      if (noResultsMessage) noResultsMessage.remove();
    }
    
    // Renderizar resultados de búsqueda
    renderProducts(products);
    
  } catch (error) {
    console.error('Error en búsqueda:', error);
    statusContainer.innerHTML = `
      <div class="error-message">
        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <h3>Error en la búsqueda</h3>
        <p>Intenta nuevamente.</p>
      </div>
    `;
  }
}

// --------------------------------------------------------------------------
// Muestra un mensaje cuando no se encuentran resultados
// --------------------------------------------------------------------------
function showNoResultsMessage(noResults, searchTerm) {
  const existing = document.getElementById('no-results-message');
  if (existing) existing.remove();

  if (!noResults) return;  

  const message = document.createElement('div');  
  message.id = 'no-results-message';  
  message.style.textAlign = 'center';  
  message.style.padding = '2rem';  
  message.style.color = 'var(--color-text-muted)';  
  message.innerHTML = `  
    <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem;"></i>  
    <h3>No encontramos resultados para "${searchTerm}"</h3>  
    <p>Intenta con otros términos de búsqueda.</p>  
  `;  

  const storeHeader = document.querySelector('.store-header');  
  if (storeHeader) storeHeader.insertAdjacentElement('afterend', message);  
  else document.body.appendChild(message);  
}