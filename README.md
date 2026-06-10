# InventoryHub - Secure Cloud-Native Inventory Platform

InventoryHub is an enterprise secure, cloud-native inventory management platform built for the Secure Software Development (SSDD) lab final project. 

It features a multi-page web application architecture (Landing Page, System Sign In, and Management Dashboard) designed with Zero-Trust network policies, mock OIDC identity token claims validation, and advanced runtime logging.

---

## 🚀 Key Project Features

- **Multi-Page Layout**: Dedicated landing page, separate credential-based login portal, and a secure administration dashboard.
- **Admin-Restricted Registration**: Only authenticated administrators can register staff members and issue credentials.
- **Role-Based Access Control (RBAC)**: Admins have full access (CRUD + Audit Trails + Warnings); Staff can only create/update products (Restricted deletions).
- **Hardened Caching & Events**: Redis and Kafka client integrations built with SSL/TLS and password/SASL authentication structures.
- **Microservice Hardening**: Containers running as non-root with dropped Linux capabilities and CPU/Memory limits.
- **Policy-as-Code**:workloads are governed at the cluster level by Kyverno policies.
- **Static Code Analysis**: Custom scan configurations defined for SonarQube and CodeQL.

---

## 📁 Project Directory Structure

```text
inventory-management/
├── docker/                             # Hardened Docker contexts
│   ├── Dockerfile
│   └── .dockerignore
├── docs/                               # Security documentation
│   └── Memory_Safety_Mitigation.md
├── k8s/                                # Kubernetes orchestrations
│   ├── charts/                         # Helm Chart packaging
│   │   └── inventory-hub/
│   │       ├── Chart.yaml
│   │       ├── values.yaml
│   │       └── templates/              # Manifest templates (PV, PVC, HPA, NetPolicy, etc.)
│   ├── policies/                       # Policy-as-Code
│   │   └── pod-security-policies.yaml  # Kyverno pod security standards
│   ├── app-deployment.yaml
│   ├── app-hpa.yaml
│   ├── app-service.yaml
│   ├── kafka-deployment.yaml
│   ├── kafka-service.yaml
│   ├── mongo-deployment.yaml
│   ├── mongo-pv.yaml
│   ├── mongo-pvc.yaml
│   ├── mongo-service.yaml
│   ├── network-policy.yaml
│   ├── redis-deployment.yaml
│   ├── redis-service.yaml
│   └── secret.yaml
├── reports/                            # CIS compliance and test audit reports
├── src/                                # Frontend UI assets (index.html, login.html, dashboard.html)
│   ├── app.js
│   ├── index.html
│   ├── login.html
│   ├── dashboard.html
│   └── style.css
├── docker-compose.yml                  # Local environment orchestration
├── package.json
├── server.js                           # Node.js Express Secure API Server
├── server.test.js                      # Jest Integration Test Suite
└── sonar-project.properties            # SonarQube scanning properties
```

---

## ⚙️ Initial Run Procedures

### Option 1: Run via Docker Compose (Simplest & Recommended)
Rebuild and launch the entire secure container stack including the backend application, Zookeeper, Kafka, Redis, and MongoDB:
```bash
docker compose up --build -d
```
- Open your browser to: [http://localhost:3000](http://localhost:3000)

---

### Option 2: Running Locally (Bare Metal Node.js)
1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Setup Local Environment**:
   Copy `.env.example` to `.env` and fill in local connection URIs:
   ```bash
   cp .env.example .env
   ```
3. **Start Development Server**:
   Ensure local Mongo, Redis, and Kafka services are running, then execute:
   ```bash
   npm start
   ```

---

## 🔐 Credentials & Access Control Flow

The platform initializes a single system administrator. Admins are then responsible for provisioning staff members:

1. **System Administrator (Pre-seeded)**:
   - **Username**: `admin`
   - **Password**: `adminpassword`
   - **Access**: Click **Access Admin Portal** on the Landing Page, login with the credentials, and manage inventory.
2. **Staff Provisioning**:
   - Logged in as `admin`, use the **Register New Staff Member** panel in the dashboard to create a new staff account (e.g., `staff2` / `staffpassword`).
   - This sends an authorized call to `/api/auth/register` (guarded so only admins can execute it) and registers the user.
3. **Staff Login**:
   - Log out, access the **Staff Member Portal** on the landing page, and sign in with the new staff credentials.

---

## 🧪 Testing and Verification

### Run Automated Unit Tests
Execute the Jest integration test suite verifying OIDC validations, route protections, and RBAC mappings:
```bash
npm run test
```

---

## ☸️ Kubernetes & Helm Deployments

### Apply Raw Kubernetes Manifests
Apply secrets and resources directly to your cluster:
```bash
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/
```

### Install using Helm Chart
Deploy the templated and parameterized chart:
```bash
helm install inventory-hub k8s/charts/inventory-hub
```
Verify the installation:
```bash
helm list
kubectl get pods
```
