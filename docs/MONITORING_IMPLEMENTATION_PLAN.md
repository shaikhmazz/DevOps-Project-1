# 1. Objective

Modify this repository and deployment configuration so that the already deployed ALPHA application includes monitoring.

The monitoring implementation must provide:

1. Host/server metrics using Node Exporter.
2. Container metrics using cAdvisor.
3. FastAPI backend application metrics using Prometheus instrumentation.
4. Metrics collection using Prometheus.
5. Visualization using Grafana.
6. Support for existing Docker Compose deployment or existing Kubernetes deployment.
7. Non-destructive changes to the currently running application.

---

## 2. Agent Rules

Antigravity must follow these rules:

1. Do not delete the existing application deployment.
2. Do not change the application frontend behavior.
3. Do not change the backend business logic unless required for metrics.
4. Prefer additive changes only.
5. Preserve existing Docker network, volumes, ports, and service names.
6. Preserve existing Kubernetes manifests unless monitoring requires updates.
7. Do not expose MongoDB publicly.
8. Do not expose Node Exporter publicly.
9. Avoid exposing Prometheus publicly unless required.
10. Grafana should be accessible, but preferably restricted or protected.
11. If deployment target is unclear, create both Docker Compose and Kubernetes monitoring configurations.
12. All changes must be documented.

---

## 3. Existing Application Architecture

The project contains:

1. Frontend:
   - React app served by Nginx.
   - Docker service name: frontend.
   - Kubernetes service name: frontend.
   - Exposed on port 3000 for Docker Compose.
   - Exposed on NodePort 30080 for Kubernetes.

2. Backend:
   - FastAPI Python app.
   - Docker service name: backend.
   - Kubernetes service name: backend.
   - Exposed on port 8000.
   - Needs Prometheus metrics endpoint at /metrics.

3. Database:
   - MongoDB.
   - Docker service name: database.
   - Kubernetes service name: database.
   - Internal database service.
   - Should not be publicly exposed.

4. Deployment methods:
   - Docker Compose using docker-compose.yml.
   - Kubernetes using kubernetes.yaml or k8s directory.

---

## 4. Required Backend Change

Add Prometheus metrics support to the FastAPI backend.

### 4.1 File to modify

    app/backend/requirements.txt

Add this dependency:

    prometheus-fastapi-instrumentator==7.0.0

### 4.2 File to modify

    app/backend/server.py

Add this import near the top:

    from prometheus_fastapi_instrumentator import Instrumentator

After the FastAPI app object is created, add:

    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

Example:

    from fastapi import FastAPI
    from prometheus_fastapi_instrumentator import Instrumentator

    app = FastAPI()

    Instrumentator().instrument(app).expose(app, endpoint="/metrics")

### 4.3 Expected result

Backend should expose:

    /metrics

Example URLs:

Docker Compose:

    http://localhost:8000/metrics
    http://EC2_PUBLIC_IP:8000/metrics

Kubernetes local port-forward:

    http://localhost:8000/metrics

---

## 5. Create Monitoring Directory

Create:

    monitoring/
    monitoring/prometheus.yml
    monitoring/k8s/

Recommended structure:

    DevOps-Project-1/
    ├── app/
    ├── k8s/
    ├── monitoring/
    │   ├── prometheus.yml
    │   ├── docker-compose.monitoring.yml
    │   └── k8s/
    │       └── backend-servicemonitor.yaml
    ├── docker-compose.yml
    └── kubernetes.yaml

---

## 6. Prometheus Configuration

Create file:

    monitoring/prometheus.yml

Content:

    global:
      scrape_interval: 15s

    scrape_configs:
      - job_name: 'prometheus'
        static_configs:
          - targets: ['localhost:9090']

      - job_name: 'node-exporter'
        static_configs:
          - targets: ['node-exporter:9100']

      - job_name: 'cadvisor'
        static_configs:
          - targets: ['cadvisor:8080']

      - job_name: 'alpha-backend'
        metrics_path: '/metrics'
        static_configs:
          - targets: ['backend:8000']

Notes:

1. The backend target uses Docker service name backend.
2. If Docker DNS name backend does not resolve, try container name alpha-backend.
3. For Kubernetes, this file may not be used if kube-prometheus-stack is installed.

---

## 7. Docker Compose Monitoring Changes

Use this section if the project is deployed using Docker Compose.

### 7.1 Preferred method

Add monitoring services directly into the existing docker-compose.yml so all services share the same Docker network.

### 7.2 Services to add

Add these services under the existing services section in docker-compose.yml:

    prometheus:
      image: prom/prometheus:latest
      container_name: prometheus
      restart: unless-stopped
      volumes:
        - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
        - prometheus_data:/prometheus
      command:
        - '--config.file=/etc/prometheus/prometheus.yml'
        - '--storage.tsdb.path=/prometheus'
      ports:
        - "9090:9090"
      networks:
        - app-network

    grafana:
      image: grafana/grafana:latest
      container_name: grafana
      restart: unless-stopped
      ports:
        - "3001:3000"
      environment:
        - GF_SECURITY_ADMIN_USER=admin
        - GF_SECURITY_ADMIN_PASSWORD=admin
      volumes:
        - grafana_data:/var/lib/grafana
      networks:
        - app-network

    node-exporter:
      image: prom/node-exporter:latest
      container_name: node-exporter
      restart: unless-stopped
      command:
        - '--path.rootfs=/host'
      pid: host
      volumes:
        - /:/host:ro,rslave
      networks:
        - app-network

    cadvisor:
      image: gcr.io/cadvisor/cadvisor:latest
      container_name: cadvisor
      restart: unless-stopped
      privileged: true
      volumes:
        - /:/rootfs:ro
        - /var/run:/var/run:ro
        - /sys:/sys:ro
        - /var/lib/docker/:/var/lib/docker:ro
        - /dev/disk/:/dev/disk/:ro
      devices:
        - /dev/kmsg
      networks:
        - app-network

### 7.3 Volumes to add

Ensure top-level volumes include:

    volumes:
      db-data:
      prometheus_data:
      grafana_data:

### 7.4 Network requirement

All monitoring services must use the same Docker network as the application.

Existing network is likely:

    app-network

All monitoring services must include:

    networks:
      - app-network

### 7.5 Docker Compose validation commands

Validate compose syntax:

    docker compose config -q

Start or update stack:

    docker compose up -d

Check containers:

    docker compose ps

Check logs:

    docker compose logs -f prometheus grafana node-exporter cadvisor backend

### 7.6 Docker Compose access URLs

Frontend:

    http://EC2_PUBLIC_IP:3000

Backend API:

    http://EC2_PUBLIC_IP:8000

Backend metrics:

    http://EC2_PUBLIC_IP:8000/metrics

Prometheus:

    http://EC2_PUBLIC_IP:9090

Grafana:

    http://EC2_PUBLIC_IP:3001

---

## 8. Kubernetes Monitoring Changes

Use this section if the project is deployed using Kubernetes.

### 8.1 Recommended Kubernetes monitoring stack

Do not manually deploy Prometheus, Grafana, Node Exporter, and cAdvisor with raw manifests unless required.

Use kube-prometheus-stack:

    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update

    helm install monitoring prometheus-community/kube-prometheus-stack \
      --namespace monitoring \
      --create-namespace

This installs:

1. Prometheus.
2. Grafana.
3. Alertmanager.
4. Node Exporter.
5. kube-state-metrics.
6. Kubernetes dashboards.

### 8.2 Backend ServiceMonitor

Create file:

    monitoring/k8s/backend-servicemonitor.yaml

Content:

    apiVersion: monitoring.coreos.com/v1
    kind: ServiceMonitor
    metadata:
      name: alpha-backend
      namespace: monitoring
      labels:
        release: monitoring
    spec:
      namespaceSelector:
        matchNames:
          - alpha
      selector:
        matchLabels:
          app: backend
      endpoints:
        - targetPort: 8000
          path: /metrics
          interval: 15s

Important:

1. Replace namespace alpha with the actual application namespace if different.
2. Replace selector labels with the actual backend service labels.
3. The label release: monitoring must match the Prometheus Operator selector used by kube-prometheus-stack.

### 8.3 Find backend service labels

Run:

    kubectl get svc -n alpha
    kubectl get svc backend -n alpha --show-labels

If backend service labels are different, update:

    spec:
      selector:
        matchLabels:

Example:

If labels show:

    app.kubernetes.io/name=backend

Then use:

    selector:
      matchLabels:
        app.kubernetes.io/name: backend

### 8.4 Apply ServiceMonitor

    kubectl apply -f monitoring/k8s/backend-servicemonitor.yaml

### 8.5 Kubernetes validation commands

Check monitoring namespace:

    kubectl get pods -n monitoring

Check application namespace:

    kubectl get pods -n alpha
    kubectl get svc -n alpha

Check ServiceMonitor:

    kubectl get servicemonitors -n monitoring

Port-forward Prometheus:

    kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090

Prometheus UI:

    http://localhost:9090

Port-forward Grafana:

    kubectl port-forward -n monitoring svc/monitoring-grafana 3001:80

Grafana UI:

    http://localhost:3001

Default Grafana credentials for kube-prometheus-stack are usually:

    Username: admin
    Password: prom-operator

---

## 9. AWS EC2 Security Group Rules

For Docker Compose deployment, allow these inbound rules:

| Port | Service    | Recommended Source      |
| ---: | ---------- | ----------------------- |
|   22 | SSH        | Your IP only            |
| 3000 | Frontend   | Public or Your IP       |
| 8000 | Backend    | Your IP if possible     |
| 3001 | Grafana    | Your IP only            |
| 9090 | Prometheus | Your IP only or private |

Do not publicly expose:

|  Port | Service       |
| ----: | ------------- |
| 27017 | MongoDB       |
|  9100 | Node Exporter |
|  8080 | cAdvisor      |

For Kubernetes NodePort deployment, allow:

|  Port | Service           |
| ----: | ----------------- |
| 30080 | Frontend NodePort |
| 30800 | Backend NodePort  |

If Grafana is exposed as NodePort, allow its NodePort as well.

---

## 10. Grafana Configuration

For Docker Compose:

Grafana data source URL must be:

    http://prometheus:9090

Do not use:

    http://localhost:9090

Reason:

Inside Docker, localhost from Grafana means the Grafana container, not Prometheus.

For Kubernetes:

Grafana data source is usually auto-provisioned by kube-prometheus-stack.

If manual configuration is needed, use the internal Prometheus service URL.

---

## 11. Recommended Grafana Dashboards

Import these dashboards:

| Dashboard Name               | Grafana ID |
| ---------------------------- | ---------: |
| Node Exporter Full           |       1860 |
| Docker Container Monitoring  |      14282 |
| FastAPI Prometheus Dashboard |      18308 |

For Kubernetes, kube-prometheus-stack already includes many Kubernetes dashboards.

---

## 12. Testing Checklist

Antigravity must verify the following.

### 12.1 Backend metrics

Docker Compose:

    curl http://localhost:8000/metrics

Kubernetes port-forward:

    kubectl port-forward svc/backend 8000:8000 -n alpha
    curl http://localhost:8000/metrics

Expected result:

Prometheus metrics text is returned.

---

### 12.2 Prometheus targets

Open Prometheus UI.

Docker Compose:

    http://EC2_PUBLIC_IP:9090

Kubernetes port-forward:

    http://localhost:9090

Go to:

    Status > Targets

Expected targets:

1. Prometheus: UP.
2. Node Exporter: UP.
3. cAdvisor: UP.
4. alpha-backend: UP.

---

### 12.3 Grafana

Open Grafana.

Docker Compose:

    http://EC2_PUBLIC_IP:3001

Kubernetes port-forward:

    http://localhost:3001

Verify:

1. Prometheus data source works.
2. Dashboards load.
3. Host metrics appear.
4. Container or pod metrics appear.
5. Backend request metrics appear after hitting the API.

---

## 13. Definition of Done

The task is complete when:

1. FastAPI backend exposes /metrics.
2. Prometheus is deployed.
3. Grafana is deployed.
4. Node Exporter is deployed.
5. cAdvisor is deployed for Docker Compose, or Kubernetes node metrics are available.
6. Prometheus successfully scrapes backend metrics.
7. Grafana is connected to Prometheus.
8. Dashboards show live metrics.
9. Existing application still works.
10. No database port is publicly exposed.
11. No sensitive monitoring service is unnecessarily exposed.
12. Documentation is updated.

---

## 14. Files Antigravity Should Create or Modify

### Must modify

    app/backend/requirements.txt
    app/backend/server.py

### Must create

    monitoring/prometheus.yml

### Create if Docker Compose deployment is used

    monitoring/docker-compose.monitoring.yml

Or modify:

    docker-compose.yml

### Create if Kubernetes deployment is used

    monitoring/k8s/backend-servicemonitor.yaml

### Optional documentation updates

    README.md
    docs/MONITORING_IMPLEMENTATION_PLAN.md
    docs/MONITORING_EC2_IMPLEMENTATION_PLAN.md

---

## 15. Rollback Plan

If monitoring changes break the deployment:

For Docker Compose:

    git checkout -- docker-compose.yml
    docker compose up -d

For Kubernetes:

    kubectl delete -f monitoring/k8s/backend-servicemonitor.yaml

If Helm monitoring stack needs removal:

    helm uninstall monitoring -n monitoring
    kubectl delete namespace monitoring

If backend instrumentation causes errors:

1. Remove Instrumentator code from server.py.
2. Remove prometheus-fastapi-instrumentator from requirements.txt.
3. Rebuild backend image.
4. Restart backend deployment.

---

## 16. Final Instruction to Antigravity

Apply the monitoring changes in the safest possible way.

Priority order:

1. Keep the existing application running.
2. Add backend metrics endpoint.
3. Add monitoring stack.
4. Validate Prometheus targets.
5. Validate Grafana dashboards.
6. Document all changes.
7. Do not expose internal services publicly unless required.
