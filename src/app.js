const form = document.getElementById('product-form');
const productsContainer = document.getElementById('products');
const message = document.getElementById('message');
const refreshBtn = document.getElementById('refresh-btn');
const healthDot = document.getElementById('health-dot');
const appStatus = document.getElementById('app-status');
const dbStatus = document.getElementById('db-status');

// Auth & Admin UI Elements
const loginAdminBtn = document.getElementById('login-admin-btn');
const loginStaffBtn = document.getElementById('login-staff-btn');
const logoutBtn = document.getElementById('logout-btn');
const authStatus = document.getElementById('auth-status');
const adminPanel = document.getElementById('admin-panel');
const viewLogsBtn = document.getElementById('view-logs-btn');
const viewAlertsBtn = document.getElementById('view-alerts-btn');
const logsDisplay = document.getElementById('logs-display');

// Helper to parse JWT payload
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Fetch helper with auth header injection
async function authenticatedFetch(url, options = {}) {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  return fetch(url, options);
}

// Update Auth UI state
function updateAuthState() {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    const payload = parseJwt(token);
    if (payload) {
      loginAdminBtn.style.display = 'none';
      loginStaffBtn.style.display = 'none';
      logoutBtn.style.display = 'inline-block';
      authStatus.textContent = `Logged in as: ${payload.username} (${payload.role})`;
      authStatus.className = `auth-status ${payload.role}`;

      if (payload.role === 'admin') {
        adminPanel.style.display = 'block';
      } else {
        adminPanel.style.display = 'none';
      }
      return;
    }
  }

  // Not logged in or invalid token
  loginAdminBtn.style.display = 'inline-block';
  loginStaffBtn.style.display = 'inline-block';
  logoutBtn.style.display = 'none';
  authStatus.textContent = 'Not logged in (Requests will fail with 401)';
  authStatus.className = 'auth-status';
  adminPanel.style.display = 'none';
  logsDisplay.style.display = 'none';
}

// Login Actions
async function login(username, password) {
  message.textContent = `Logging in as ${username}...`;
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    localStorage.setItem('jwt_token', data.token);
    message.textContent = 'Login successful!';
    updateAuthState();
    await loadProducts();
    await checkHealth();
  } catch (error) {
    message.textContent = `Login Error: ${error.message}`;
  }
}

// Logout Action
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('jwt_token');
  message.textContent = 'Logged out successfully.';
  updateAuthState();
  loadProducts();
});

loginAdminBtn.addEventListener('click', () => login('admin', 'adminpassword'));
loginStaffBtn.addEventListener('click', () => login('staff', 'staffpassword'));

// Logs & Alerts fetching
viewLogsBtn.addEventListener('click', async () => {
  logsDisplay.style.display = 'block';
  logsDisplay.textContent = 'Fetching audit logs...';
  try {
    const response = await authenticatedFetch('/api/audit-logs');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch');

    if (data.length === 0) {
      logsDisplay.textContent = 'No audit logs found.';
      return;
    }

    logsDisplay.textContent = data.map(log => 
      `[${new Date(log.createdAt).toLocaleString()}] IP:${log.ipAddress} | User:${log.username} | Action:${log.action} | Resource:${log.resource}\nDetails: ${log.details}\n`
    ).join('\n');
  } catch (error) {
    logsDisplay.textContent = `Error: ${error.message}`;
  }
});

viewAlertsBtn.addEventListener('click', async () => {
  logsDisplay.style.display = 'block';
  logsDisplay.textContent = 'Fetching security alerts...';
  try {
    const response = await authenticatedFetch('/api/security-alerts');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch');

    if (data.length === 0) {
      logsDisplay.textContent = 'No security alerts found.';
      return;
    }

    logsDisplay.textContent = data.map(alert => 
      `[${new Date(alert.createdAt).toLocaleString()}] ALERT TYPE:${alert.type} | SEVERITY:${alert.severity.toUpperCase()}\nMessage: ${alert.message}\nMetadata: ${JSON.stringify(alert.metadata)}\n`
    ).join('\n');
  } catch (error) {
    logsDisplay.textContent = `Error: ${error.message}`;
  }
});

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
    const response = await authenticatedFetch('/api/products');
    const products = await response.json();

    if (!response.ok) {
      throw new Error(products.message || 'Unable to load products');
    }

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
    productsContainer.innerHTML = `<div class="empty">Error loading products: ${error.message}</div>`;
  }
}

async function deleteProduct(id) {
  try {
    const response = await authenticatedFetch(`/api/products/${id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete');
    }
    message.textContent = 'Product deleted successfully.';
    await loadProducts();
    await checkHealth();
  } catch (error) {
    message.textContent = `Error deleting product: ${error.message}`;
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
    const response = await authenticatedFetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      // Check for validation errors array
      if (data.errors && Array.isArray(data.errors)) {
        const errorMsgs = data.errors.map(err => `${err.field}: ${err.message}`).join(', ');
        throw new Error(errorMsgs);
      }
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

// Initialize application state
updateAuthState();
checkHealth();
loadProducts();
setInterval(checkHealth, 10000);
