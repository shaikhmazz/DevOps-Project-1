pipeline {
    agent any

    environment {
        // Change to your Docker Hub username
        DOCKER_HUB_USER = 'your-dockerhub-username'

        // 3-Tier Image Names
        FRONTEND_IMAGE  = 'streamflix-frontend'
        BACKEND_IMAGE   = 'streamflix-backend'
        DATABASE_IMAGE  = 'streamflix-database'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out source code...'
                checkout scm
            }
        }

        stage('Build 3-Tier Docker Images') {
            steps {
                echo "=== Building Tier 1: Frontend (React / Vite) ==="
                sh "docker build -t ${DOCKER_HUB_USER}/${FRONTEND_IMAGE}:latest -t ${DOCKER_HUB_USER}/${FRONTEND_IMAGE}:${BUILD_NUMBER} ./app/frontend"

                echo "=== Building Tier 2: Backend (FastAPI) ==="
                sh "docker build -t ${DOCKER_HUB_USER}/${BACKEND_IMAGE}:latest -t ${DOCKER_HUB_USER}/${BACKEND_IMAGE}:${BUILD_NUMBER} ./app/backend"

                echo "=== Building Tier 3: Database (MongoDB) ==="
                sh "docker build -t ${DOCKER_HUB_USER}/${DATABASE_IMAGE}:latest -t ${DOCKER_HUB_USER}/${DATABASE_IMAGE}:${BUILD_NUMBER} ./app/database"
            }
        }

        stage('Push Images to Docker Hub') {
            steps {
                echo "Logging into Docker Hub and pushing all 3 tier images..."
                withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'DH_USER', passwordVariable: 'DH_PASS')]) {
                    sh 'echo "$DH_PASS" | docker login -u "$DH_USER" --password-stdin'

                    // Push Tier 1: Frontend
                    sh "docker push ${DOCKER_HUB_USER}/${FRONTEND_IMAGE}:latest"
                    sh "docker push ${DOCKER_HUB_USER}/${FRONTEND_IMAGE}:${BUILD_NUMBER}"

                    // Push Tier 2: Backend
                    sh "docker push ${DOCKER_HUB_USER}/${BACKEND_IMAGE}:latest"
                    sh "docker push ${DOCKER_HUB_USER}/${BACKEND_IMAGE}:${BUILD_NUMBER}"

                    // Push Tier 3: Database
                    sh "docker push ${DOCKER_HUB_USER}/${DATABASE_IMAGE}:latest"
                    sh "docker push ${DOCKER_HUB_USER}/${DATABASE_IMAGE}:${BUILD_NUMBER}"

                    sh 'docker logout'
                }
            }
        }
    }

    post {
        always {
            sh 'docker image prune -f || true'
        }
        success {
            echo "=========================================================="
            echo " All 3 tiers built & pushed successfully for Kubernetes!"
            echo " 1. Frontend: ${DOCKER_HUB_USER}/${FRONTEND_IMAGE}:latest"
            echo " 2. Backend:  ${DOCKER_HUB_USER}/${BACKEND_IMAGE}:latest"
            echo " 3. Database: ${DOCKER_HUB_USER}/${DATABASE_IMAGE}:latest"
            echo "=========================================================="
        }
        failure {
            echo "Pipeline failed! Please check the logs above."
        }
    }
}
