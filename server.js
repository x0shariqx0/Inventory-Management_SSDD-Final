require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const client = require('prom-client');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventoryhub';
const APP_NAME = process.env.APP_NAME || 'InventoryHub';

app.use(cors());
app.use(express.json());
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

// ---------------- Database Model ----------------
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

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load products', error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, category, quantity, price } = req.body;

    if (!name || !category || quantity === undefined || price === undefined) {
      return res.status(400).json({ message: 'name, category, quantity and price are required' });
    }

    const product = await Product.create({ name, category, quantity, price });
    await refreshProductMetric();
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ message: 'Unable to create product', error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ message: 'Unable to update product', error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await refreshProductMetric();
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Unable to delete product', error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

connectDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`${APP_NAME} running on port ${PORT}`);
  });
});
