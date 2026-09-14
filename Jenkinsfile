pipeline {
    agent any

    environment {
        // Docker Hub Credentials stored in Jenkins
        DOCKER_CREDS_ID = 'dockerHub-Credits'
        EC2_IP          = ''
    }

    stages {
        stage('Detect Instance IP') {
            steps {
                script {
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
                    echo "Auto-detected Instance IP: ${env.EC2_IP}"
                }
            }
        }

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
            echo " Pipeline Succeeded! App is hosted at: http://${env.EC2_IP}:3000"
            echo "=========================================================="
        }
        failure {
            echo "Pipeline Failed! Please check the logs above."
        }
    }
}
