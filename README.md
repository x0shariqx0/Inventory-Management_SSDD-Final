# InventoryHub - Secure Software Development (SSDD) Project

InventoryHub is a simple inventory management web application created for the Secure Software Development (SSDD) project. It uses Node.js, Express and MongoDB. It can be containerized with Docker, deployed on Kubernetes, automated through Jenkins, and monitored using Prometheus and Grafana.

## Project Features

- Add inventory products with name, category, quantity and price
- Store product data in MongoDB
- View all saved products from the web interface
- Delete products
- Health check endpoint for Kubernetes probes
- Prometheus metrics endpoint at `/metrics`
- Kubernetes deployment with MongoDB PVC
- Jenkins CI/CD pipeline
- Prometheus ServiceMonitor and Grafana dashboard JSON

## Folder Structure

```text
Inventory-Management_SSDD-Final/
├── src/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── k8s/
│   ├── mongo-pvc.yaml
│   ├── mongo-deployment.yaml
│   ├── mongo-service.yaml
│   ├── app-deployment.yaml
│   ├── app-service.yaml
│   ├── app-hpa.yaml
│   └── commands.txt
├── monitoring/
│   ├── prometheus-values.yaml
│   ├── servicemonitor.yaml
│   └── grafana-dashboard-inventoryhub.json
├── server.js
├── package.json
├── Dockerfile
├── Jenkinsfile
├── .env.example
├── .dockerignore
├── .gitignore
├── REPORT_GUIDE.md
└── SCREENSHOTS_CHECKLIST.md
```

## Run Locally

Install dependencies:

```bash
npm install
```

Create `.env` file:

```bash
cp .env.example .env
```

Start MongoDB locally, then run:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Check health:

```text
http://localhost:3000/health
```

Check metrics:

```text
http://localhost:3000/metrics
```

## Push Project to GitHub

```bash
git init
git add .
git commit -m "Initial InventoryHub SSDD project"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/Inventory-Management_SSDD-Final.git
git push -u origin main
```

## Important Replacement Before Jenkins

Replace this placeholder in `Jenkinsfile` and `k8s/app-deployment.yaml`:

```text
DOCKERHUB_USERNAME/inventory-hub
```

Example:

```text
umair4004/inventory-hub
```

## Manual Docker Commands

Build Docker image:

```bash
docker build -t DOCKERHUB_USERNAME/inventory-hub:latest .
```

Login to DockerHub:

```bash
docker login
```

Push image:

```bash
docker push DOCKERHUB_USERNAME/inventory-hub:latest
```

## Kubernetes Deployment Commands

Apply MongoDB storage and database files:

```bash
kubectl apply -f k8s/mongo-pvc.yaml
kubectl apply -f k8s/mongo-deployment.yaml
kubectl apply -f k8s/mongo-service.yaml
```

Apply application files:

```bash
kubectl apply -f k8s/app-deployment.yaml
kubectl apply -f k8s/app-service.yaml
kubectl apply -f k8s/app-hpa.yaml
```

Check deployment:

```bash
kubectl get pods
kubectl get deployments
kubectl get svc
kubectl get pvc
kubectl get hpa
```

Port forward application:

```bash
kubectl port-forward svc/inventory-hub-service 8080:80 --address=0.0.0.0
```

Open in browser:

```text
http://EC2_PUBLIC_IP:8080
```

## Jenkins Pipeline

The `Jenkinsfile` contains these stages:

1. Code Fetch Stage
2. Docker Image Creation Stage
3. DockerHub Push Stage
4. Kubernetes Deployment Stage
5. Prometheus Grafana Stage

In Jenkins, create a DockerHub credential with this ID:

```text
dockerhub
```

Use your DockerHub username and DockerHub access token/password in that credential.

## Prometheus and Grafana Setup

Install kube-prometheus-stack using Helm:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace -f monitoring/prometheus-values.yaml
```

Apply ServiceMonitor:

```bash
kubectl apply -f monitoring/servicemonitor.yaml
```

Port forward Grafana:

```bash
kubectl -n monitoring port-forward svc/monitoring-grafana 3000:80 --address=0.0.0.0
```

Open:

```text
http://EC2_PUBLIC_IP:3000
```

Default login:

```text
Username: admin
Password: prom-operator
```

Import dashboard file:

```text
monitoring/grafana-dashboard-inventoryhub.json
```

## Useful Testing Commands

Generate traffic for metrics:

```bash
while true; do curl -s http://localhost:8080/health > /dev/null; sleep 1; done
```

Check application metrics:

```bash
curl http://localhost:8080/metrics
```

Check pods:

```bash
kubectl get pods -o wide
```

Check application logs:

```bash
kubectl logs -l app=inventory-hub
```

## Report Submission

Use `REPORT_GUIDE.md` for the report format and `SCREENSHOTS_CHECKLIST.md` for screenshots you should capture.
