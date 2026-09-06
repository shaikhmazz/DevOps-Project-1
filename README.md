# StreamFlix — CI/CD DevOps Pipeline

A Netflix-style streaming demo app (**React + Vite** frontend, **FastAPI** backend, **MongoDB** database) deployed end-to-end using a full DevOps pipeline:

**GitHub → Jenkins (CI) → Docker Hub → Kubernetes (CD) → Terraform (Infrastructure)**

---

## 1. Architecture Overview

![End-to-end CI/CD pipeline overview](assets/overview-diagram.png)

**Flow, step by step:**

1. **GitHub** — you push code to the repo. A webhook (or polling) notifies Jenkins.
2. **Jenkins (CI)** — the `Jenkinsfile` pipeline checks out the code, builds two Docker images (`streamflix-backend`, `streamflix-frontend`), and pushes both to **Docker Hub**, tagged with the Jenkins build number and `latest`.
3. **Docker Hub** — acts as the image registry, the handoff point between CI and CD.
4. **Kubernetes (CD)** — Jenkins' final pipeline stage runs `kubectl set image ...`, telling the cluster to pull the newly pushed images and roll out new Pods (rolling update, zero downtime).
5. **Terraform (IaC)** — provisions the underlying infrastructure *once* (VPC, subnets, an EKS cluster, node groups, IAM roles) so that Kubernetes has somewhere to run. Terraform is not part of every CI run — it's run manually/separately whenever infrastructure needs to change.

---

## 2. Cloud Architecture (AWS)

The Terraform in `terraform/` provisions the following AWS resources so the Kubernetes cluster has somewhere to run:

![Detailed AWS cloud architecture: VPC, subnets, EKS, security groups](assets/cloud-architecture-diagram.png)

**Resource breakdown (mirrors the `.tf` files):**

| Resource | Terraform file | Purpose |
|---|---|---|
| `aws_vpc` | `vpc.tf` | Isolated network (`10.0.0.0/16`) for the whole stack |
| `aws_internet_gateway` | `vpc.tf` | Gives the VPC (specifically the public subnets) a route to/from the internet |
| `aws_subnet.public` (x2) | `vpc.tf` | Public subnets — hold the Load Balancer and the NAT Gateways only, one per AZ |
| `aws_subnet.private` (x2) | `vpc.tf` | Private subnets — hold the **EC2 worker nodes** (and therefore all Pods); no public IPs, no inbound path from the internet |
| `aws_eip.nat` + `aws_nat_gateway` (x2) | `vpc.tf` | One NAT Gateway per AZ so private-subnet nodes get **outbound-only** internet access (e.g. to pull images from Docker Hub) without HA risk from a single NAT |
| `aws_route_table.public` / `.private` | `vpc.tf` | Public route table → Internet Gateway; each private route table → its AZ's NAT Gateway |
| `aws_security_group.cluster_sg` | `security-groups.tf` | Attached to the EKS control plane; allows all outbound, and inbound 443 only from `node_sg` |
| `aws_security_group.node_sg` | `security-groups.tf` | Attached to every EC2 worker node via a launch template; allows node-to-node traffic, inbound from the control plane on kubelet ports (1025–65535), and all outbound |
| `aws_launch_template.node` | `eks.tf` | Lets the EKS-managed node group launch EC2 instances with our custom `node_sg` attached (by default EKS creates its own SG — this overrides that) |
| `aws_eks_cluster` | `eks.tf` | Managed Kubernetes control plane (API server, etcd, scheduler — run by AWS across both public+private subnets) |
| `aws_eks_node_group` | `eks.tf` | Auto-scaling group of EC2 worker nodes (`t3.medium`, 1–3 nodes), placed in the **private** subnets |
| `aws_iam_role` (cluster) | `eks.tf` | Lets EKS manage AWS resources on the cluster's behalf |
| `aws_iam_role` (node) | `eks.tf` | Lets EC2 worker nodes join the cluster, use the CNI, and pull from ECR/Docker Hub |
| `aws_instance.jenkins` | `jenkins-ec2.tf` | Standalone EC2 instance (public subnet) running Jenkins itself — separate from the EKS worker nodes |
| `aws_security_group.jenkins_sg` | `jenkins-ec2.tf` | Allows SSH (22) and the Jenkins UI (8080) only from your admin IP |

**Traffic path:**
- **Inbound (user request):** `User → Internet Gateway → LoadBalancer (public subnet) → frontend Pods (private subnet, on an EC2 node) → backend-service → backend Pods → mongo-service → MongoDB Pod (EBS volume via PVC)`.
- **Outbound (image pulls, Jenkins → cluster):** `EC2 node (private subnet) → NAT Gateway (public subnet) → Internet Gateway → Docker Hub`. Nodes are never directly reachable from the internet — this is the key security property of the private-subnet design.
- **Control traffic:** the EKS control plane and the EC2 nodes talk to each other over the security-group rule in `security-groups.tf` (port 443 node→control-plane, ports 1025–65535 control-plane→node) — never over the public internet.

**Why these choices:**
- **EKS** (managed control plane) instead of self-managed `kubeadm` — AWS handles control-plane HA/patching; you only manage worker nodes (EC2 instances).
- **Private subnets for the EC2 worker nodes**, with a **NAT Gateway per AZ**, is the actual production pattern here — nodes get outbound internet (Docker Hub pulls, DNS, etc.) without being directly exposed inbound. Only the Load Balancer sits in a public subnet.
- **Explicit security groups** (`cluster_sg`, `node_sg`) instead of relying on EKS's auto-created default — makes the allowed traffic paths (node↔node, control-plane↔node) visible and auditable in code rather than hidden in the console.
- **A launch template** for the node group is required to attach a custom security group to EKS-managed nodes; without it, EKS silently creates and uses its own SG.
- **LoadBalancer Service type** provisions an AWS Classic/Network Load Balancer automatically — no manual ELB setup needed. Swap for `k8s/ingress.yaml` + an ingress controller if you want host/path-based routing or want to front multiple services with one load balancer.
- **Docker Hub** (not ECR) is used as the registry per the pipeline requirement — nodes reach it outbound through the NAT Gateway.
- **Remote state** (commented out in `terraform/provider.tf`) is recommended once more than one person runs `terraform apply`, so state isn't only on one laptop.

> This architecture is cloud-agnostic in spirit — the same shape (public/private subnets → NAT → managed K8s control plane → node group in private subnets → LoadBalancer) maps directly to GKE on GCP or AKS on Azure if you ever swap providers; only the Terraform provider/resource names change.

---

## 3. File Structure

```
DevOps-Project-1-main/
├── assets/                       # architecture diagrams referenced in this README
│   ├── overview-diagram.png
│   └── cloud-architecture-diagram.png
├── app/
│   ├── backend/                  # FastAPI + MongoDB (motor) service
│   │   ├── server.py
│   │   ├── requirements.txt
│   │   ├── Dockerfile            # builds the backend image
│   │   ├── .dockerignore
│   │   └── .env.example          # template for local MONGO_URL / DB_NAME
│   └── frontend/                 # React + Vite SPA
│       ├── src/
│       ├── package.json
│       ├── Dockerfile            # multi-stage build → served via nginx
│       ├── nginx.conf            # SPA routing + /api reverse proxy
│       └── .dockerignore
│
├── k8s/                          # Kubernetes manifests (the CD target)
│   ├── namespace.yaml
│   ├── configmap.yaml            # non-secret backend config
│   ├── secret.example.yaml       # template — never commit real secrets
│   ├── mongo-deployment.yaml
│   ├── mongo-service.yaml
│   ├── mongo-pvc.yaml            # persistent storage for MongoDB
│   ├── backend-deployment.yaml   # pulls image from Docker Hub
│   ├── backend-service.yaml
│   ├── frontend-deployment.yaml  # pulls image from Docker Hub
│   ├── frontend-service.yaml     # LoadBalancer (public entry point)
│   └── ingress.yaml              # optional alternative to LoadBalancer
│
├── terraform/                    # Infrastructure as Code (AWS EKS example)
│   ├── provider.tf
│   ├── variables.tf
│   ├── vpc.tf                    # VPC, public+private subnets, IGW, NAT Gateways, routing
│   ├── security-groups.tf        # cluster_sg + node_sg + jenkins_sg
│   ├── eks.tf                    # EKS cluster, launch template, node group (EC2), IAM roles
│   ├── jenkins-ec2.tf            # standalone EC2 instance running Jenkins (user_data bootstrap script)
│   ├── outputs.tf
│   └── terraform.tfvars.example
│
├── Jenkinsfile                   # CI/CD pipeline definition
├── docker-compose.yml            # spin the whole stack up locally for testing
├── .gitignore
└── README.md
```

---

## 4. Local Development (optional, no AWS needed)

Before touching AWS at all, you can sanity-check the app itself:
```bash
docker compose up --build
```
- Frontend → http://localhost:3000
- Backend  → http://localhost:8000/api
- Mongo    → localhost:27017

---

## 5. Step-by-Step Implementation Guide (your own AWS account)

This is the exact sequence to stand this up from nothing, in order: **VPC/EC2 → EKS → Jenkins → Kubernetes deployment**.

### Phase 0 — Prerequisites (do this once)

1. **AWS account** with billing enabled. Note your **AWS account ID** and pick a region (this guide assumes `us-east-1`).
2. **IAM user for yourself** (don't use the root account day-to-day): IAM → Users → Create user → attach `AdministratorAccess` (fine for a personal learning account; scope it down later) → create an **access key** (CLI use).
3. **Install tooling locally**: [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), [Terraform](https://developer.hashicorp.com/terraform/install), `kubectl`, `docker`, `git`.
4. **Configure the CLI**:
   ```bash
   aws configure
   # AWS Access Key ID / Secret Access Key / region (us-east-1) / output format (json)
   aws sts get-caller-identity   # sanity check — should print your account ID
   ```
5. **Create an EC2 key pair** (for SSH into the Jenkins box):
   ```bash
   aws ec2 create-key-pair --key-name my-ec2-keypair \
     --query 'KeyMaterial' --output text > my-ec2-keypair.pem
   chmod 400 my-ec2-keypair.pem
   ```
6. **Docker Hub account** — create one if you don't have it, and generate an access token (Account Settings → Security → New Access Token) instead of using your password.
7. **GitHub repo** — push this project's code there; Jenkins will pull from it.

### Phase 1 — (Optional but recommended) Remote Terraform state

Local state (`terraform.tfstate` on your laptop) is fine solo, but an S3 backend means you never lose state and can run `terraform` from anywhere:
```bash
aws s3api create-bucket --bucket <your-unique-tf-state-bucket> --region us-east-1
aws s3api put-bucket-versioning --bucket <your-unique-tf-state-bucket> \
  --versioning-configuration Status=Enabled
aws dynamodb create-table --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```
Then uncomment and fill in the `backend "s3" {}` block in `terraform/provider.tf` with your bucket name, and run `terraform init` (below) — it will migrate state to S3.

### Phase 2 — Provision the network + EC2 resources with Terraform

This single `apply` creates: the **VPC**, 2 public + 2 private **subnets**, **Internet Gateway**, 2 **NAT Gateways**, **security groups**, the **EKS cluster** (control plane), the **EKS node group** (the EC2 instances that run your Pods), and the standalone **Jenkins EC2 instance**.

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```
Edit `terraform.tfvars`:
- `jenkins_ami` — look up the current Amazon Linux 2023 AMI for your region:
  ```bash
  aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
    --query Parameter.Value --output text
  ```
- `key_pair_name` — the key pair you created in Phase 0 (`my-ec2-keypair`).
- `allowed_admin_cidr` — your own public IP with `/32` (`curl ifconfig.me` to find it), **not** `0.0.0.0/0`.

Then:
```bash
terraform init
terraform plan     # review — should show ~35-40 resources to add
terraform apply    # type 'yes' — takes ~12-15 minutes (EKS control plane is the slow part)
```

**What just got created, mapped to real AWS resources you'll see in the console:**

| AWS Console location | What you'll see |
|---|---|
| VPC → Your VPCs | `streamflix-vpc` (`10.0.0.0/16`) |
| VPC → Subnets | 2x `streamflix-public-*`, 2x `streamflix-private-*` |
| VPC → NAT Gateways | 2x `streamflix-nat-*`, each with an Elastic IP |
| VPC → Security Groups | `streamflix-cluster-sg`, `streamflix-node-sg`, `streamflix-jenkins-sg` |
| EKS → Clusters | `streamflix-eks` (status: Active) |
| EKS → Node groups (inside the cluster) | `streamflix-node-group`, 2 desired nodes |
| EC2 → Instances | 2 worker node instances (`t3.medium`, private subnet, tagged `streamflix-eks-node`) **+** 1 `streamflix-jenkins` instance (public subnet) |
| IAM → Roles | `streamflix-eks-cluster-role`, `streamflix-eks-node-role`, `streamflix-jenkins-role` |

Grab the outputs you'll need next:
```bash
terraform output jenkins_public_ip
terraform output cluster_name
```

### Phase 3 — Connect kubectl to the new EKS cluster

```bash
aws eks update-kubeconfig --region us-east-1 --name streamflix-eks
kubectl get nodes
```
You should see the 2 worker nodes in `Ready` status — this confirms the EC2 instances successfully joined the EKS control plane.

### Phase 4 — Finish Jenkins setup on the EC2 instance

```bash
ssh -i my-ec2-keypair.pem ec2-user@$(cd terraform && terraform output -raw jenkins_public_ip)
sudo cat /var/lib/jenkins/secrets/initialAdminPassword   # copy this
exit
```
1. Open `http://<jenkins_public_ip>:8080` in your browser, paste the initial admin password.
2. Install **suggested plugins**, then create your admin user.
3. Install two more plugins: **Docker Pipeline** and **Kubernetes CLI** (Manage Jenkins → Plugins → Available).
4. Add credentials (Manage Jenkins → Credentials → System → Global):
   - `dockerhub-creds` — Kind: *Username with password* → your Docker Hub username + access token.
   - `kubeconfig-creds` — Kind: *Secret file* → upload the kubeconfig from Phase 3 (usually `~/.kube/config` after the `update-kubeconfig` command).
5. New Item → **Pipeline** → name it `streamflix-pipeline` → under Pipeline, choose *Pipeline script from SCM* → SCM: Git → paste your GitHub repo URL → Script Path: `Jenkinsfile`.
6. In GitHub: repo → Settings → Webhooks → Add webhook → Payload URL `http://<jenkins_public_ip>:8080/github-webhook/` → content type `application/json` → trigger on `push`.

### Phase 5 — Bootstrap the Kubernetes namespace (one-time, manual)

Update `<YOUR_DOCKERHUB_USERNAME>` in `k8s/backend-deployment.yaml` and `k8s/frontend-deployment.yaml` first, then:
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl create secret generic mongo-secret \
  --from-literal=MONGO_ROOT_USER=admin \
  --from-literal=MONGO_ROOT_PASSWORD=<choose-a-password> \
  -n streamflix
kubectl apply -f k8s/mongo-pvc.yaml
kubectl apply -f k8s/mongo-deployment.yaml
kubectl apply -f k8s/mongo-service.yaml
```

### Phase 6 — First deployment (build, push, deploy)

Either push to GitHub and let the Jenkins webhook do it automatically (Phase 4 wiring), or run the first one manually to sanity-check:
```bash
docker build -t <dockerhub-user>/streamflix-backend:v1 ./app/backend
docker build -t <dockerhub-user>/streamflix-frontend:v1 ./app/frontend
docker push <dockerhub-user>/streamflix-backend:v1
docker push <dockerhub-user>/streamflix-frontend:v1

kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml

kubectl get pods -n streamflix -w      # watch Pods go to Running
```

### Phase 7 — Access the live app

```bash
kubectl get svc frontend-service -n streamflix
```
AWS provisions a **Classic Load Balancer** for the `LoadBalancer` Service type — use the `EXTERNAL-IP` (a `*.elb.amazonaws.com` hostname) shown to open the app in a browser.

### Phase 8 — Ongoing deploys

From here on, every `git push` to `main` triggers: GitHub webhook → Jenkins → build both images → push to Docker Hub → `kubectl set image` rolling update. No manual steps needed.

### Phase 9 — Tear down (avoid ongoing charges)

```bash
kubectl delete namespace streamflix
cd terraform
terraform destroy
```
This removes the EKS cluster, EC2 instances (worker nodes + Jenkins), NAT Gateways, and everything else Terraform created. **NAT Gateways and the EKS control plane bill hourly even when idle** — destroy them when you're done experimenting for the day if cost matters (see the cost table below).

---

## 6. Tech Stack

| Layer          | Technology                          |
|----------------|--------------------------------------|
| Frontend       | React 18, Vite, Tailwind CSS         |
| Backend        | FastAPI, Uvicorn, Motor (async MongoDB driver) |
| Database       | MongoDB                              |
| Containerization | Docker (multi-stage builds)        |
| CI             | Jenkins                              |
| Image Registry | Docker Hub                           |
| Orchestration  | Kubernetes                           |
| Infrastructure | Terraform (AWS EKS)                  |

---

## 7. Notes & Next Steps

- Secrets (`.env`, `k8s/secret.yaml`, `terraform.tfvars`) are gitignored — never commit real credentials.
- Image tags in the k8s manifests currently show `latest`; Jenkins overrides them per-build with `kubectl set image`, using the Jenkins `BUILD_NUMBER` as the tag for traceability/rollback.
- For production hardening, consider: HTTPS via cert-manager + Ingress, MongoDB authentication + a managed DB (e.g. Atlas/DocumentDB) instead of an in-cluster Pod, Horizontal Pod Autoscaler, and remote Terraform state (S3 + DynamoDB lock, already stubbed out in `terraform/provider.tf`).

### Estimated AWS cost (us-east-1, on-demand pricing, approximate)

| Resource | Quantity | ~Cost |
|---|---|---|
| EKS control plane | 1 | $0.10/hr (~$73/mo) |
| EKS worker nodes (`t3.medium`) | 2 | ~$0.0416/hr each (~$60/mo total) |
| Jenkins EC2 (`t3.medium`) | 1 | ~$0.0416/hr (~$30/mo) |
| NAT Gateway | 2 | $0.045/hr each + data processing (~$65/mo total) |
| Elastic IPs (attached, NAT) | 2 | Free while attached |
| Load Balancer (Classic ELB) | 1 | ~$0.025/hr (~$18/mo) |
| EBS volumes (Mongo PVC + node root disks) | a few GB–5GB | a few $/mo |

**Rough total: ~$4-5/day if left running continuously.** The EKS control plane and the two NAT Gateways are the biggest fixed costs and bill even when the cluster is idle — this is exactly why Phase 9 (`terraform destroy`) matters for a learning/personal account. Consider dropping to a **single NAT Gateway** (shared across both AZs) if you want to cut that cost roughly in half at the expense of losing AZ-level redundancy for outbound traffic.
