# ALPHA — 3-Tier Cloud Media & Gallery Platform

[![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-Jenkins-red?logo=jenkins)](./Jenkinsfile)
[![Docker Hub](https://img.shields.io/badge/Docker-maxain27-blue?logo=docker)](https://hub.docker.com/u/maxain27)
[![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes-326ce5?logo=kubernetes)](./kubernetes.yaml)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](./app/backend)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61dafb?logo=react)](./app/frontend)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%206.0-47a248?logo=mongodb)](./app/database)

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Technical Terms & Concepts](#-key-technical-terms--concepts)
- [System Architecture](#-system-architecture)
  - [High-Level Architecture Diagram](#high-level-architecture-diagram)
  - [Network & Request Routing Flow](#network--request-routing-flow)
- [Comprehensive File & Directory Structure](#-comprehensive-file--directory-structure)
- [Step-by-Step Implementation Guide: How This Project Was Built](#-step-by-step-implementation-guide-how-this-project-was-built)
  - [Phase 1: Data Modeling & Database Engineering (Data Tier)](#phase-1-data-modeling--database-engineering-data-tier)
  - [Phase 2: Asynchronous RESTful API & Storage Logic (Backend Tier)](#phase-2-asynchronous-restful-api--storage-logic-backend-tier)
  - [Phase 3: Presentation Layer & UI/UX Engineering (Frontend Tier)](#phase-3-presentation-layer--uiux-engineering-frontend-tier)
  - [Phase 4: Multi-Container Local Orchestration (Docker Compose)](#phase-4-multi-container-local-orchestration-docker-compose)
  - [Phase 5: Automated CI/CD Pipeline Engineering (Jenkins)](#phase-5-automated-cicd-pipeline-engineering-jenkins)
  - [Phase 6: Cloud Container Orchestration & Networking (Kubernetes)](#phase-6-cloud-container-orchestration--networking-kubernetes)
- [Pre-Seeded Credentials](#-pre-seeded-credentials)
- [REST API Reference](#-rest-api-reference)
- [Getting Started & Local Setup](#-getting-started--local-setup)
  - [Option A: One-Click Launch via Docker Compose (Recommended)](#option-a-one-click-launch-via-docker-compose-recommended)
  - [Option B: Manual Standalone Setup](#option-b-manual-standalone-setup)
- [Kubernetes Deployment Guide](#-kubernetes-deployment-guide)
- [Jenkins CI/CD Pipeline Setup](#-jenkins-cicd-pipeline-setup)
- [Configuration & Environment Variables](#-configuration--environment-variables)
- [Troubleshooting & FAQs](#-troubleshooting--faqs)
- [Author & Acknowledgements](#-author--acknowledgements)

---

## 🌟 Overview

**ALPHA** is an enterprise-grade, containerized, 3-tier cloud media and photo gallery platform built with a modern, Netflix-inspired dark cinematic user interface. The platform empowers users to securely create accounts, authenticate, upload high-resolution images, manage photo galleries, view full-screen lightbox previews, perform inline metadata edits, and monitor real-time backend disk and storage metrics.

Beyond application features, this project serves as a comprehensive **real-world DevOps reference implementation**, covering:
1. **Multi-tier microservices architecture** isolating presentation, application logic, and database state.
2. **Containerization** utilizing Docker, multi-stage compilation builds, and minimal alpine/slim runtimes.
3. **Local multi-service orchestration** through Docker Compose with custom bridge networking and volume persistence.
4. **Automated Continuous Integration and Continuous Delivery (CI/CD)** via Jenkins declarative pipelines, syntax validation, container image builds, and automated Docker Hub registry deployment.
5. **Production container orchestration** through Kubernetes (K8s) featuring Deployments, PersistentVolumeClaims, NodePort services, and ClusterIP internal routing.

---

## 📚 Key Technical Terms & Concepts

Before diving into the implementation details, here is a glossary of the key engineering terms utilized throughout this repository:

| Technical Term | Definition & Context in This Project |
|---|---|
| **3-Tier Architecture** | A client-server software architecture pattern dividing applications into three logical tiers: **Presentation Tier** (React SPA), **Application Logic Tier** (FastAPI backend), and **Data Tier** (MongoDB database). |
| **Microservices** | An architectural approach where distinct functional domains run as independent, loosely coupled containerized services communicating over standard network protocols. |
| **Reverse Proxy** | An intermediate server (Nginx) that sits in front of backend applications, forwarding client requests to internal services, eliminating CORS issues, and terminating or rewriting paths (`/api/*`, `/uploads/*`). |
| **Multi-Stage Docker Build** | An optimization technique where intermediate build dependencies (Node.js compiler) are separated from the final runtime image (lightweight Nginx alpine), slashing image footprint from >1GB to ~25MB. |
| **Declarative CI/CD Pipeline** | A structured pipeline definition (`Jenkinsfile`) stating the desired stages, steps, conditions, and credentials executed automatically by Jenkins upon code changes. |
| **Single Page Application (SPA)** | A web application (React + Vite) that dynamically rewrites the current web page with new data from the web server, handled via client-side routing (`react-router-dom`). |
| **Asynchronous Non-Blocking I/O** | High-performance concurrency pattern in Python (`async`/`await` with FastAPI, Uvicorn, and `Motor` MongoDB driver) that handles thousands of concurrent requests without thread blocking. |
| **Salted PBKDF2-HMAC-SHA256** | Password-Based Key Derivation Function 2 applying 100,000 iterations of SHA-256 with a cryptographically secure 16-byte random salt to protect credentials against rainbow table and brute-force attacks. |
| **Timing Attack Mitigation** | Using `secrets.compare_digest` for constant-time string comparisons, preventing attackers from deriving cryptographic hashes based on response latency differences. |
| **PersistentVolumeClaim (PVC)** | A Kubernetes storage abstraction requesting a designated volume size (1Gi) and access mode (`ReadWriteOnce`), decoupling database storage lifecycles from pod destruction. |
| **ClusterIP Service** | The default Kubernetes service type that exposes a service on a cluster-internal IP, making it reachable only from within the cluster (used for MongoDB on port 27017). |
| **NodePort Service** | A Kubernetes service exposing the workload on each Node's IP at a static port (`30080` for frontend, `30800` for backend), enabling direct external network ingress. |
| **Service Discovery & Bridge Network** | Docker's internal DNS resolution mechanism allowing containers on `app-network` to resolve each other by container service name (e.g., `mongodb://database:27017` and `http://backend:8000`). |

---

## 🏗️ System Architecture

### High-Level Architecture Diagram

```
                              ┌───────────────────────────────────┐
                              │           Client Browser          │
                              └─────────────────┬─────────────────┘
                                                │ Port 3000 / 80 (NodePort 30080)
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              TIER 1: PRESENTATION (Nginx)                              │
│  - Container: maxain27/alpha-frontend:latest                                           │
│  - Hosts React 18 SPA (Vite 5, Tailwind CSS, Lucide Icons)                             │
│  - Reverse Proxy: /api/*     ──► http://backend:8000/api/*                             │
│  - Reverse Proxy: /uploads/* ──► http://backend:8000/uploads/*                         │
│  - Client Payload Buffer: 100MB (client_max_body_size 100M)                            │
└───────────────────────────────────────┬────────────────────────────────────────────────┘
                                        │ Port 8000 (NodePort 30800 / Bridge DNS)
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                            TIER 2: APPLICATION LOGIC (FastAPI)                         │
│  - Container: maxain27/alpha-backend:latest                                            │
│  - Runtime: Python 3.11, FastAPI, Uvicorn, Motor (Async MongoDB Driver)                │
│  - Password Cryptography: PBKDF2-HMAC-SHA256 (100k rounds + 16-byte hex salt)          │
│  - Physical File Manager: Decodes Base64 to disk at data/uploads/<email>/              │
│  - Resilient Hybrid Engine: Dual-write to MongoDB & local JSON fallback files          │
└───────────────────────────────────────┬────────────────────────────────────────────────┘
                                        │ Port 27017 (ClusterIP / Bridge DNS)
                                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                TIER 3: DATA (MongoDB 6.0)                              │
│  - Container: maxain27/alpha-database:latest                                           │
│  - Database: streamflix_db                                                             │
│  - Initialized via /docker-entrypoint-initdb.d/init-mongo.js                           │
│  - Collections: users (unique email index), images (unique id + user_email index)      │
│  - Storage Volume: Docker db-data volume / Kubernetes mongo-pvc (1Gi RWO)              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Network & Request Routing Flow

1. **User Request & Client-Side Routing**: The client loads the web app on port `3000` (Docker Compose) or port `30080` (Kubernetes). Nginx serves the compiled SPA. Unmatched browser paths fallback cleanly to `index.html` via `try_files $uri $uri/ /index.html`.
2. **Reverse Proxying Without CORS**:
   - Requests to `/api/*` are captured by Nginx and proxied to `http://backend:8000/api/*`.
   - Requests to `/uploads/*` are proxied to `http://backend:8000/uploads/*`.
   - Both locations enforce `client_max_body_size 100M` to permit heavy image payloads.
3. **Application & Database Asynchronous Execution**:
   - Backend queries MongoDB asynchronously using `motor.motor_asyncio`.
   - If MongoDB is temporarily offline or recovering, the backend smoothly fails over to its disk-backed JSON storage (`credentials.json`, `database_images.json`) and memory cache, preventing 500 errors.
4. **Static Binary Media Serving**:
   - Incoming image uploads are decoded from base64 data URLs into physical image files (`.png`, `.jpg`, `.webp`, `.gif`, `.svg`) and stored in per-user directories under `data/uploads/<sanitized_email>/`.
   - Files are served by FastAPI via `StaticFiles(directory=UPLOADS_DIR)`.

---

## 📁 Comprehensive File & Directory Structure

Below is the complete file tree of the project with a granular explanation of every component:

```text
DevOps-Project-1/
├── Jenkinsfile                   # Declarative CI/CD pipeline automating checkout, validation, build & push
├── docker-compose.yml            # Multi-service local orchestrator defining network, volumes & port bindings
├── kubernetes.yaml               # Single-file production manifest deploying PVC, Deployments & Services
├── README.md                     # Comprehensive technical documentation & project guide
├── .gitignore                    # Git ignore specifications for Python, Node, OS, and log files
│
├── app/                          # Core 3-tier application source code
│   ├── backend/                  # Tier 2: Application Logic (FastAPI + Python 3.11)
│   │   ├── Dockerfile            # Container build recipe based on python:3.11-slim
│   │   ├── requirements.txt      # Python dependencies: fastapi, uvicorn, motor, python-dotenv, pydantic
│   │   ├── server.py             # Complete FastAPI application: endpoints, auth, file manager & dual storage
│   │   ├── .env                  # Backend environment file defining MONGO_URL and DB_NAME
│   │   ├── .dockerignore         # Docker exclusions: virtual environments, __pycache__, and git artifacts
│   │   └── data/                 # File system storage root (mounted as volume in production)
│   │       ├── credentials.json  # Resilient disk backup of user profiles, salts, and password hashes
│   │       ├── database_images.json # Resilient disk backup of user image metadata and titles
│   │       └── uploads/          # Physical image files directory, partitioned by sanitized user email
│   │
│   ├── database/                 # Tier 3: Data Store (MongoDB 6.0)
│   │   ├── Dockerfile            # Container recipe bundling MongoDB 6.0 with automated entrypoint script
│   │   ├── init-mongo.js         # JavaScript script executing on startup: creates db, collections, indexes & seeds
│   │   └── .dockerignore         # Docker exclusions for database build context
│   │
│   └── frontend/                 # Tier 1: Presentation Layer (React 18 + Vite 5 + Tailwind CSS)
│       ├── Dockerfile            # Multi-stage build: Stage 1 Node 20 builder -> Stage 2 Nginx Alpine runner
│       ├── nginx.conf            # Nginx server block: SPA history fallback, /api/ and /uploads/ reverse proxy
│       ├── package.json          # Node dependencies (React 18, Tailwind CSS, Lucide icons, Axios, Router)
│       ├── package-lock.json     # Deterministic Node dependency tree
│       ├── vite.config.js        # Vite bundler configuration integrating React plugin
│       ├── index.html            # Single Page Application HTML root entrypoint
│       ├── .dockerignore         # Docker exclusions: node_modules, build output dist/, and logs
│       └── src/                  # React source tree
│           ├── main.jsx          # React DOM entrypoint mounting App component
│           ├── App.jsx           # Root router configuring public / and protected /dashboard routes
│           ├── App.css           # Global layout reset and animation keyframes
│           ├── index.css         # Tailwind CSS v4 styling rules
│           ├── mock.js           # Multi-language dictionary (en, es, hi, fr, de) and UI mockup data
│           ├── context/
│           │   └── AuthContext.jsx # React Context managing authenticated user state and localStorage
│           ├── lib/
│           │   └── api.js        # Axios HTTP client, FileReader base64 utility & REST helper functions
│           └── components/
│               ├── NetflixLogin.jsx   # Cinema-styled login/signup interface with validation & language selector
│               ├── Dashboard.jsx      # Gallery dashboard, drag-and-drop zone, lightbox modal & dev diagnostics
│               └── ProtectedRoute.jsx # Route authentication guard redirecting unauthenticated users
│
└── k8s/                          # Modular Kubernetes Resource Manifests
    ├── database.yaml             # PersistentVolumeClaim (1Gi RWO), Database Deployment & ClusterIP Service
    ├── backend.yaml              # Backend Deployment (port 8000) & NodePort Service (exposed at 30800)
    └── frontend.yaml             # Frontend Deployment (port 80) & NodePort Service (exposed at 30080)
```

---

## 🛠️ Step-by-Step Implementation Guide: How This Project Was Built

This section outlines the chronological, architectural process used to design, build, containerize, and deploy this project from ground zero:

### Phase 1: Data Modeling & Database Engineering (Data Tier)
1. **Engine Selection**: Selected **MongoDB 6.0** for its flexible BSON document model, enabling seamless handling of arbitrary image metadata, variable base64 payload lengths, and polymorphic user profiles.
2. **Schema & Index Design**:
   - **`users` Collection**: Document schema storing `id`, `email`, `password_hash`, `salt`, and `created_at`. Defined a **Unique Index** on `email` to guarantee account uniqueness.
   - **`images` Collection**: Document schema storing `id`, `user_email`, `title`, `data_url`, `file_path`, and `created_at`. Defined a **Unique Index** on `id` and a **Search Index** on `user_email` to guarantee sub-millisecond gallery retrieval.
3. **Automated Initialization Script**: Created [`app/database/init-mongo.js`](file:///c:/Users/HP/Desktop/dev/app/database/init-mongo.js) using MongoDB JavaScript API:
   - Initialized database `streamflix_db`.
   - Created collections and declared required indexes.
   - Inserted pre-seeded developer credentials (`developer@gmail.com` and `shaikhmazz125@gmail.com`) with pre-hashed salted passwords.
4. **Database Containerization**: Crafted [`app/database/Dockerfile`](file:///c:/Users/HP/Desktop/dev/app/database/Dockerfile) utilizing `mongo:6.0` as base, copying `init-mongo.js` directly into `/docker-entrypoint-initdb.d/` so MongoDB executes it automatically during initial container bootstrap.

---

### Phase 2: Asynchronous RESTful API & Storage Logic (Backend Tier)
1. **Framework Selection**: Chose **FastAPI** with **Uvicorn** and Python 3.11 for high-throughput asynchronous execution, native OpenAPI documentation generation, and strict typing via Pydantic v2.
2. **Asynchronous Driver Integration**: Integrated `motor.motor_asyncio.AsyncIOMotorClient` for non-blocking database queries, avoiding I/O bottlenecks during concurrent file and metadata uploads.
3. **Enterprise Cryptography Implementation**:
   - Avoided plain-text password storage. Implemented **PBKDF2-HMAC-SHA256** hashing with 100,000 iterations using a cryptographically random 16-byte hexadecimal salt generated via `secrets.token_hex(16)`.
   - Utilized `secrets.compare_digest` to verify password hashes in constant time, preventing timing-based side-channel attacks.
4. **Physical Media & Base64 Streaming Engine**:
   - Designed incoming image ingestion accepting base64 Data URLs (`data:image/...;base64,...`).
   - Implemented MIME-type inspection (PNG, JPEG, WebP, GIF, SVG) and filename sanitization via regex (`re.sub(r'[^a-zA-Z0-9_.-]', '_', name)`).
   - Created a partitioned directory structure under `data/uploads/<sanitized_email>/<image_id>_<title>.<ext>` to store raw binary files on disk.
   - Mounted the uploads directory as a static file route using FastAPI's `StaticFiles(directory=UPLOADS_DIR)`.
5. **Fault-Tolerant Hybrid Resilient Storage Engine**:
   - Engineered dual-persistence: writes are simultaneously dispatched to MongoDB and mirrored to disk-backed JSON files (`credentials.json`, `database_images.json`) and an in-memory cache.
   - In the event of MongoDB maintenance, downtime, or network isolation, the backend transparently serves read/write queries from local JSON files without returning HTTP 500 errors to clients.
6. **Backend Containerization**: Created [`app/backend/Dockerfile`](file:///c:/Users/HP/Desktop/dev/app/backend/Dockerfile) with `python:3.11-slim`, installing dependencies with `--no-cache-dir` to minimize container image layer size.

---

### Phase 3: Presentation Layer & UI/UX Engineering (Frontend Tier)
1. **Modern Tooling & Build System**: Bootstrapped a Single Page Application using **React 18** and **Vite 5**, delivering rapid Hot Module Replacement (HMR) and optimized rollup production bundling.
2. **Design System & UI Components**:
   - Crafted a dark cinematic interface inspired by Netflix using **Tailwind CSS v4** and **Lucide React** vector icons.
   - **Multi-Language Internationalization (i18n)**: Implemented an extensible translation dictionary ([`app/frontend/src/mock.js`](file:///c:/Users/HP/Desktop/dev/app/frontend/src/mock.js)) supporting English, Spanish, Hindi, French, and German.
   - **Authentication Screen ([`NetflixLogin.jsx`](file:///c:/Users/HP/Desktop/dev/app/frontend/src/components/NetflixLogin.jsx))**: Integrated real-time regex form validation (email format, password minimum length, password confirmation match) and toggle between login and registration.
   - **Gallery Dashboard ([`Dashboard.jsx`](file:///c:/Users/HP/Desktop/dev/app/frontend/src/components/Dashboard.jsx))**: Built drag-and-drop file upload zone, client-side base64 FileReader, responsive image grid, full-screen lightbox preview modal, inline title editing with `PATCH` synchronization, and image deletion.
   - **Developer Telemetry Modal**: Added diagnostic modal displaying active server storage paths, database file sizes, user counts, and cloud backup guidance.
3. **State Management & Routing**:
   - Implemented `AuthContext.jsx` with persistent authentication state synchronized to browser `localStorage`.
   - Created `ProtectedRoute.jsx` to intercept unauthorized route access and redirect visitors to login.
4. **Multi-Stage Production Containerization**:
   - Designed [`app/frontend/Dockerfile`](file:///c:/Users/HP/Desktop/dev/app/frontend/Dockerfile):
     - **Stage 1 (`builder`)**: `node:20` installs packages and executes `npm run build`, generating compiled static bundles in `/dist`.
     - **Stage 2 (`runtime`)**: Minimal `nginx:alpine` copies `/dist` into `/usr/share/nginx/html`.
5. **Nginx Reverse Proxy & Routing Rules ([`nginx.conf`](file:///c:/Users/HP/Desktop/dev/app/frontend/nginx.conf))**:
   - Implemented SPA client-side routing fallback: `try_files $uri $uri/ /index.html`.
   - Implemented reverse proxy for `/api/` pointing to `http://backend:8000/api/`.
   - Implemented reverse proxy for `/uploads/` pointing to `http://backend:8000/uploads/`.
   - Configured `client_max_body_size 100M` to support large base64 image uploads without Nginx `413 Request Entity Too Large` errors.

---

### Phase 4: Multi-Container Local Orchestration (Docker Compose)
1. **Service Specification ([`docker-compose.yml`](file:///c:/Users/HP/Desktop/dev/docker-compose.yml))**:
   - Defined 3 interdependent services: `database`, `backend`, and `frontend`.
   - Configured container restart policy: `restart: unless-stopped`.
2. **Network Isolation**: Created a custom bridge network `app-network` providing isolated inter-container communication and automatic DNS service discovery (e.g., backend accesses MongoDB simply via hostname `database`).
3. **Volume Persistence**: Defined named Docker volume `db-data` mounted to `/data/db` on the MongoDB container, ensuring data persists across container restarts and rebuilds.
4. **Dependency Sequencing**: Utilized `depends_on` directives (`backend` depends on `database`; `frontend` depends on `backend`) to orchestrate proper service boot order.
5. **Container Registry Tagging**: Standardized image names under the Docker Hub namespace `maxain27`:
   - `maxain27/alpha-database:latest`
   - `maxain27/alpha-backend:latest`
   - `maxain27/alpha-frontend:latest`

---

### Phase 5: Automated CI/CD Pipeline Engineering (Jenkins)
1. **Pipeline Architecture ([`Jenkinsfile`](file:///c:/Users/HP/Desktop/dev/Jenkinsfile))**:
   - Structured as a declarative pipeline (`pipeline { agent any }`).
   - Configured environment variables:
     - `DOCKER_CREDS_ID = 'dockerHub-Credits'`
     - `EC2_IP = '98.130.120.132'`
2. **Stage-by-Stage Automation**:
   - **Stage 1: Checkout Code**: Clones the latest branch from Git SCM.
   - **Stage 2: Validate Backend & Frontend**: Executes Python's native compiler `python -m py_compile server.py` to intercept syntax errors before building containers.
   - **Stage 3: Docker Build**: Runs `docker compose build` to build all three images simultaneously using Docker layer caching.
   - **Stage 4: Push to Docker Hub**: Utilizes Jenkins `withCredentials([usernamePassword(...)])` to securely inject credentials without console leakage, logs into Docker Hub, pushes images via `docker compose push`, and executes `docker logout`.
   - **Post Execution**:
     - Automatically triggers `docker image prune -f` to recover host disk space.
     - Emits deployment URL pointing to the live instance: `http://98.130.120.132:3000`.

---

### Phase 6: Cloud Container Orchestration & Networking (Kubernetes)
1. **Manifest Architecture**: Provided dual deployment formats:
   - Modular manifests under [`k8s/`](file:///c:/Users/HP/Desktop/dev/k8s) for decoupled lifecycle management.
   - Unified single-file manifest [`kubernetes.yaml`](file:///c:/Users/HP/Desktop/dev/kubernetes.yaml) for rapid one-step cluster provisioning.
2. **Storage Provisioning**:
   - Created `PersistentVolumeClaim` named `mongo-pvc` requesting 1Gi of `ReadWriteOnce` storage to back `/data/db` in MongoDB.
3. **Workload Deployments**:
   - **`database` Deployment**: 1 replica, image `maxain27/alpha-database:latest`, volume mount `mongo-storage` attached to `mongo-pvc`.
   - **`backend` Deployment**: 1 replica, image `maxain27/alpha-backend:latest`, port 8000 exposed, injected environment variables `MONGO_URL` and `DB_NAME`.
   - **`frontend` Deployment**: 1 replica, image `maxain27/alpha-frontend:latest`, port 80 exposed.
   - All deployments utilize `imagePullPolicy: Always` to guarantee freshly pushed images are pulled upon pod rollout.
4. **Networking & Services Configuration**:
   - **Database Service**: Configured as `ClusterIP` exposing port 27017 internally.
   - **Backend Service**: Configured as `NodePort` mapping container port 8000 to static node port `30800`.
   - **Frontend Service**: Configured as `NodePort` mapping container port 80 to static node port `30080`.

---

## 🔑 Pre-Seeded Credentials

The database container automatically seeds two user accounts upon initial launch:

| Email | Password | Role / Type | Description |
|---|---|---|---|
| `developer@gmail.com` | `password123` | Developer / Admin | Includes sample pre-uploaded images |
| `shaikhmazz125@gmail.com` | `mazz1234` | Test User Account | Standard user account |

> You can also register any new account instantly using the **"Sign up now"** link on the login page.

---

## 📡 REST API Reference

All backend endpoints are mounted under the `/api` prefix:

### Authentication Endpoints

| Method | Endpoint | Description | Request Payload | Response Code |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user account | `{"email": "user@example.com", "password": "password123"}` | `201 Created` |
| `POST` | `/api/auth/login` | Authenticate user credentials | `{"email": "user@example.com", "password": "password123"}` | `200 OK` |
| `GET` | `/api/auth/users` | Developer endpoint: list accounts | _None_ | `200 OK` |

### Image & Gallery Endpoints

| Method | Endpoint | Description | Parameters / Payload | Response Code |
|---|---|---|---|---|
| `GET` | `/api/images` | List all images for user | Query param: `user_email=email@domain.com` | `200 OK` |
| `POST` | `/api/images` | Upload image (Base64 URL) | Body: `{"user_email": "...", "title": "...", "data_url": "data:image/png;base64,..."}` | `201 Created` |
| `PATCH` | `/api/images/{image_id}` | Update image title | Query params: `user_email=...`, `title=NewTitle` | `200 OK` |
| `DELETE` | `/api/images/{image_id}` | Delete image & physical file | Query param: `user_email=...` | `200 OK` |

### System & Diagnostics Endpoints

| Method | Endpoint | Description | Response Code |
|---|---|---|---|
| `GET` | `/api/` | Service health status & summary metrics | `200 OK` |
| `GET` | `/api/dev/storage` | Diagnostic file paths, image counts & disk locations | `200 OK` |
| `GET` | `/uploads/{path}` | Direct HTTP static media file delivery | `200 OK` |

---

## 🚀 Getting Started & Local Setup

### Option A: One-Click Launch via Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/shaikhmazz/DevOps-Project-1.git
cd DevOps-Project-1

# 2. Build and launch all 3 tiers in background
docker compose up --build -d

# 3. View status of containers
docker compose ps
```

#### Application Endpoints:
- **Frontend UI**: [http://localhost:3000](http://localhost:3000) or [http://localhost](http://localhost)
- **Backend API**: [http://localhost:8000/api](http://localhost:8000/api)
- **Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **MongoDB Connection**: `mongodb://localhost:27017`

To shut down the stack:
```bash
docker compose down
# To also destroy persistent volumes:
docker compose down -v
```

---

### Option B: Manual Standalone Setup

#### 1. Database (MongoDB)
```bash
docker run -d --name local-mongo -p 27017:27017 mongo:6.0
```

#### 2. Backend (FastAPI)
```bash
cd app/backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

#### 3. Frontend (React + Vite)
```bash
cd app/frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ☸️ Kubernetes Deployment Guide

### Deploying the Complete Stack
You can deploy the entire platform to any Kubernetes cluster with a single command:

```bash
kubectl apply -f kubernetes.yaml
```

Or deploy modular manifests step-by-step:
```bash
# 1. Persistent Storage & MongoDB Tier
kubectl apply -f k8s/database.yaml

# 2. Application Logic Tier (FastAPI)
kubectl apply -f k8s/backend.yaml

# 3. Presentation Tier (Nginx + React)
kubectl apply -f k8s/frontend.yaml
```

### Inspecting Kubernetes Resources
```bash
# View active Pods
kubectl get pods -w

# View Services and assigned NodePorts
kubectl get svc

# View PersistentVolumeClaims
kubectl get pvc
```

### Accessing the Application
- **Frontend**: Accessible at `<Node_IP>:30080` (NodePort mapping to container port 80).
- **Backend**: Accessible at `<Node_IP>:30800` (NodePort mapping to container port 8000).

When running with Minikube:
```bash
minikube service frontend --url
```

---

## 🤖 Jenkins CI/CD Pipeline Setup

1. **Prerequisites**: Ensure Jenkins has the **Docker Pipeline**, **Git**, and **Credentials Binding** plugins installed.
2. **Configure Docker Hub Credentials**:
   - Navigate to **Manage Jenkins** → **Credentials** → **System** → **Global credentials**.
   - Add a credential of type **Username with password**.
   - Set **ID** to exact value: `dockerHub-Credits`.
   - Enter your Docker Hub username and password / access token.
3. **Create Pipeline Job**:
   - Click **New Item** → Select **Pipeline** → Name it `alpha-devops-pipeline`.
   - In the pipeline configuration, set **Definition** to **Pipeline script from SCM**.
   - Select **Git**, provide the repository URL `https://github.com/shaikhmazz/DevOps-Project-1.git`, and set the script path to `Jenkinsfile`.
4. **Run Pipeline**: Click **Build Now**. The pipeline will automatically checkout, validate syntax, build the containers, and publish them to Docker Hub.

---

## ⚙️ Configuration & Environment Variables

### Backend Configuration ([`app/backend/.env`](file:///c:/Users/HP/Desktop/dev/app/backend/.env))

| Variable | Default Value | Description |
|---|---|---|
| `MONGO_URL` | `mongodb://localhost:27017` | MongoDB connection URI (`mongodb://database:27017` in Docker network) |
| `DB_NAME` | `streamflix_db` | Database name |
| `DATA_DIR` | `./data` | Directory for physical image storage and fallback JSON files |

### Frontend Configuration

| Variable | Default Value | Description |
|---|---|---|
| `VITE_BACKEND_URL` | `""` (Empty string) | Optional external backend URL (leave empty to use Nginx reverse proxy) |

---

## ❓ Troubleshooting & FAQs

### 1. The frontend shows "Network Error" upon login
- Check if the backend container is running: `docker compose ps`
- View backend logs: `docker compose logs backend`
- If running on AWS EC2 or a cloud VM, ensure ports `3000`, `80`, or `8000` are permitted in your Security Group inbound rules.

### 2. Large image uploads fail or return 413 Payload Too Large
- The Nginx reverse proxy is configured with `client_max_body_size 100M;`. Ensure your payload does not exceed this threshold.
- FastAPI backend enforces a 50MB base64 guard (~35MB image file).

### 3. Kubernetes Pods remain in `CrashLoopBackOff` or `ErrImagePull`
- Ensure Docker images `maxain27/alpha-*` are public on Docker Hub or configure an `imagePullSecrets` in your Kubernetes namespace.
- Test pulling the images directly on your node: `docker pull maxain27/alpha-frontend:latest`.

---

## 👨‍💻 Author & Acknowledgements

- **Author**: Shaikh Mazz ([@shaikhmazz](https://github.com/shaikhmazz))
- **Docker Hub Registry**: [maxain27](https://hub.docker.com/u/maxain27)
- **GitHub Repository**: [shaikhmazz/DevOps-Project-1](https://github.com/shaikhmazz/DevOps-Project-1)
