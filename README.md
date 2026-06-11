# InventoryHub

A secure inventory management web application. It features credential-based authentication, role-based access control (RBAC), security audit logging, and containerized deployment configurations.

---

## Features

- **Authentication**: JWT token authorization supporting local signature checks and federated mock OIDC token verification.
- **Access Control**: Role-based permissions separating `admin` and `staff` access to routes and data.
- **Input Validation**: Request body filtering using Zod schemas to block suspected SQL injection and XSS payloads.
- **Logging & Threat Alerting**: Runtime audit logs saved to MongoDB, brute-force login limits tracked in Redis, and security events published to Kafka.

---

## Project Structure

```text
inventory-management/
├── docker/                             # Dockerfile and container build contexts
├── docs/                               # General documentation
├── k8s/                                # Kubernetes manifests and Helm charts
│   ├── charts/                         # Helm packaging
│   └── policies/                       # Kyverno policy definitions
├── reports/                            # Security, testing, and compliance reports
│   └── images/                         # Screenshot assets
├── src/                                # Frontend UI assets (HTML, CSS, JS)
├── docker-compose.yml                  # Local container environment orchestration
├── package.json                        # Node.js dependencies and scripts
├── server.js                           # Express API server
└── server.test.js                      # Jest integration tests
```

---

## Getting Started

### Option 1: Docker Compose (Recommended)
To start the entire stack (Zookeeper, Kafka, Redis, MongoDB, and the API server), run:
```bash
docker compose up --build -d
```
Access the application at: http://localhost:3000

---

### Option 2: Running Locally (Node.js)
1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Setup environment variables**:
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
3. **Start the server**:
   Ensure your local MongoDB, Redis, and Kafka services are running, then run:
   ```bash
   npm start
   ```

---

## Default Credentials

The database initializes with a pre-seeded administrator who can register other team members:

1. **Administrator**:
   - **Username**: `admin`
   - **Password**: `adminpassword`
   - **Access**: Full read/write capability, staff user registration, and access to security logs and audit alerts.
2. **Staff Accounts**:
   - Registered by the administrator from the dashboard panel.
   - **Access**: Read, create, and edit products. Blocked from deleting products and viewing system alerts.

---

## Running Tests

To run the Jest integration test suite (verifying authentication gates, RBAC routes, and schema validation):
```bash
npm run test
```

---

## Kubernetes Deployment

### Deploy Manifests
To apply the deployment manifests and secrets to your cluster:
```bash
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/
```

### Deploy with Helm
To deploy using the Helm chart:
```bash
helm install inventory-hub k8s/charts/inventory-hub
```
