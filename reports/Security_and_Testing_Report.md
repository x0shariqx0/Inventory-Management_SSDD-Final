# InventoryHub Security, Testing & Compliance Report (Phases 3 & 4)

This comprehensive report serves as the primary deliverable for **Phases 3 & 4 (Secure Codebase + Test Reports)** of the Secure Software Development (SSDD) lab project. It documents the entire security architecture, defensive middleware design, static and dynamic analysis workflows, containerized orchestrations, test logs, and step-by-step verification guidelines.

---

## Table of Contents
1. [Defensive Design & Security Implementations](#1-defensive-design--security-implementations)
2. [Authentication & Role-Based Access Control (RBAC)](#2-authentication--role-based-access-control-rbac)
3. [Audit Logging & Security Alert Triggers](#3-audit-logging--security-alert-triggers)
4. [External Integrations (Redis & Kafka)](#4-external-integrations-redis--kafka)
5. [Static Application Security Testing (SAST)](#5-static-application-security-testing-sast)
6. [Dynamic Application Security Testing (DAST) & Pentest Scenarios](#6-dynamic-application-security-testing-dast--pentest-scenarios)
7. [Docker & Kubernetes Security Hardening](#7-docker--kubernetes-security-hardening)
8. [CIS Docker & Kubernetes Compliance Checklist](#8-cis-docker--kubernetes-compliance-checklist)
9. [Jest Integration Test Execution Logs](#9-jest-integration-test-execution-logs)
10. [Step-by-Step Screenshot Verification Guide](#10-step-by-step-screenshot-verification-guide)

---

## 1. Defensive Design & Security Implementations

To defend the application layer from external exploits, the Node.js Express server implements a sequential middleware processing pipeline.

- **HTTP Headers Hardening (Helmet)**: Configured using `helmet()` to inject standard headers that configure web browsers to reject clickjacking, mime-type sniffing, cross-site scripting (XSS), and data leakage:
  - `X-Frame-Options: SAMEORIGIN` (blocks clickjacking in third-party iframes)
  - `X-Content-Type-Options: nosniff` (enforces strict MIME checks)
  - `Referrer-Policy: no-referrer` (stops sensitive path information leakage)
- **Cross-Origin Resource Sharing (CORS)**: Access is restricted using `cors({ origin: CLIENT_ORIGIN })` to prevent unauthorized cross-origin requests from scripts running in external origins.
- **Request Payload Buffering Limit**: To block denial-of-service (DoS) attempts that send large payload volumes, body parsing is restricted using `express.json({ limit: '10kb' })`.
- **Traffic Rate Limiting**: Prevents brute-force credential attacks and API scraping:
  - **General APIs**: Limited to **100 requests per 15 minutes** per IP.
  - **Auth APIs (`/api/auth/login`, `/api/auth/register`)**: Restricted to **20 attempts per 15 minutes** per IP.

---

## 2. Authentication & Role-Based Access Control (RBAC)

The application enforces strict user access restrictions:

- **Password Storage**: Raw passwords are encrypted using **bcryptjs** with a salt factor of 10.
- **Access Tokens**: Express routes are guarded by a JWT Bearer header check. The application validates local JWT signatures (signed with `JWT_SECRET`) or federated **OIDC tokens** (validated via an RSA-256 public key generated dynamically).
- **Access Control Matrix**:

| Feature / API Route | Allowed Roles | staff Access | admin Access | Action Triggered on Violation |
| :--- | :---: | :---: | :---: | :--- |
| **User Registration** | `admin` | Blocked | Allowed | `403 Forbidden` + Audit alert logged |
| **Product Query (GET)** | `admin`, `staff` | Allowed | Allowed | `401 Unauthorized` (if no token) |
| **Product Create (POST)**| `admin`, `staff` | Allowed | Allowed | Zod validation rules applied |
| **Product Update (PUT)** | `admin`, `staff` | Allowed | Allowed | Stock deviation checks applied |
| **Product Delete (DELETE)**| `admin` | Blocked | Allowed | `403 Forbidden` + Anomaly alert triggered |
| **Security Alerts / Logs**| `admin` | Blocked | Allowed | `403 Forbidden` + Security Alert logged |

---

## 3. Audit Logging & Security Alert Triggers

Every state change or security violation writes an entry to the MongoDB database:

- **Audit Logs**: Records successful/failed logins, CRUD operations, input violations, and unauthorized path requests. Recorded properties include user IDs, timestamps, requested paths, and remote client IPs.
- **Security Alerts**: Real-time filters analyze events and trigger warning levels:
  - `BRUTE_FORCE_ATTEMPT` (Critical): Triggered if failed login attempts exceed 5 in 10 minutes.
  - `STOCK_CHANGE_EXCEEDED` (Medium/High): Triggered if product stock is created or edited by a delta greater than 100 units.
  - `UNAUTHORIZED_DELETION_ATTEMPT` (High): Triggered if a `staff` user attempts to delete a product.
  - `REPEATED_DELETIONS` (Critical): Triggered if more than 3 products are deleted in under 1 minute.

---

## 4. External Integrations (Redis & Kafka)

- **Redis Connection**: Utilizes `ioredis` to manage brute-force failed login counts (`failed_login:<username>`) with a 10-minute timeout. Supports TLS and credentials password files.
- **Kafka Streaming**: Utilizes `kafkajs` to stream security event payloads (such as `auth.login_failed`, `security.unauthorized_access`) to the `inventory-events` topic.
- **Fallback Tolerances**: If Redis or Kafka are disconnected, the database driver intercepts the calls and falls back gracefully to MongoDB storage, maintaining service availability.

---

## 5. Static Application Security Testing (SAST)

We configure two static analysis tools to verify code quality and find vulnerabilities:

### A. GitHub CodeQL (`.github/workflows/codeql.yml`)
Runs on push/pull requests to the `main` branch, or weekly on Saturday. Highlights include:
- Taint analysis tracking input data routes to database query commands.
- Analysis focused on the `javascript-typescript` language matrix.
- `security-events: write` permission to push results to the repository alerts tab.

### B. SonarQube (`sonar-project.properties`)
Configured to track code health and bugs in `server.js` and `src/` while excluding dependencies and configs:
- `sonar.exclusions=node_modules/**,coverage/**,reports/**,docs/**,docker/**,k8s/**`
- Enforces Quality Gate metrics: Zero new vulnerabilities, A-rating security rating, and zero blocker bugs.

---

## 6. Dynamic Application Security Testing (DAST) & Pentest Scenarios

### A. OWASP ZAP API Scanning
Runs automated fuzzer scripts using Docker to test routing surfaces:
```bash
docker run -t ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py -t http://host.docker.internal:3000/api/products -f openapi
```

### B. Active Pentest Scenarios Matrix

| Vulnerability Target | Injected Payload | Defense Mechanism | Response |
| :--- | :--- | :--- | :---: |
| **SQL Injection (SQLi)** | `username: "' OR '1'='1 --"` | Zod schema regex blocking SQL patterns | `400 Bad Request` |
| **Cross-Site Scripting (XSS)** | `name: "<script>alert(1)</script>"`| Zod schema regex blocking script tags | `400 Bad Request` |
| **Privilege Escalation** | `DELETE /api/products/:id` (Staff JWT)| RBAC checks matching token claims | `403 Forbidden` |
| **Denial of Service (DoS)** | Payload body > 10kb | Express JSON limit configurations | `413 Payload Too Large` |

---

## 7. Docker & Kubernetes Security Hardening

### A. Container Virtualization (Dockerfile)
- **Minimal Image**: Built on `node:20-alpine` to reduce package vulnerabilities.
- **Non-Root Execution**: Creates custom group `appgroup` and user `appuser`. The runtime executes under `USER appuser`, restricting file permissions.
- **Production Builds**: Installs only production libraries via `npm ci --omit=dev`.

### B. Cluster Orchestration (Kubernetes)
- **Security Context**: The pod configuration drops Linux capabilities and blocks privilege escalation:
  ```yaml
  securityContext:
    runAsNonRoot: true
    runAsUser: 1001
    allowPrivilegeEscalation: false
    capabilities:
      drop: ["ALL"]
  ```
- **Secrets Management**: Credentials and connection URIs are injected into container environments via `secret.yaml` resources.
- **Network Isolation**: The NetworkPolicy (`k8s/network-policy.yaml`) blocks all ingress traffic except port `3000`, and restricts egress traffic exclusively to DNS (port 53), MongoDB (port 27017), Redis (port 6379), and Kafka (port 9092).

---

## 8. CIS Docker & Kubernetes Compliance Checklist

| Controls / Standards | Checked | Verification Details / File Location |
| :--- | :---: | :--- |
| **Non-root Container Execution** | [x] | `Dockerfile` invokes `USER appuser` before container runtime execution. |
| **Credential Secret Separation** | [x] | Base64 configs separated into `k8s/secret.yaml` and loaded dynamically. |
| **Kubernetes Resource Limits** | [x] | `k8s/app-deployment.yaml` sets CPU limits to `500m` and memory limits to `256Mi`. |
| **Liveness & Readiness Probes** | [x] | Probes query the `/health` endpoint to monitor container responsiveness. |
| **Cluster Network Policy Isolation**| [x] | `k8s/network-policy.yaml` blocks egress access to external internet domains. |

---

## 9. Jest Integration Test Execution Logs

Executing the testing command `npm run test` generates the following output logs:

```text
> inventory-management-ssdd-final@1.0.0 test
> jest --runInBand --detectOpenHandles --forceExit

  console.log
    Kafka Producer connected.
      at log (server.js:140:13)

  console.log
    MongoDB connected: mongodb://localhost:27017/inventoryhub
      at log (server.js:407:13)

PASS ./server.test.js
  InventoryHub Secure API Suite (In-Memory Verification)
    POST /api/auth/register
      √ should successfully register an admin user when authorized as admin (134 ms)
      √ should successfully register a staff user when authorized as admin (130 ms)
      √ should reject registration attempts without authorization header (21 ms)
      √ should reject registration attempts by a staff user (157 ms)
      √ should reject registration attempts with XSS script tags when authorized (18 ms)
    POST /api/auth/login
      √ should login admin successfully and return a JWT token (126 ms)
      √ should login staff successfully and return a JWT token (126 ms)
      √ should reject invalid login credentials (136 ms)
    POST /api/products
      √ should allow admin to create a new product (28 ms)
      √ should reject product creation with invalid schema data (negative quantity) (20 ms)
      √ should reject product creation containing suspected XSS / script tags (19 ms)
    DELETE /api/products/:id
      √ should deny staff from deleting a product (35 ms)
      √ should allow admin to successfully delete a product (26 ms)
    Admin-Only RBAC Endpoints
      √ should deny staff from accessing audit logs (18 ms)
      √ should allow admin to view audit logs (15 ms)
      √ should deny staff from accessing security alerts (15 ms)
      √ should allow admin to view security alerts (15 ms)
    OIDC Mock Identity Integration
      √ should issue a valid OIDC JWT token and access products successfully (32 ms)
      √ should reject OIDC token request without username or role (15 ms)

Test Suites: 1 passed, 1 total
Tests:       19 passed, 19 total
Snapshots:   0 total
Time:        2.598 s, estimated 4 s
Ran all test suites.
```

---

## 10. Step-by-Step Screenshot Verification Guide

To compile visual proof of your project's security controls for your teacher, follow these instructions to take and save each screenshot:

### Step 1: Create the Images Folder
Ensure a directory named `images` exists inside the `reports` directory. 
- Path: `reports/images/`

---

### Screenshot 1: Jest Test Pass Output
- **Objective**: Show that all 19 test specs pass.
- **Action**: Run the tests in your command line:
  ```bash
  npm run test
  ```
- **How to Capture**: Take a screenshot of the terminal window showing the final green summary block:
  ```text
  PASS ./server.test.js
  Test Suites: 1 passed, 1 total
  Tests:       19 passed, 19 total
  ```
- **Save Location**: Save the image as `reports/images/jest_test_pass.png`
- **Markdown Render**:
  ![Jest Test Pass](images/jest_test_pass.png)

---

### Screenshot 2: Input Validation Block (XSS Defense)
- **Objective**: Prove that the application intercepts and blocks script injections.
- **Action**:
  1. Start the server locally (`npm start`).
  2. Open the landing page at `http://localhost:3000`.
  3. Go to the Staff Portal Login page.
  4. Open Browser Developer Tools (`F12` or right-click -> `Inspect`) and navigate to the **Network** tab.
  5. In the login box, type `<script>alert('hack')</script>` in the Username field, enter any password, and click **Sign In**.
- **How to Capture**: Take a screenshot showing the browser alert displaying the validation error or the network request to `/api/auth/login` returning status `400 Bad Request` with Zod validation messages.
- **Save Location**: Save the image as `reports/images/xss_validation_block.png`
- **Markdown Render**:
  ![XSS Validation Block](images/xss_validation_block.png)

---

### Screenshot 3: Role-Based Access Control Block (RBAC)
- **Objective**: Prove that a user with the `staff` role cannot delete inventory products.
- **Action**:
  1. Log in to the application as a staff member (Username: `staff`, Password: `staffpassword`).
  2. In the products dashboard table, click the **Delete** button next to any product.
  3. The interface will block the request and show a red error popup or error toast.
- **How to Capture**: Capture the browser interface showing the error message, along with the Network tab showing a status `403 Forbidden` response for the request to `DELETE /api/products/<id>`.
- **Save Location**: Save the image as `reports/images/rbac_permission_deny.png`
- **Markdown Render**:
  ![RBAC Permission Denied](images/rbac_permission_deny.png)

---

### Screenshot 4: Security Alerts Admin Dashboard
- **Objective**: Demonstrate that administrators have visibility into the audit logs and real-time security alerts.
- **Action**:
  1. Log in to the application as the administrator (Username: `admin`, Password: `adminpassword`).
  2. Scroll to the bottom of the dashboard page to locate the **Security Alerts** and **System Audit Logs** tables.
  3. You will see historical entries (e.g. `USER_REGISTERED`, `LOGIN_SUCCESS`, or warnings about the failed login attempts or staff deletion attempts).
- **How to Capture**: Take a screenshot showing the populated alerts table with rows displaying the details, timestamp, and severity levels.
- **Save Location**: Save the image as `reports/images/security_alerts_dashboard.png`
- **Markdown Render**:
  ![Security Alerts Dashboard](images/security_alerts_dashboard.png)

---

### Screenshot 5: Trivy Image Vulnerability Scan
- **Objective**: Show container security scanning is functional and returned clean.
- **Action**:
  If you have Trivy installed, run the scanner on the application image:
  ```bash
  docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image inventory-hub:latest
  ```
- **How to Capture**: Take a screenshot of the CLI summary showing the vulnerability table and status output.
- **Save Location**: Save the image as `reports/images/trivy_image_scan.png`
- **Markdown Render**:
  ![Trivy Image Scan](images/trivy_image_scan.png)

---

### Screenshot 6: Kubernetes Resource Deployment Status
- **Objective**: Prove all Kubernetes security contexts and network policies are successfully applied in your cluster.
- **Action**:
  Run this command in your kubectl context:
  ```bash
  kubectl get pods,svc,netpol -o wide
  ```
- **How to Capture**: Capture the terminal showing running pods for the application, MongoDB, Redis, Kafka, and the active network policies.
- **Save Location**: Save the image as `reports/images/k8s_resources_active.png`
- **Markdown Render**:
  ![Kubernetes Resources Active](images/k8s_resources_active.png)
