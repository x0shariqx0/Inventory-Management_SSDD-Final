# InventoryHub - Secure Software Development (SSDD) Project

InventoryHub is a simple inventory management web application created for the Secure Software Development (SSDD) project. It uses Node.js, Express and MongoDB. It can be containerized with Docker, deployed on Kubernetes, automated through Jenkins, and monitored using Prometheus and Grafana.

## Project Features

- Add inventory products with name, category, quantity and price
- Store product data in MongoDB
- View all saved products from the web interface
- Delete products
- Health check endpoint for Kubernetes probes
- Kubernetes deployment with MongoDB PVC

## Folder Structure

```text
Inventory-Management_SSDD-Final/
├── k8s/
│   ├── app-deployment.yaml
│   ├── app-hpa.yaml
│   ├── app-service.yaml
│   ├── mongo-deployment.yaml
│   ├── mongo-pv.yaml
│   ├── mongo-pvc.yaml
│   └── mongo-service.yaml
├── src/
│   ├── app.js
│   ├── index.html
│   └── style.css
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── Jenkinsfile
├── README.md
├── docker-compose.yml
├── package.json
├── sample-products.http
└── server.js
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

## Push Project to GitHub

```bash
git init
git add .
git commit -m "Initial InventoryHub SSDD project"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/Inventory-Management_SSDD-Final.git
git push -u origin main
```

## Important Replacement Before Deploying

Replace this placeholder in `k8s/app-deployment.yaml`:

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

## Useful Testing Commands

Check pods:

```bash
kubectl get pods -o wide
```

Check application logs:

```bash
kubectl logs -l app=inventory-hub
```


