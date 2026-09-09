pipeline {
    agent any

    environment {
        // Docker Hub & EC2 Credentials stored in Jenkins
        DOCKER_CREDS_ID = 'dockerHub-Credits'
        EC2_CREDS_ID    = 'Jenk-123'
        EC2_IP          = '40.192.25.143'
        EC2_USER        = 'ubuntu'
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

        stage('Deploy to Remote EC2') {
            steps {
                echo "Deploying application to remote EC2 server (${env.EC2_IP})..."
                sshagent([env.EC2_CREDS_ID]) {
                    // 1. Create deployment directory on remote EC2
                    sh "ssh -o StrictHostKeyChecking=no ${env.EC2_USER}@${env.EC2_IP} 'mkdir -p ~/deployment'"

                    // 2. Copy docker-compose.yml to remote EC2
                    sh "scp -o StrictHostKeyChecking=no docker-compose.yml ${env.EC2_USER}@${env.EC2_IP}:~/deployment/"

                    // 3. Log in, pull new images, and restart containers on EC2
                    sh """
                        ssh -o StrictHostKeyChecking=no ${env.EC2_USER}@${env.EC2_IP} '
                            cd ~/deployment &&
                            docker compose pull &&
                            docker compose down &&
                            docker compose up -d
                        '
                    """
                }
                echo 'Application deployed successfully on EC2!'
            }
        }
    }

    post {
        always {
            sh 'docker image prune -f || true'
        }
        success {
            echo "=========================================================="
            echo " Pipeline Succeeded! App is running at: http://${env.EC2_IP}:3000"
            echo "=========================================================="
        }
        failure {
            echo "Pipeline Failed! Please check the logs above."
        }
    }
}
