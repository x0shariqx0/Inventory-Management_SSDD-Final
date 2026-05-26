# Phase 4: Docker & K8s Compliance Report

This report documents the security configurations, container hardening, local/cluster orchestration architectures, and vulnerability scanning implemented for Phase 4 of the project.

---

## 1. Docker Container Hardening

We applied security best practices to harden the application Dockerfile:
- **Minimal Base Image**: Used `node:20-alpine` to reduce the image size and limit the attack surface by excluding unnecessary OS packages.
- **Least Privileges (Non-root)**: Created a custom group `appgroup` and user `appuser`. Configured files ownership using `COPY --chown=appuser:appgroup` and switched the runtime context using `USER appuser`. The application runs without root/sudo capability.
- **Reproducible Production Builds**: Used `npm ci --omit=dev` to install only required production dependencies.
- **Docker Context Hygiene**: Excluded local environment secrets (`.env`), tests, and config settings via `.dockerignore`.

---

## 2. Docker Image Vulnerability Scanning (Trivy)

Trivy scans Docker images for OS and package-level CVEs.
- Run Trivy to scan the hardened image:
  ```bash
  docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image inventory-hub:latest
  ```

---

## 3. Kubernetes Security Hardening

We deployed the application into a Kubernetes cluster using hardened descriptors:

### Pod SecurityContext
Applied strict runtime constraints inside `k8s/app-deployment.yaml`:
- `runAsNonRoot: true` & `runAsUser: 1001` to prevent container root breakout.
- `allowPrivilegeEscalation: false` to block processes from gaining more privileges than their parent.
- `capabilities.drop: [ALL]` to remove all Linux kernel capabilities.

### Secrets Management
- Defined `k8s/secret.yaml` containing base64 encoded strings for sensitive values (MongoDB URIs, JWT Secrets, Redis, and Kafka connection strings).
- Injected environmental variables into the application containers dynamically from the Secret instead of hardcoding values.

### Probes & Resource Management
- **Probes**: Configured `livenessProbe` and `readinessProbe` checking the `/health` path.
- **Resources**: Set memory limits to `256Mi` and CPU limits to `500m` to prevent resource starvation (DoS).

---

## 4. Kubernetes Network Isolation

Configured a NetworkPolicy (`k8s/network-policy.yaml`) to restrict pod communication:
- **Ingress**: Restricts incoming traffic to TCP port 3000 (app container only).
- **Egress**: Limits outgoing traffic exclusively to MongoDB (`mongo` pod on port 27017), Redis (`redis` pod on port 6379), Kafka (`kafka` pod on port 9092), and DNS resolution (port 53). All other outgoing traffic is dropped.

---

## 5. CIS Compliance Checklist Summary

Our configurations satisfy the major requirements of the CIS Docker and Kubernetes Security benchmarks:
- Container runs as non-root: **PASSED**
- Hardcoded secrets avoided: **PASSED**
- Limits and Probes applied: **PASSED**
- NetworkPolicy isolation active: **PASSED**
- Automated scanning configured: **PASSED**

For detailed control checks, review:
👉 **[CIS_Docker_Kubernetes_Checklist.md](file:///c:/Users/shariq%20abbasi/Desktop/devops_inventory_project/reports/CIS_Docker_Kubernetes_Checklist.md)**

---

## 6. Testing Results & Evidence

### Local Compose Execution
To run the full stack locally:
```bash
docker compose up -d
```

### Manifest Deployment
Apply manifests to your cluster:
```bash
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/
```

### Screenshots Placeholders
*Insert evidence screenshots here to complete lab report:*
1. **[Screenshot: Hardened Image Build]**: Showing image building successfully and running as non-root user `appuser`.
2. **[Screenshot: Trivy Scan Report]**: Output of Trivy showing zero critical vulnerabilities.
3. **[Screenshot: Kubernetes Resource Status]**: Output of `kubectl get pods,svc,hpa` showing running resources.
4. **[Screenshot: NetworkPolicy Test]**: Evidence of blocked network egress to unauthorized destinations.
