# InventoryHub

An inventory management web application built for the Secure Software Development (SSDD) course project. It features credential-based authentication, role-based access control (RBAC), security audit logging, and containerized deployment manifests.

---

## Overview

InventoryHub consists of a multi-page frontend (landing page, login portal, and dashboard) and a Node.js Express backend. It implements security features such as:
- **Authentication**: JWT token authorization with support for local validation or mock federated OIDC token verification.
- **Access Control**: Role-based permissions separating `admin` and `staff` activities.
- **Input Validation**: Zod-based request filtering to actively block common XSS and SQL injection payloads.
- **Logging & Alerting**: Real-time audit logs in MongoDB and brute-force detection tracked in Redis, with events published to Kafka.

---

## Project Structure

```text
inventory-management/
├── docker/                             # Dockerfile and build context
├── docs/                               # Project documentation
├── k8s/                                # Kubernetes manifests and Helm charts
│   ├── charts/                         # Helm packaging
│   └── policies/                       # Kyverno policy definitions
├── reports/                            # Security, testing, and compliance reports
│   └── images/                         # Screenshot assets for verification
├── src/                                # Frontend UI assets (HTML, CSS, JS)
├── docker-compose.yml                  # Local container environment orchestration
├── package.json                        # Node.js dependencies and scripts
├── server.js                           # Secure API server
└── server.test.js                      # Jest integration tests
```

---

## Setup & Running

### Option 1: Docker Compose (Recommended)
To start the application along with Zookeeper, Kafka, Redis, and MongoDB, run:
```bash
docker compose up --build -d
```
The application will be accessible at: http://localhost:3000

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
   Make sure local MongoDB, Redis, and Kafka services are running, then start the application:
   ```bash
   npm start
   ```

---

## Accounts & Mappings

The database initializes with a default administrator. Administrators can register staff accounts:

1. **System Administrator (Pre-seeded)**:
   - **Username**: `admin`
   - **Password**: `adminpassword`
   - **Access**: Log in through the Admin Portal to view the full inventory, register staff, and view system alerts.
2. **Staff Accounts**:
   - Logged in as `admin`, use the registration panel on the dashboard to create staff credentials.
   - Staff members can log in via the Staff Portal to read, add, or edit products, but are blocked from deleting products and viewing logs.

---

## Testing & Verification

### Run Automated Unit Tests
To execute the Jest integration test suite (covering OIDC validation, endpoint protection, and RBAC rules):
```bash
npm run test
```

---

## Kubernetes & Helm Deployment

### Deploy Manifests
Deploy the resources and secrets to your cluster:
```bash
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/
```

### Install with Helm
To deploy using the provided Helm chart:
```bash
helm install inventory-hub k8s/charts/inventory-hub
```

---

## Project Deliverables (Phases 3 & 4)

Complete compliance audits and test reports are saved in the `reports/` folder:

*   **[Security, Testing & Compliance Report (Word Docx)](file:///c:/Users/shariq%20abbasi/Desktop/inventory%20management/reports/Security_and_Testing_Report.docx)**: Microsoft Word report format for printing and direct submission.
*   **[Security, Testing & Compliance Report (Markdown)](file:///c:/Users/shariq%20abbasi/Desktop/inventory%20management/reports/Security_and_Testing_Report.md)**: Markdown version, containing the step-by-step guide for capturing and embedding required verification screenshots.
