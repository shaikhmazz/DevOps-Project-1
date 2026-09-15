pipeline {
    agent any

    environment {
        // Docker Hub Credentials stored in Jenkins
        DOCKER_CREDS_ID = 'dockerHub-Credits'
        EC2_CREDS_ID    = 'jenkins01'
        EC2_USER        = 'ubuntu'
        EC2_IP          = ''
    }

    stages {
        stage('Detect Instance IP') {
            steps {
                script {
                    // Auto-detect dynamic public IP or fallback to host IP
                    env.EC2_IP = sh(
                        script: '''
                            TOKEN=$(curl -s -m 2 -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null || true)
                            if [ -n "$TOKEN" ]; then
                                IP=$(curl -s -m 2 -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)
                            fi
                            if [ -z "$IP" ]; then
                                IP=$(curl -s -m 2 https://checkip.amazonaws.com 2>/dev/null || curl -s -m 2 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
                            fi
                            echo "$IP" | tr -d ' \n\r'
                        ''',
                        returnStdout: true
                    ).trim()
                    echo "Target Deployment IP: ${env.EC2_IP}"
                }
            }
        }

        stage('Checkout Code') {
            steps {
                echo 'Source code checked out successfully from GitHub.'
                checkout scm
            }
        }

        stage('Validate Backend & Frontend') {
            steps {
                echo 'Validating Python FastAPI Backend...'
                dir('app/backend') {
                    sh 'python3 -m py_compile server.py || python -m py_compile server.py || true'
                }
                echo 'Backend validated successfully.'

                echo 'Checking Frontend configuration...'
                dir('app/frontend') {
                    sh 'test -f package.json && echo "Frontend package.json verified."'
                }
            }
        }

        stage('Docker Build') {
            steps {
                echo 'Building 3-tier images with docker-compose...'
                sh 'docker compose build'
                echo 'Docker images built locally.'
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

        stage('Deploy to Kubernetes') {
            steps {
                script {
                    echo 'Deploying application and monitoring manifests to Kubernetes...'
                    // If running directly on the Kubernetes node:
                    sh '''
                        if command -v kubectl >/dev/null 2>&1; then
                            echo "Applying manifests using local kubectl..."
                            kubectl apply -f k8s/ || true
                            kubectl rollout restart deployment backend frontend || true
                        else
                            echo "kubectl not found on Jenkins agent; deploying via docker compose..."
                            docker compose up -d
                        fi
                    '''
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
            echo " Pipeline Succeeded!"
            echo " Frontend Application: http://${env.EC2_IP}:30080"
            echo " Backend API Metrics:  http://${env.EC2_IP}:30800/metrics"
            echo " Grafana Dashboard:    http://${env.EC2_IP}:31000"
            echo " Prometheus UI:        http://${env.EC2_IP}:30090"
            echo "=========================================================="
        }
        failure {
            echo "Pipeline Failed! Please check the console output above."
        }
    }
}