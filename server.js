require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const client = require('prom-client');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');
const { Kafka } = require('kafkajs');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/inventoryhub';
const APP_NAME = process.env.APP_NAME || 'InventoryHub';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_change_me_in_production';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9092';

// ---------------- Redis Client Setup ----------------
const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 1,
  lazyConnect: true
});

redis.on('error', (err) => {
  console.warn(`Redis is unavailable: ${err.message}. Failed logins will fallback to MongoDB.`);
});

redis.connect().catch((err) => {
  console.warn(`Initial Redis connection failed: ${err.message}. Failed logins will fallback to MongoDB.`);
});

// Redis Failed Login Helpers
async function getFailedAttempts(username) {
  try {
    const key = `failed_login:${username}`;
    const attempts = await redis.get(key);
    return attempts ? parseInt(attempts, 10) : 0;
  } catch (err) {
    const user = await User.findOne({ username });
    return user ? user.failedLoginAttempts : 0;
  }
}

async function incrementFailedAttempts(username) {
  try {
    const key = `failed_login:${username}`;
    const attempts = await redis.incr(key);
    if (attempts === 1) {
      await redis.expire(key, 600); // 10 minutes expiry
    }
    return attempts;
  } catch (err) {
    const user = await User.findOne({ username });
    if (user) {
      user.failedLoginAttempts += 1;
      await user.save();
      return user.failedLoginAttempts;
    }
    return 0;
  }
}

async function resetFailedAttempts(username) {
  try {
    const key = `failed_login:${username}`;
    await redis.del(key);
  } catch (err) {
    const user = await User.findOne({ username });
    if (user) {
      user.failedLoginAttempts = 0;
      await user.save();
    }
  }
}

// ---------------- Kafka Client Setup ----------------
const kafka = new Kafka({
  clientId: 'inventory-hub',
  brokers: [KAFKA_BROKER],
  connectionTimeout: 3000,
  initialRetry: {
    retries: 1
  }
});

const producer = kafka.producer();
let kafkaConnected = false;

async function connectKafka() {
  try {
    await producer.connect();
    kafkaConnected = true;
    console.log('Kafka Producer connected.');
  } catch (err) {
    console.warn(`Kafka is unavailable: ${err.message}. Event logging will skip publishing.`);
  }
}

connectKafka();

async function publishKafkaEvent(eventType, payload) {
  if (!kafkaConnected) {
    console.warn(`Kafka Event [${eventType}] skipped (Kafka not connected):`, JSON.stringify(payload));
    return;
  }
  try {
    await producer.send({
      topic: 'inventory-events',
      messages: [
        {
          key: eventType,
          value: JSON.stringify({
            event: eventType,
            timestamp: new Date().toISOString(),
            data: payload
          })
        }
      ]
    });
    console.log(`Kafka Event [${eventType}] published successfully.`);
  } catch (err) {
    console.warn(`Failed to publish Kafka Event [${eventType}]: ${err.message}`);
  }
}

// ---------------- Security Middleware ----------------
app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(express.json({ limit: '10kb' }));

app.use(cors({
  origin: CLIENT_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login or registration attempts, please try again after 15 minutes.' }
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(express.static(path.join(__dirname, 'src')));

// ---------------- Prometheus Metrics ----------------
client.collectDefaultMetrics();

const httpRequestCounter = new client.Counter({
  name: 'inventoryhub_http_requests_total',
  help: 'Total number of HTTP requests received by InventoryHub',
  labelNames: ['method', 'route', 'status_code']
});

const productCounter = new client.Gauge({
  name: 'inventoryhub_products_total',
  help: 'Total number of products stored in MongoDB'
});

app.use((req, res, next) => {
  const end = res.end;
  res.end = function (...args) {
    const route = req.route && req.route.path ? req.route.path : req.path;
    httpRequestCounter.inc({
      method: req.method,
      route,
      status_code: res.statusCode
    });
    end.apply(res, args);
  };
  next();
});

// ---------------- Database Models ----------------

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);
const Product = mongoose.model('Product', productSchema);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
    failedLoginAttempts: { type: Number, default: 0 }
  },
  { timestamps: true }
);
const User = mongoose.model('User', userSchema);

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: String, default: 'anonymous' },
    username: { type: String, default: 'anonymous' },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    details: { type: String },
    ipAddress: { type: String },
    createdAt: { type: Date, default: Date.now }
  }
);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

const securityAlertSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    message: { type: String, required: true },
    userId: { type: String, default: 'anonymous' },
    metadata: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now }
  }
);
const SecurityAlert = mongoose.model('SecurityAlert', securityAlertSchema);

// ---------------- Audit & Alert Helpers ----------------
async function logAudit(req, action, resource, details, userId = 'anonymous', username = 'anonymous') {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress) : 'system';
    const logUserId = req && req.user ? req.user.id : userId;
    const logUsername = req && req.user ? req.user.username : username;
    await AuditLog.create({
      userId: logUserId,
      username: logUsername,
      action,
      resource,
      details,
      ipAddress
    });
  } catch (err) {
    console.error('Audit logging failed:', err.message);
  }
}

async function triggerAlert(req, type, severity, message, metadata = {}, userId = 'anonymous') {
  try {
    const logUserId = req && req.user ? req.user.id : userId;
    await SecurityAlert.create({
      type,
      severity,
      message,
      userId: logUserId,
      metadata
    });
  } catch (err) {
    console.error('Security alert trigger failed:', err.message);
  }
}

// ---------------- Input Validation Rules (Zod) ----------------
const scriptTagRegex = /<[^>]*script/i;
const suspiciousInputRegex = /[\'\"]\s*(or|and)\s*[\'\"]|--|<[^>]+>/i;

const cleanStringSchema = z.string()
  .min(1, { message: "Input is required and cannot be empty." })
  .refine(val => !scriptTagRegex.test(val), { message: "Script tags are not allowed." })
  .refine(val => !suspiciousInputRegex.test(val), { message: "Suspicious characters or HTML tags detected." });

const productValidationSchema = z.object({
  name: cleanStringSchema,
  category: cleanStringSchema,
  quantity: z.number({ required_error: "Quantity is required." }).min(0, { message: "Quantity must be at least 0." }),
  price: z.number({ required_error: "Price is required." }).min(0, { message: "Price must be at least 0." })
});

const registerValidationSchema = z.object({
  username: cleanStringSchema.refine(val => val.length <= 30, { message: "Username must be at most 30 characters." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters long." }),
  role: z.enum(['admin', 'staff']).default('staff')
});

const loginValidationSchema = z.object({
  username: cleanStringSchema,
  password: z.string().min(1, { message: "Password is required." })
});

const validateBody = (schema) => async (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      await logAudit(req, 'VALIDATION_FAILED', 'body', `Input validation failed: ${JSON.stringify(error.errors)}`);
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.errors.map(err => ({ field: err.path.join('.'), message: err.message }))
      });
    }
    next(error);
  }
};

// ---------------- Auth & RBAC Middleware ----------------
const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    await logAudit(req, 'UNAUTHORIZED_ACCESS', req.originalUrl, 'Invalid or expired token');
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      await logAudit(req, 'UNAUTHORIZED_ACCESS', req.originalUrl, 'Access attempted without authentication');
      await triggerAlert(req, 'UNAUTHORIZED_ACCESS', 'high', `Access attempted on ${req.originalUrl} without auth`);
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      await logAudit(req, 'UNAUTHORIZED_ACCESS', req.originalUrl, `User ${req.user.username} (role: ${req.user.role}) attempted to access restricted route`);
      
      // Anomaly detection: staff tries to delete a product (suspicious unauthorized delete action)
      if (req.method === 'DELETE' && req.originalUrl.startsWith('/api/products') && req.user.role === 'staff') {
        await triggerAlert(req, 'UNAUTHORIZED_DELETION_ATTEMPT', 'high', `Staff user ${req.user.username} attempted to delete a product`, { url: req.originalUrl });
        await publishKafkaEvent('security.unauthorized_access', {
          username: req.user.username,
          role: req.user.role,
          action: 'DELETE_PRODUCT_ATTEMPT',
          resource: req.originalUrl,
          message: 'Staff user attempted to delete a product'
        });
      } else {
        await triggerAlert(req, 'UNAUTHORIZED_ACCESS', 'medium', `User ${req.user.username} (role: ${req.user.role}) attempted to access route ${req.originalUrl}`);
        await publishKafkaEvent('security.unauthorized_access', {
          username: req.user.username,
          role: req.user.role,
          action: 'ACCESS_RESTRICTED_ROUTE',
          resource: req.originalUrl,
          message: 'Insufficient role permissions'
        });
      }

      return res.status(403).json({ message: 'Forbidden: Insufficient privileges.' });
    }
    next();
  };
};

// ---------------- Database connection & Seeding ----------------
async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`MongoDB connected: ${MONGODB_URI}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
  }
}

async function refreshProductMetric() {
  if (mongoose.connection.readyState === 1) {
    const count = await Product.countDocuments();
    productCounter.set(count);
  }
}

async function seedDefaultUsers() {
  try {
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const hashedAdminPassword = await bcrypt.hash('adminpassword', 10);
      await User.create({
        username: 'admin',
        password: hashedAdminPassword,
        role: 'admin'
      });
      console.log('Seeded default admin user (username: admin, password: adminpassword)');
    }

    const staffExists = await User.findOne({ username: 'staff' });
    if (!staffExists) {
      const hashedStaffPassword = await bcrypt.hash('staffpassword', 10);
      await User.create({
        username: 'staff',
        password: hashedStaffPassword,
        role: 'staff'
      });
      console.log('Seeded default staff user (username: staff, password: staffpassword)');
    }
  } catch (err) {
    console.error('Default user seeding failed:', err.message);
  }
}

// ---------------- Routes ----------------

app.get('/health', async (req, res) => {
  res.json({
    app: APP_NAME,
    status: 'running',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

app.get('/metrics', async (req, res) => {
  try {
    await refreshProductMetric();
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// --- Auth Endpoints ---

app.post('/api/auth/register', validateBody(registerValidationSchema), async (req, res) => {
  try {
    const { username, password, role } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
      role
    });

    await logAudit(null, 'USER_REGISTERED', `User:${user._id}`, `New user registered: ${username} with role ${role}`, user._id.toString(), username);

    res.status(201).json({
      message: 'User registered successfully.',
      user: { id: user._id, username: user.username, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed.', error: error.message });
  }
});

app.post('/api/auth/login', validateBody(loginValidationSchema), async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      await logAudit(null, 'LOGIN_FAILED', 'auth', `Failed login attempt for non-existent user: ${username}`);
      await publishKafkaEvent('auth.login_failed', { username, reason: 'user_not_found' });
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Redis tracking for failed logins
      const attempts = await incrementFailedAttempts(username);

      await logAudit(null, 'LOGIN_FAILED', `User:${user._id}`, `Failed login attempt for user: ${username}. Total failures (window): ${attempts}`, user._id.toString(), username);
      await publishKafkaEvent('auth.login_failed', { username, attempts, reason: 'invalid_password' });

      // Anomaly detection: more than 5 failed logins in 10 minutes = suspicious
      if (attempts > 5) {
        await triggerAlert(null, 'BRUTE_FORCE_ATTEMPT', 'critical', `Failed login attempts exceed 5 for user: ${username}`, { username, attempts }, user._id.toString());
      }

      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // Login successful
    await resetFailedAttempts(username);

    await logAudit(null, 'LOGIN_SUCCESS', `User:${user._id}`, `Successful login for user: ${username}`, user._id.toString(), username);
    await publishKafkaEvent('auth.login_success', { username, role: user.role });

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Login successful.',
      token,
      user: { id: user._id, username: user.username, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed.', error: error.message });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// --- Product Endpoints ---

app.get('/api/products', authenticate, authorize('admin', 'staff'), async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load products', error: error.message });
  }
});

app.post('/api/products', authenticate, authorize('admin', 'staff'), validateBody(productValidationSchema), async (req, res) => {
  try {
    const { name, category, quantity, price } = req.body;
    const product = await Product.create({ name, category, quantity, price });

    await logAudit(req, 'PRODUCT_CREATED', `Product:${product._id}`, `Product ${name} created with quantity ${quantity} and price ${price}`);
    await publishKafkaEvent('product.created', { id: product._id, name, category, quantity, price, user: req.user.username });

    // Anomaly detection: quantity change greater than 100 = suspicious
    if (quantity > 100) {
      await logAudit(req, 'LARGE_STOCK_CHANGE', `Product:${product._id}`, `Large stock created: ${quantity}`);
      await triggerAlert(req, 'STOCK_CHANGE_EXCEEDED', 'medium', `Product ${name} created with large stock: ${quantity}`, { quantity });
      await publishKafkaEvent('security.large_stock_change', { productId: product._id, name, quantity, action: 'create' });
    }

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: 'Unable to create product', error: error.message });
  }
});

app.put('/api/products/:id', authenticate, authorize('admin', 'staff'), validateBody(productValidationSchema), async (req, res) => {
  try {
    const oldProduct = await Product.findById(req.params.id);
    if (!oldProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const { name, category, quantity, price } = req.body;
    const delta = Math.abs(quantity - oldProduct.quantity);

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    await logAudit(req, 'PRODUCT_UPDATED', `Product:${updatedProduct._id}`, `Product ${name} updated. Quantity: ${quantity}, Price: ${price}`);
    await publishKafkaEvent('product.updated', { id: updatedProduct._id, name, category, quantity, price, user: req.user.username });

    // Anomaly detection: quantity change greater than 100 = suspicious
    if (delta > 100) {
      await logAudit(req, 'LARGE_STOCK_CHANGE', `Product:${updatedProduct._id}`, `Large stock change: delta=${delta} (from ${oldProduct.quantity} to ${quantity})`);
      await triggerAlert(req, 'STOCK_CHANGE_EXCEEDED', 'high', `Large stock change for product ${name}: delta=${delta}`, { oldQuantity: oldProduct.quantity, newQuantity: quantity });
      await publishKafkaEvent('security.large_stock_change', { productId: updatedProduct._id, name, oldQuantity: oldProduct.quantity, newQuantity: quantity, delta, action: 'update' });
    }

    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ message: 'Unable to update product', error: error.message });
  }
});

app.delete('/api/products/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await logAudit(req, 'PRODUCT_DELETED', `Product:${req.params.id}`, `Product ${deletedProduct.name} deleted`);
    await publishKafkaEvent('product.deleted', { id: req.params.id, name: deletedProduct.name, user: req.user.username });

    // Check repeated deletions (more than 3 deletions in the last 1 minute)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const deletionCount = await AuditLog.countDocuments({
      action: 'PRODUCT_DELETED',
      createdAt: { $gte: oneMinuteAgo }
    });

    if (deletionCount >= 3) {
      await triggerAlert(req, 'REPEATED_DELETIONS', 'critical', `Repeated product deletions detected: ${deletionCount} deletions in the last minute`, { deletionCount });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Unable to delete product', error: error.message });
  }
});

// --- Audit & Security Alerts Endpoints ---

app.get('/api/audit-logs', authenticate, authorize('admin'), async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch audit logs', error: error.message });
  }
});

app.get('/api/security-alerts', authenticate, authorize('admin'), async (req, res) => {
  try {
    const alerts = await SecurityAlert.find().sort({ createdAt: -1 });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch security alerts', error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

// Start Database & Seeding
connectDatabase().then(async () => {
  if (mongoose.connection.readyState === 1) {
    await seedDefaultUsers();
  }
});

// Export redis, producer, and connectDatabase for mocking in tests
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`${APP_NAME} running on port ${PORT}`);
  });
}

module.exports = { app, redis, producer };
