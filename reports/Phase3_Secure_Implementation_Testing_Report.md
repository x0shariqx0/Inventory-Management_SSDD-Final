# Phase 3: Secure Implementation & Testing Report

This report documents the security improvements, defensive design features, threat mitigation, and vulnerability testing implemented for the InventoryHub application.

---

## 1. Defensive Design & Security Implementations

We hardened the Node.js/Express backend by introducing defensive middleware to mitigate common web application threats:

- **HTTP Headers Hardening (Helmet)**: Sets standard HTTP headers to protect against clickjacking, mime-sniffing, cross-site scripting (XSS), and cross-site requests.
- **Rate Limiting**: Configured `express-rate-limit` to prevent brute-force attacks and denial-of-service (DoS) attempts:
  - General API requests limited to 100 requests per 15 minutes.
  - Login and registration paths restricted to 20 attempts per 15 minutes.
- **Request Size Limiting**: Configured body parsing middleware to limit incoming JSON payloads to a maximum of `10kb`, mitigating large-body DoS vulnerabilities.
- **CORS Protection**: Restricted Cross-Origin Resource Sharing (CORS) using a controlled whitelist retrieved from the `CLIENT_ORIGIN` environment variable.

---

## 2. Authentication & Role-Based Access Control (RBAC)

We introduced a comprehensive user identity and privilege management system:
- **Authentication**: Secured routes via **JWT (JSON Web Token)** authorization headers (`Bearer <token>`). User passwords are securely hashed using **bcryptjs** with a work factor of 10.
- **User Roles**: Defined roles: `admin` and `staff` (with pre-seeded test credentials: `admin` / `adminpassword` and `staff` / `staffpassword`).
- **RBAC Matrix**:
  - `admin` role has full permissions to create, read, update, and delete products, and read audit logs and security alerts.
  - `staff` role can read, create, and update products, but cannot delete products, nor access audit logs or security alerts.

---

## 3. Input Validation & Injection Prevention

To stop SQL injection (SQLi) and Cross-Site Scripting (XSS):
- Integrated **Zod** schema validation to enforce strict datatype check boundaries (e.g. name/category are non-empty strings, quantity/price are numbers >= 0).
- Configured Zod refinements to inspect string inputs and actively block payload sequences:
  - Reject `<script>` tags (`/<[^>]*script/i`).
  - Reject suspicious inputs containing SQL commands or tags (`/[\'\"]\s*(or|and)\s*[\'\"]|--|<[^>]+>/i`).

---

## 4. Audit Logging & Security Alerts

We created audit log and alert tables inside MongoDB:
- **Audit Logs**: Records logins, logins failures, CRUD operations, unauthorized access, and major stock deviations. Logs record the performing user, timestamps, actions, target resources, and client IP addresses.
- **Security Alerts**: Implemented real-time anomaly detection triggers:
  - *Brute force*: Triggers critical alert when failed login attempts exceed 5 in 10 minutes (cached via Redis).
  - *Large stock change*: Triggers medium/high alert when a product's stock is created or changed by > 100.
  - *Unauthorized deletion*: Triggers high alert when staff attempts to call the delete endpoint.
  - *Repeated deletions*: Triggers critical alert if > 3 products are deleted in under 1 minute.

---

## 5. Redis & Kafka Integrations

- **Redis**: Integrated `ioredis` to manage brute-force failed-login counts (`failed_login:<username>`) with a 10-minute timeout window.
- **Kafka**: Integrated `kafkajs` to stream security events (e.g. `product.created`, `security.unauthorized_access`) to the `inventory-events` topic.
- **Fallback System**: Built database fallbacks and connection checks so that if Redis or Kafka are offline, the app fails gracefully without crashing.

---

## 6. Static Analysis & Security Scanning

### CodeQL Static Analysis
CodeQL is configured via `.github/workflows/codeql.yml` to automatically analyze changes pushed to GitHub.
- Run locally or on GitHub to inspect for code quality, query injection, and credentials leakage.

### OWASP ZAP API Scan
OWASP ZAP scans the application endpoints for active vulnerabilities.
- Run a baseline scan using Docker:
  ```bash
  docker run -t ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py -t http://host.docker.internal:3000/api/products -f openapi
  ```

---

## 7. Testing Results & Evidence

### Test Suite Execution
Run the automated Jest suite to verify secure APIs and role permissions:
```bash
npm test
```

### Screenshots Placeholders
*Insert evidence screenshots here to complete lab report:*
1. **[Screenshot: Jest Test Pass]**: Captured output showing 15/15 successful tests.
2. **[Screenshot: Validation Block]**: Zod blocking XSS payload script tags with a `400 Bad Request`.
3. **[Screenshot: RBAC Block]**: Staff user blocked from deleting products with a `403 Forbidden`.
4. **[Screenshot: Live Audit Logs / Alerts]**: Admin panel displaying live logged events and security warnings.
