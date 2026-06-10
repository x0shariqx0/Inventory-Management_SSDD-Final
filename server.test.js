const bcrypt = require('bcryptjs');

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    const store = new Map();
    return {
      on: jest.fn(),
      connect: jest.fn().mockResolvedValue(null),
      get: jest.fn().mockImplementation(async (key) => store.get(key) || null),
      set: jest.fn().mockImplementation(async (key, val) => {
        store.set(key, val);
        return 'OK';
      }),
      incr: jest.fn().mockImplementation(async (key) => {
        const val = (parseInt(store.get(key), 10) || 0) + 1;
        store.set(key, val.toString());
        return val;
      }),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockImplementation(async (key) => {
        store.delete(key);
        return 1;
      })
    };
  });
});

// Mock Kafka
jest.mock('kafkajs', () => {
  return {
    Kafka: jest.fn().mockImplementation(() => {
      return {
        producer: jest.fn().mockImplementation(() => {
          return {
            connect: jest.fn().mockResolvedValue(null),
            send: jest.fn().mockResolvedValue([{ topicName: 'inventory-events', partition: 0, errorCode: 0, baseOffset: '0' }]),
            disconnect: jest.fn().mockResolvedValue(null)
          };
        })
      };
    })
  };
});

// Mock Mongoose completely to run tests in-memory
const mockStores = new Map();

jest.mock('mongoose', () => {
  const mockMongoose = {
    connect: jest.fn().mockResolvedValue(null),
    connection: {
      readyState: 1,
      db: {
        dropDatabase: jest.fn().mockResolvedValue(null)
      },
      collections: {}
    },
    Schema: class {
      constructor() {}
      static Types = {
        Mixed: 'Mixed'
      };
    },
    model: jest.fn().mockImplementation((modelName) => {
      if (!mockStores.has(modelName)) {
        mockStores.set(modelName, []);
      }
      const store = mockStores.get(modelName);

      const mockModel = function(data) {
        Object.assign(this, data);
        this._id = 'mock_' + Math.random().toString(36).substring(2, 11);
        this.createdAt = new Date();
        this.save = jest.fn().mockImplementation(async () => {
          const exists = store.find(item => item._id === this._id);
          if (!exists) store.push(this);
          return this;
        });
      };

      mockModel.create = jest.fn().mockImplementation(async (data) => {
        const item = new mockModel(data);
        store.push(item);
        return item;
      });

      mockModel.findOne = jest.fn().mockImplementation(async (query) => {
        if (query && query.username) {
          // Preseed check to emulate DB seeding
          const user = store.find(u => u.username === query.username);
          if (!user && (query.username === 'admin' || query.username === 'staff')) {
            const newUser = new mockModel({
              username: query.username,
              password: require('bcryptjs').hashSync(query.username + 'password', 10),
              role: query.username,
              failedLoginAttempts: 0
            });
            store.push(newUser);
            return newUser;
          }
          return user || null;
        }
        return null;
      });

      mockModel.find = jest.fn().mockImplementation(() => {
        return {
          sort: jest.fn().mockImplementation(() => {
            // Return copy sorted by createdAt desc
            return [...store].sort((a, b) => b.createdAt - a.createdAt);
          })
        };
      });

      mockModel.findById = jest.fn().mockImplementation(async (id) => {
        return store.find(item => item._id === id) || null;
      });

      mockModel.findByIdAndUpdate = jest.fn().mockImplementation(async (id, update) => {
        const item = store.find(item => item._id === id);
        if (item) {
          Object.assign(item, update);
          return item;
        }
        return null;
      });

      mockModel.findByIdAndDelete = jest.fn().mockImplementation(async (id) => {
        const index = store.findIndex(item => item._id === id);
        if (index !== -1) {
          const item = store[index];
          store.splice(index, 1);
          return item;
        }
        return null;
      });

      mockModel.countDocuments = jest.fn().mockImplementation(async (query) => {
        if (query && query.action) {
          return store.filter(item => item.action === query.action).length;
        }
        return store.length;
      });

      return mockModel;
    })
  };
  return mockMongoose;
});

const request = require('supertest');
const { app } = require('./server');

let adminToken;
let staffToken;
let seededAdminToken;
let createdProductId;

beforeAll(async () => {
  // Clear mock stores before testing
  mockStores.clear();
  
  // Login as preseeded admin to get registration authorization token
  const res = await request(app)
    .post('/api/auth/login')
    .send({
      username: 'admin',
      password: 'adminpassword'
    });
  seededAdminToken = res.body.token;
});

describe('InventoryHub Secure API Suite (In-Memory Verification)', () => {
  
  // 1. Register User tests
  describe('POST /api/auth/register', () => {
    it('should successfully register an admin user when authorized as admin', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${seededAdminToken}`)
        .send({
          username: 'testadmin',
          password: 'adminpassword123',
          role: 'admin'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.user).toHaveProperty('username', 'testadmin');
      expect(res.body.user).toHaveProperty('role', 'admin');
    });

    it('should successfully register a staff user when authorized as admin', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${seededAdminToken}`)
        .send({
          username: 'teststaff',
          password: 'staffpassword123',
          role: 'staff'
        });
      
      expect(res.status).toBe(201);
      expect(res.body.user).toHaveProperty('username', 'teststaff');
      expect(res.body.user).toHaveProperty('role', 'staff');
    });

    it('should reject registration attempts without authorization header', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'unauthuser',
          password: 'password123',
          role: 'staff'
        });
      
      expect(res.status).toBe(401);
    });

    it('should reject registration attempts by a staff user', async () => {
      // First get staff token (pre-seeded staff)
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'staff',
          password: 'staffpassword'
        });
      const localStaffToken = loginRes.body.token;

      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${localStaffToken}`)
        .send({
          username: 'newuser',
          password: 'password123',
          role: 'staff'
        });
      
      expect(res.status).toBe(403);
    });

    it('should reject registration attempts with XSS script tags when authorized', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${seededAdminToken}`)
        .send({
          username: 'evil<script>alert("xss")</script>',
          password: 'password123',
          role: 'staff'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
    });
  });

  // 2. Login User & Block Invalid Login tests
  describe('POST /api/auth/login', () => {
    it('should login admin successfully and return a JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'adminpassword123'
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      adminToken = res.body.token;
    });

    it('should login staff successfully and return a JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'teststaff',
          password: 'staffpassword123'
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      staffToken = res.body.token;
    });

    it('should reject invalid login credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'teststaff',
          password: 'wrongpassword'
        });
      
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid username or password.');
    });
  });

  // 3. Admin/Staff can create product
  describe('POST /api/products', () => {
    it('should allow admin to create a new product', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Gaming Keyboard',
          category: 'Peripherals',
          quantity: 45,
          price: 4999
        });
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
      expect(res.body.name).toBe('Gaming Keyboard');
      createdProductId = res.body._id;
    });

    it('should reject product creation with invalid schema data (negative quantity)', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Item',
          category: 'Office',
          quantity: -5,
          price: 100
        });
      
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
    });

    it('should reject product creation containing suspected XSS / script tags', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Monitor <script>window.location="..."</script>',
          category: 'Screens',
          quantity: 10,
          price: 25000
        });
      
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
    });
  });

  // 4. Staff cannot delete product
  describe('DELETE /api/products/:id', () => {
    it('should deny staff from deleting a product', async () => {
      const res = await request(app)
        .delete(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Forbidden: Insufficient privileges.');
    });

    it('should allow admin to successfully delete a product', async () => {
      const res = await request(app)
        .delete(`/api/products/${createdProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Product deleted successfully');
    });
  });

  // 5. Audit logs and security alerts require admin
  describe('Admin-Only RBAC Endpoints', () => {
    it('should deny staff from accessing audit logs', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect(res.status).toBe(403);
    });

    it('should allow admin to view audit logs', async () => {
      const res = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should deny staff from accessing security alerts', async () => {
      const res = await request(app)
        .get('/api/security-alerts')
        .set('Authorization', `Bearer ${staffToken}`);
      
      expect(res.status).toBe(403);
    });

    it('should allow admin to view security alerts', async () => {
      const res = await request(app)
        .get('/api/security-alerts')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // 6. OIDC Mock Authentication tests
  describe('OIDC Mock Identity Integration', () => {
    it('should issue a valid OIDC JWT token and access products successfully', async () => {
      const oidcTokenRes = await request(app)
        .post('/oauth2/token')
        .send({
          username: 'oidcuser',
          role: 'staff'
        });
      
      expect(oidcTokenRes.status).toBe(200);
      expect(oidcTokenRes.body).toHaveProperty('access_token');
      const oidcToken = oidcTokenRes.body.access_token;

      // Access GET /api/products using OIDC token
      const res = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${oidcToken}`);
      
      expect(res.status).toBe(200);
    });

    it('should reject OIDC token request without username or role', async () => {
      const res = await request(app)
        .post('/oauth2/token')
        .send({
          username: 'oidcuser'
        });
      
      expect(res.status).toBe(400);
    });
  });
});
