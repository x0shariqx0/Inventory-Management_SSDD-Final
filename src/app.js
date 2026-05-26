const form = document.getElementById('product-form');
const productsContainer = document.getElementById('products');
const message = document.getElementById('message');
const refreshBtn = document.getElementById('refresh-btn');
const healthDot = document.getElementById('health-dot');
const appStatus = document.getElementById('app-status');
const dbStatus = document.getElementById('db-status');

async function checkHealth() {
  try {
    const response = await fetch('/health');
    const data = await response.json();
    appStatus.textContent = `${data.app} is ${data.status}`;
    dbStatus.textContent = `MongoDB: ${data.database}`;
    healthDot.className = data.database === 'connected' ? 'dot ok' : 'dot bad';
  } catch (error) {
    appStatus.textContent = 'Application unavailable';
    dbStatus.textContent = error.message;
    healthDot.className = 'dot bad';
  }
}

async function loadProducts() {
  productsContainer.innerHTML = '<div class="empty">Loading products...</div>';

  try {
    const response = await fetch('/api/products');
    const products = await response.json();

    if (!Array.isArray(products) || products.length === 0) {
      productsContainer.innerHTML = '<div class="empty">No products added yet.</div>';
      return;
    }

    productsContainer.innerHTML = products.map(product => `
      <article class="product">
        <div>
          <h3>${escapeHtml(product.name)}</h3>
          <p>Category: ${escapeHtml(product.category)}</p>
          <p>Quantity: ${product.quantity} | Price: Rs. ${product.price}</p>
        </div>
        <button class="delete" onclick="deleteProduct('${product._id}')">Delete</button>
      </article>
    `).join('');
  } catch (error) {
    productsContainer.innerHTML = `<div class="empty">Error: ${error.message}</div>`;
  }
}

async function deleteProduct(id) {
  try {
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    await loadProducts();
    await checkHealth();
  } catch (error) {
    message.textContent = error.message;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  message.textContent = 'Saving product...';

  const payload = {
    name: document.getElementById('name').value,
    category: document.getElementById('category').value,
    quantity: Number(document.getElementById('quantity').value),
    price: Number(document.getElementById('price').value)
  };

  try {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Unable to save product');
    }

    form.reset();
    message.textContent = 'Product saved successfully.';
    await loadProducts();
    await checkHealth();
  } catch (error) {
    message.textContent = error.message;
  }
});

refreshBtn.addEventListener('click', loadProducts);

checkHealth();
loadProducts();
setInterval(checkHealth, 10000);
