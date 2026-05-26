pipeline {
    agent any

    environment {
        DOCKERHUB_IMAGE = 'x0shariq/inventory-hub'
        DOCKER_CREDENTIALS_ID = 'dockerhub'
    }

    stages {
        stage('Code Fetch Stage') {
            steps {
                checkout scm
                sh 'ls -la'
            }
        }

        stage('Docker Image Creation Stage') {
            steps {
                sh '''
                    docker build -t $DOCKERHUB_IMAGE:$BUILD_NUMBER -t $DOCKERHUB_IMAGE:latest .
                    docker images | grep inventory-hub || true
                '''
            }
        }

        stage('DockerHub Push Stage') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: "$DOCKER_CREDENTIALS_ID",
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                        echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                        docker push $DOCKERHUB_IMAGE:$BUILD_NUMBER
                        docker push $DOCKERHUB_IMAGE:latest
                    '''
                }
            }
        }

        stage('Kubernetes Deployment Stage') {
            steps {
                sh '''
                    echo "Deploying MongoDB resources..."

                    kubectl apply -f k8s/mongo-pv.yaml
                    kubectl apply -f k8s/mongo-pvc.yaml
                    kubectl apply -f k8s/mongo-deployment.yaml
                    kubectl apply -f k8s/mongo-service.yaml

                    echo "Deploying application with image: $DOCKERHUB_IMAGE:$BUILD_NUMBER"

                    sed "s|DOCKERHUB_USERNAME/inventory-hub:latest|$DOCKERHUB_IMAGE:$BUILD_NUMBER|g" k8s/app-deployment.yaml | kubectl apply -f -

                    kubectl apply -f k8s/app-service.yaml
                    kubectl apply -f k8s/app-hpa.yaml

                    echo "Checking application rollout status..."

                    kubectl rollout status deployment/inventory-hub-deployment --timeout=120s

                    echo "Current Kubernetes resources:"

                    kubectl get pv
                    kubectl get pvc
                    kubectl get pods
                    kubectl get svc
                    kubectl get hpa
                '''
            }
        }

        stage('Prometheus Grafana Stage') {
            steps {
                sh '''
                    echo "Checking Prometheus and Grafana monitoring resources..."

                    if kubectl get namespace monitoring > /dev/null 2>&1; then
                        echo "Monitoring namespace found."

                        echo "Monitoring pods:"
                        kubectl get pods -n monitoring

                        echo "Monitoring services:"
                        kubectl get svc -n monitoring

                        echo "Prometheus and Grafana appear to be installed."
                    else
                        echo "Monitoring namespace not found."
                        echo "Prometheus and Grafana are not installed yet."
                        echo "Skipping monitoring check."
                    fi

                    echo "Application should expose metrics at /metrics endpoint."
                '''
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully.'
        }

        failure {
            echo 'Pipeline failed. Check the stage logs above.'
        }
    }
}
