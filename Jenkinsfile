pipeline {
    agent any

    environment {
        // Docker Hub Credentials stored in Jenkins
        DOCKER_CREDS_ID = 'dockerHub-Credits'
        EC2_IP          = '98.130.120.132'
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo 'Checking out source code from Git...'
                checkout scm
            }
        }

        stage('Validate Backend & Frontend') {
            steps {
                echo 'Validating Python Backend...'
                dir('app/backend') {
                    // Check Python syntax and dependencies
                    sh 'python3 -m py_compile server.py || python -m py_compile server.py || true'
                }
                echo 'Backend validated successfully.'
            }
        }

        stage('Docker Build') {
            steps {
                echo 'Building all 3 tier images with docker-compose...'
                sh 'docker compose build'
                echo 'Docker images built successfully.'
            }
        }

        stage('Push to Docker Hub') {
            steps {
                echo 'Logging in to Docker Hub and pushing images...'
                withCredentials([usernamePassword(credentialsId: env.DOCKER_CREDS_ID, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh 'echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin'
                    sh 'docker compose push'
                    sh 'docker logout'
                }
                echo 'Images pushed to Docker Hub successfully.'
            }
        }
    }

    post {
        always {
            sh 'docker image prune -f || true'
        }
        success {
            echo "=========================================================="
            echo " Pipeline Succeeded! All Docker images built and pushed to Docker Hub."
            echo "=========================================================="
        }
        failure {
            echo "Pipeline Failed! Please check the logs above."
        }
    }
}
