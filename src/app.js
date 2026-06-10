const form = document.getElementById('product-form');
const productsContainer = document.getElementById('products');
const message = document.getElementById('message');
const refreshBtn = document.getElementById('refresh-btn');
const healthDot = document.getElementById('health-dot');
const appStatus = document.getElementById('app-status');
const dbStatus = document.getElementById('db-status');

// Auth & Panels
const logoutBtn = document.getElementById('logout-btn');
const authStatus = document.getElementById('auth-status');
const adminManagementSection = document.getElementById('admin-management-section');
const viewLogsBtn = document.getElementById('view-logs-btn');
const viewAlertsBtn = document.getElementById('view-alerts-btn');
const logsDisplay = document.getElementById('logs-display');

// Staff Registration Elements
const staffRegistrationForm = document.getElementById('staff-registration-form');
const regUsernameInput = document.getElementById('reg-username');
const regPasswordInput = document.getElementById('reg-password');
const regMessage = document.getElementById('registration-message');

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

// Enforce authentication check on load
function verifyAuthAndInitialize() {
  const token = localStorage.getItem('jwt_token');
  if (!token) {
    // Redirect to landing page if unauthenticated
    window.location.href = '/index.html';
    return;
  }

  const payload = parseJwt(token);
  if (!payload || (payload.exp && Date.now() >= payload.exp * 1000)) {
    // Expired or corrupt token
    localStorage.removeItem('jwt_token');
    window.location.href = '/index.html';
    return;
  }

  // Display user identity in dashboard header
  authStatus.textContent = `Active Session: ${payload.username} (${payload.role})`;
  authStatus.className = `auth-status ${payload.role}`;

  // Configure admin-only views
  if (payload.role === 'admin') {
    adminManagementSection.style.display = 'grid';
  } else {
    adminManagementSection.style.display = 'none';
  }

  // Initial load
  checkHealth();
  loadProducts();
}

// Sign Out Action
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('jwt_token');
  window.location.href = '/index.html';
});

// Admin View Audit Logs
viewLogsBtn.addEventListener('click', async () => {
  logsDisplay.style.display = 'block';
  logsDisplay.textContent = 'Fetching audit logs from MongoDB...';
  try {
    const response = await authenticatedFetch('/api/audit-logs');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch audit logs');

    if (data.length === 0) {
      logsDisplay.textContent = 'No audit logs found.';
      return;
    }

    logsDisplay.textContent = data.map(log => 
      `[${new Date(log.createdAt).toLocaleString()}] IP:${log.ipAddress} | User:${log.username} | Action:${log.action} | Resource:${log.resource}\nDetails: ${log.details}\n`
    ).join('\n');
  } catch (error) {
    logsDisplay.textContent = `Access Denied: ${error.message}`;
    logsDisplay.style.color = "var(--danger)";
  }
});

// Admin View Security Alerts
viewAlertsBtn.addEventListener('click', async () => {
  logsDisplay.style.display = 'block';
  logsDisplay.textContent = 'Fetching security warnings...';
  try {
    const response = await authenticatedFetch('/api/security-alerts');
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to fetch security alerts');

    if (data.length === 0) {
      logsDisplay.textContent = 'No security alerts found.';
      return;
    }

    logsDisplay.textContent = data.map(alert => 
      `[${new Date(alert.createdAt).toLocaleString()}] ALERT TYPE:${alert.type} | SEVERITY:${alert.severity.toUpperCase()}\nMessage: ${alert.message}\nMetadata: ${JSON.stringify(alert.metadata)}\n`
    ).join('\n');
  } catch (error) {
    logsDisplay.textContent = `Access Denied: ${error.message}`;
    logsDisplay.style.color = "var(--danger)";
  }
});

// Admin-Only Staff Registration Submission
if (staffRegistrationForm) {
  staffRegistrationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    regMessage.textContent = 'Creating credentials...';
    regMessage.style.color = 'var(--primary)';

    const payload = {
      username: regUsernameInput.value,
      password: regPasswordInput.value,
      role: 'staff' // Force role to staff
    };

    try {
      const response = await authenticatedFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          const errorMsgs = data.errors.map(err => `${err.field}: ${err.message}`).join(', ');
          throw new Error(errorMsgs);
        }
        throw new Error(data.message || 'Registration failed');
      }

      staffRegistrationForm.reset();
      regMessage.textContent = `Successfully created staff account: ${payload.username}`;
      regMessage.style.color = 'var(--success)';
    } catch (error) {
      regMessage.textContent = `Registration Error: ${error.message}`;
      regMessage.style.color = 'var(--danger)';
    }
  });
}

// Health Checker Probes
async function checkHealth() {
  try {
    const response = await fetch('/health');
    const data = await response.json();
    appStatus.textContent = "Service Online";
    dbStatus.textContent = `Database: ${data.database}`;
    healthDot.className = data.database === 'connected' ? 'dot ok' : 'dot bad';
  } catch (error) {
    appStatus.textContent = 'Service Offline';
    dbStatus.textContent = error.message;
    healthDot.className = 'dot bad';
  }
}

// Load Products
async function loadProducts() {
  productsContainer.innerHTML = '<div class="empty">Loading inventory database...</div>';

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
    productsContainer.innerHTML = `<div class="empty" style="color: var(--danger);">Error loading products: ${error.message}</div>`;
  }
}

// Delete Product
window.deleteProduct = async function(id) {
  try {
    const response = await authenticatedFetch(`/api/products/${id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete');
    }
    message.textContent = 'Product deleted successfully.';
    message.style.color = 'var(--success)';
    await loadProducts();
  } catch (error) {
    message.textContent = `Deletion Error: ${error.message}`;
    message.style.color = 'var(--danger)';
  }
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Product Form Submission
form.addEventListener('submit', async event => {
  event.preventDefault();
  message.textContent = 'Saving product...';
  message.style.color = 'var(--primary)';

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
      if (data.errors && Array.isArray(data.errors)) {
        const errorMsgs = data.errors.map(err => `${err.field}: ${err.message}`).join(', ');
        throw new Error(errorMsgs);
      }
      throw new Error(data.message || 'Unable to save product');
    }

    form.reset();
    message.textContent = 'Product saved successfully.';
    message.style.color = 'var(--success)';
    await loadProducts();
  } catch (error) {
    message.textContent = error.message;
    message.style.color = 'var(--danger)';
  }
});

refreshBtn.addEventListener('click', loadProducts);

// Start
verifyAuthAndInitialize();
setInterval(checkHealth, 10000);
