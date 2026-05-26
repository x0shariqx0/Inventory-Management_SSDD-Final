# CIS Docker & Kubernetes Security Compliance Checklist

This checklist tracks security compliance with Center for Internet Security (CIS) standards for Docker and Kubernetes configurations in the InventoryHub project.

## Compliance Checklist

| Controls / Standards | Checked | Details / Manifest Location |
| :--- | :---: | :--- |
| **Non-root Docker Container** | [x] | `Dockerfile` creates `appuser:appgroup` and invokes `USER appuser` before container runtime execution. |
| **No Hardcoded Secrets** | [x] | All environment variables and connection string credentials are dynamically loaded. |
| **`.dockerignore` Configured** | [x] | Excludes node_modules, git state, .env file, reports, tests, and documentation from the Docker build context. |
| **Kubernetes Resource Limits** | [x] | `k8s/app-deployment.yaml` sets container CPU/Memory requests (`100m`/`128Mi`) and limits (`500m`/`256Mi`). |
| **Liveness & Readiness Probes** | [x] | `k8s/app-deployment.yaml` uses `/health` endpoint with custom initial delays and period intervals. |
| **Kubernetes Secrets Utilized** | [x] | `k8s/secret.yaml` holds base64 encoded strings; `k8s/app-deployment.yaml` loads these properties dynamically. |
| **NetworkPolicy Configured** | [x] | `k8s/network-policy.yaml` restricts incoming traffic to port 3000 and restricts egress to database, cache, and message broker. |
| **Trivy Image Scan Performed** | [x] | Local image build scanned for vulnerabilities and documented. |
| **CodeQL Scan Configured** | [x] | `.github/workflows/codeql.yml` scans Node.js code on commits and pull requests. |
| **OWASP ZAP API Scan Performed**| [x] | API vulnerabilities check documented. |
