// "Ferguson_Fresher_Training_Git_Docker_Kubernetes_CICD.pptx" (Vishnu Chaturvedi, slides 1–56) followed by "The Fresher's Guide to Azure ETL.pptx" (Santoshini Panda, slides 57–71)
// Text carried over slide by slide from the trainer's deck; the slides themselves are the exported
// pictures under public/decks/day14-devops-etl/ (71 slides), so these bullets are talking points.
export default {
  key: "day14-devops-etl",
  title: "Tech Refresher – Git, Docker, Kubernetes, CI/CD & Azure ETL",
  sections: [
    {
      id: "agenda",
      title: "Today",
      slides: [
        {
          title: "Tech Refresher — Git, Docker, Kubernetes & CI/CD",
          bullets: [
            "Fresher Enablement | From source code to production",
            "Vishnu Chaturvedi",
            "Lead Software Engineer",
            "Enterprises solutions"
          ],
          note: ""
        },
        {
          title: "Agenda",
          bullets: [
            "01 — Big Picture: software delivery lifecycle",
            "02 — Git: version control & collaboration",
            "03 — Docker: repeatable application packaging",
            "04 — Kubernetes: orchestration at scale",
            "05 — CI/CD: automate build, test and deployment",
            "06 — Ferguson context, AI leverage, labs & recap",
            "We will learn in the order the tools appear in a real delivery flow."
          ],
          note: "",
          agenda: [
            {
              id: "mentors",
              title: "Your trainer",
              count: 1,
              first: [
                "Trainer – Vishnu Chaturvedi"
              ]
            },
            {
              id: "bigpicture",
              title: "The big picture",
              count: 1,
              first: [
                "The Big Picture: From Laptop to Users"
              ]
            },
            {
              id: "git",
              title: "Part 1 — Git",
              count: 13,
              first: [
                "Part 1 — Git: Version Control & Collaboration",
                "Why Do We Need Version Control?",
                "Git vs GitHub / GitLab / Bitbucket"
              ]
            },
            {
              id: "docker",
              title: "Part 2 — Docker",
              count: 12,
              first: [
                "Part 2 — Docker: Build Once, Run Consistently",
                "The Problem Docker Solves",
                "Virtual Machine vs Container"
              ]
            },
            {
              id: "kubernetes",
              title: "Part 3 — Kubernetes",
              count: 15,
              first: [
                "Part 3 — Kubernetes: Operate Containers at Scale",
                "Why Kubernetes?",
                "Kubernetes Cluster: High-Level View"
              ]
            },
            {
              id: "cicd",
              title: "Part 4 — CI/CD",
              count: 7,
              first: [
                "Part 4 — CI/CD: Automate the Delivery Path",
                "Continuous Integration vs Continuous Delivery",
                "Typical Pipeline: Commit to Kubernetes"
              ]
            },
            {
              id: "recap",
              title: "Part 5 — Capstone & recap",
              count: 5,
              first: [
                "Part 5 — Building the Puzzle: Capstone & Recap",
                "End-to-End Delivery",
                "Final Recap"
              ]
            },
            {
              id: "etl-intro",
              title: "Azure ETL: intro & roadmap",
              count: 3,
              first: [
                "The Fresher's Guide to Azure ETL",
                "Agenda",
                "A Freshers’ Roadmap for Data Engineer"
              ]
            },
            {
              id: "etl-core",
              title: "Azure ETL building blocks",
              count: 7,
              first: [
                "Core ETL Architecture",
                "SQL Server — Your Data Foundation",
                "Azure Blob Storage — The Landing Zone"
              ]
            },
            {
              id: "etl-e2e",
              title: "End-to-end ETL",
              count: 2,
              first: [
                "End-to-End ETL Architecture",
                "How ADF + Databricks + GitHub Work Together"
              ]
            },
            {
              id: "etl-recap",
              title: "ETL recap, hands-on & careers",
              count: 3,
              first: [
                "Building the puzzle: recap & hands-on",
                "Where These Skills Can Take You",
                "Thank you!"
              ]
            }
          ]
        }
      ]
    },
    {
      id: "mentors",
      title: "Your trainer",
      slides: [
        {
          title: "Trainer – Vishnu Chaturvedi",
          bullets: [
            "10 Years of Experience in Backend Development.",
            "Currently working as a Lead Engineer – Product Domain at Ferguson.",
            "Joined Ferguson in April 2025, part of TIF-Middleware.",
            "Core Expertise: Java, Spring Boot, MongoDB, Elasticsearch and Backend Systems.",
            "Passionate about technology, problem solving & knowledge sharing.",
            "Hobbies: Chess & exploring new technologies."
          ],
          note: ""
        }
      ]
    },
    {
      id: "bigpicture",
      title: "The big picture",
      slides: [
        {
          title: "The Big Picture: From Laptop to Users",
          bullets: [
            "CODE",
            "Developer writes code",
            "GIT",
            "Version + collaborate",
            "CI",
            "Build + test",
            "IMAGE",
            "Package artifact",
            "K8S",
            "Deploy + operate"
          ],
          note: ""
        }
      ]
    },
    {
      id: "git",
      title: "Part 1 — Git",
      slides: [
        {
          title: "Part 1 — Git: Version Control & Collaboration",
          bullets: [],
          note: ""
        },
        {
          title: "Why Do We Need Version Control?",
          bullets: [
            "Without Git: files like final.java, final_v2.java, final_REAL.java",
            "Multiple developers can overwrite each other’s work",
            "Hard to answer: who changed this, when, and why?",
            "Rollback becomes risky when a release breaks",
            "Git gives history, parallel work, review and recovery",
            "Analogy: Git is a time machine + collaboration ledger for source code."
          ],
          note: ""
        },
        {
          title: "Git vs GitHub / GitLab / Bitbucket",
          bullets: [
            "Git",
            "Distributed version control system",
            "Runs locally on your machine",
            "Tracks commits, branches and merges",
            "Works even without internet",
            "Remote hosting platform",
            "Stores shared remote repositories",
            "Adds pull requests, permissions, issues",
            "Integrates CI/CD and code review",
            "Team collaboration layer around Git"
          ],
          note: ""
        },
        {
          title: "Git Mental Model",
          bullets: [
            "WORKING TREE",
            "Files you edit",
            "STAGING",
            "Selected changes",
            "LOCAL REPO",
            "Committed history",
            "REMOTE",
            "Shared repository"
          ],
          note: ""
        },
        {
          title: "Git: Your First Local Workflow",
          bullets: [
            "A small change moves from working tree → staging → local history.",
            "git status git add src/main/java/ProductService.java git commit -m \"Add product validation\" git log --oneline -5",
            "Key takeaway: Commit messages should describe the intent of the change, not just “changes done”."
          ],
          note: ""
        },
        {
          title: "Clone, Pull and Push",
          bullets: [
            "Use the remote repository to synchronize with your team.",
            "git clone <repository-url> cd product-service git pull origin main # make changes + commit git push origin feature/product-validation"
          ],
          note: ""
        },
        {
          title: "Branching: Work in Parallel",
          bullets: [
            "main",
            "Stable baseline",
            "feature/...",
            "Your isolated work",
            "PR",
            "Review + checks",
            "merge",
            "Integrate safely",
            "A branch is a lightweight pointer to commits — not a full copy of the project."
          ],
          note: ""
        },
        {
          title: "Branching Commands",
          bullets: [
            "Create a branch for one focused change.",
            "git switch main git pull git switch -c feature/add-vendor-api # edit, add, commit git push -u origin feature/add-vendor-api"
          ],
          note: ""
        },
        {
          title: "Merge vs Rebase",
          bullets: [
            "Merge",
            "Combines histories with a merge commit",
            "Preserves branch topology",
            "Safe default for shared branches",
            "Easy to understand for beginners",
            "Rebase",
            "Replays commits on a new base",
            "Creates a linear-looking history",
            "Avoid rebasing public/shared commits",
            "Useful before PR when team convention allows"
          ],
          note: ""
        },
        {
          title: "Merge Conflicts: What Actually Happened?",
          bullets: [
            "Git cannot automatically decide between overlapping edits",
            "Conflict markers show “ours” and “theirs”",
            "Developer must understand intent — not blindly choose one side",
            "Resolve file → test → git add → continue commit/rebase",
            "Communicate with the other author when business logic is unclear",
            "Conflict resolution is a collaboration problem first, a Git problem second."
          ],
          note: ""
        },
        {
          title: "Conflict Resolution Mini Demo",
          bullets: [
            "Typical conflict resolution sequence:",
            "git pull origin main # CONFLICT in ProductService.java # edit the file and remove conflict markers git add ProductService.java git commit git push"
          ],
          note: ""
        },
        {
          title: "Pull Request: The Team Quality Gate",
          bullets: [
            "Explain WHAT changed and WHY",
            "Keep scope small enough to review",
            "Automated checks should pass before merge",
            "Reviewer checks correctness, readability, tests and risk",
            "Address comments with code or clear reasoning",
            "Merge only when branch is current and approved"
          ],
          note: ""
        },
        {
          title: "Git Mistakes & Recovery",
          bullets: [
            "Uncommitted change you want to discard → restore carefully",
            "Wrong file staged → unstage without deleting work",
            "Bad local commit → amend or reset depending on whether it was pushed",
            "Bad shared commit → prefer revert to preserve history",
            "Never force-push a shared branch unless team policy explicitly allows it",
            "Rule: before destructive commands, run git status and understand whether work is local or already shared."
          ],
          note: ""
        }
      ]
    },
    {
      id: "docker",
      title: "Part 2 — Docker",
      slides: [
        {
          title: "Part 2 — Docker: Build Once, Run Consistently",
          bullets: [],
          note: ""
        },
        {
          title: "The Problem Docker Solves",
          bullets: [
            "“It works on my machine” usually means environments differ",
            "Different JDK/library versions cause surprises",
            "Manual server setup is slow and hard to reproduce",
            "Applications need a predictable runtime package",
            "Docker bundles app + runtime dependencies into an image"
          ],
          note: ""
        },
        {
          title: "Virtual Machine vs Container",
          bullets: [
            "Virtual Machine",
            "Includes a full guest OS",
            "Heavier startup and disk footprint",
            "Strong isolation boundary",
            "Good for machine-level virtualization",
            "Container",
            "Shares host kernel",
            "Starts quickly and is lightweight",
            "Packages process + filesystem dependencies",
            "Ideal unit for modern application deployment"
          ],
          note: ""
        },
        {
          title: "Docker Mental Model",
          bullets: [
            "Dockerfile",
            "Recipe",
            "docker build",
            "Build process",
            "Image",
            "Immutable package",
            "docker run",
            "Create instance",
            "Container",
            "Running process"
          ],
          note: ""
        },
        {
          title: "Dockerfile — Spring Boot Example",
          bullets: [
            "A Dockerfile describes how to construct the runtime image.",
            "FROM eclipse-temurin:21-jre WORKDIR /app COPY target/product-service.jar app.jar EXPOSE 8080 ENTRYPOINT [\"java\",\"-jar\",\"app.jar\"]",
            "Key takeaway: Prefer small, trusted base images and keep the image focused on one application process."
          ],
          note: ""
        },
        {
          title: "Build and Run an Image",
          bullets: [
            "Build from the Dockerfile, then map a host port to the container.",
            "docker build -t product-service:1.0 . docker images docker run --name product-api -p 8080:8080 product-service:1.0 docker ps"
          ],
          note: ""
        },
        {
          title: "Ports, Environment Variables & Configuration",
          bullets: [
            "Container has its own network namespace",
            "-p 8080:8080 maps host port → container port",
            "Runtime configuration should come from environment/config, not image rebuilds",
            "Never bake passwords or tokens into an image",
            "Same image should move across environments with different configuration",
            "Immutable artifact + externalized configuration is a core delivery principle."
          ],
          note: ""
        },
        {
          title: "Volumes: Data Outlives Containers",
          bullets: [
            "Containers are disposable by design",
            "Writing important data only inside a container is risky",
            "Volumes provide persistent storage outside container lifecycle",
            "Databases commonly require persistent volumes",
            "Stateless application containers are simpler to scale and replace",
            "Ask: “If this container disappears right now, what data must survive?”"
          ],
          note: ""
        },
        {
          title: "Docker Debugging Commands",
          bullets: [
            "Use these to understand a running or failed container.",
            "docker ps -a docker logs -f product-api docker inspect product-api docker exec -it product-api sh docker stop product-api docker rm product-api"
          ],
          note: ""
        },
        {
          title: "Image Registry: Sharing the Artifact",
          bullets: [
            "BUILD",
            "product-service:1.0",
            "TAG",
            "registry/app:1.0",
            "PUSH",
            "Upload image",
            "PULL",
            "Cluster downloads",
            "RUN",
            "Container starts"
          ],
          note: ""
        },
        {
          title: "Docker Best Practices",
          bullets: [
            "Use .dockerignore to reduce build context",
            "Run as non-root where possible",
            "Do not put secrets in Dockerfile or image layers",
            "Use multi-stage builds when compilation tools are not needed at runtime",
            "Scan images and update vulnerable base images",
            "Security and repeatability start during image construction, not after deployment."
          ],
          note: ""
        },
        {
          title: "Lab — Containerize a Spring Boot App",
          bullets: [
            "Package the sample app into a JAR",
            "Write a Dockerfile",
            "Build product-service:1.0",
            "Run on localhost:8080 and call /health",
            "Change the app, rebuild as 1.1 and compare image IDs",
            "Stop/remove the container and prove the image still exists",
            "Bonus: pass an environment variable and print it from the application."
          ],
          note: ""
        }
      ]
    },
    {
      id: "kubernetes",
      title: "Part 3 — Kubernetes",
      slides: [
        {
          title: "Part 3 — Kubernetes: Operate Containers at Scale",
          bullets: [],
          note: ""
        },
        {
          title: "Why Kubernetes?",
          bullets: [
            "Docker can run a container — but production has many containers",
            "What restarts a crashed application?",
            "How do we run 3 or 30 replicas?",
            "How does traffic find healthy instances?",
            "How do we roll out a new version safely?",
            "Kubernetes automates scheduling, healing, scaling and rollout mechanics",
            "Kubernetes is an orchestration platform, not a replacement for Docker images."
          ],
          note: ""
        },
        {
          title: "Kubernetes Cluster: High-Level View",
          bullets: [
            "CONTROL PLANE",
            "Desired state + scheduling",
            "NODE A",
            "Pods run here",
            "NODE B",
            "SERVICE",
            "Stable access",
            "USERS",
            "Send requests",
            "You declare desired state. Kubernetes continuously tries to make actual state match it."
          ],
          note: ""
        },
        {
          title: "Pod: Smallest Deployable Unit",
          bullets: [
            "A Pod contains one or more tightly coupled containers",
            "Containers in a Pod share network identity and volumes",
            "Pods are ephemeral: their names/IPs can change",
            "Normally you do not manually create production Pods",
            "Deployments manage Pods for stateless applications",
            "Think “replaceable instance”, not “pet server”."
          ],
          note: ""
        },
        {
          title: "Deployment: Desired State Controller",
          bullets: [
            "Defines container image and number of replicas",
            "Creates and manages ReplicaSets and Pods",
            "Replaces failed Pods automatically",
            "Supports rolling updates and rollback",
            "Changing the image tag triggers a new rollout"
          ],
          note: ""
        },
        {
          title: "Self-Healing Example",
          bullets: [
            "DESIRED",
            "3 replicas",
            "FAILURE",
            "1 Pod crashes",
            "OBSERVE",
            "Only 2 healthy",
            "RECONCILE",
            "Create replacement",
            "RESTORED"
          ],
          note: ""
        },
        {
          title: "Service: Stable Networking",
          bullets: [
            "Pod IPs are temporary",
            "A Service provides a stable virtual endpoint",
            "Labels/selectors connect Services to Pods",
            "Traffic can be load-balanced across healthy endpoints",
            "Common types: ClusterIP, NodePort, LoadBalancer",
            "Clients should depend on stable service discovery, not individual Pod IP addresses."
          ],
          note: ""
        },
        {
          title: "ConfigMap vs Secret",
          bullets: [
            "ConfigMap: non-sensitive configuration",
            "Secret: sensitive values such as credentials/tokens",
            "Both can be exposed as environment variables or mounted files",
            "Do not commit real secrets into Git",
            "Changing configuration may require workload restart depending on how app reads it",
            "“Secret” is an API object type — proper encryption/access controls still matter."
          ],
          note: ""
        },
        {
          title: "Requests, Limits & Why They Matter",
          bullets: [
            "CPU/memory requests help the scheduler place Pods",
            "Limits cap resource usage",
            "Too-low memory limit can cause OOMKilled",
            "No requests can lead to noisy-neighbor behavior",
            "Observe real usage before tuning production values",
            "Resource settings are capacity-planning inputs, not arbitrary numbers."
          ],
          note: ""
        },
        {
          title: "Readiness vs Liveness Probes",
          bullets: [
            "Readiness: can this Pod receive traffic now?",
            "Liveness: is this process stuck and should it restart?",
            "Startup probes protect slow-starting applications",
            "Bad probe settings can create restart loops",
            "Health endpoint must represent meaningful application health",
            "A running process is not automatically a ready application."
          ],
          note: ""
        },
        {
          title: "kubectl — First Commands",
          bullets: [
            "Use kubectl to inspect cluster resources and troubleshoot.",
            "kubectl get pods kubectl get deployments kubectl get svc kubectl describe pod <pod-name> kubectl logs <pod-name> kubectl get events --sort-by=.lastTimestamp",
            "Key takeaway: Observe first. “Describe + logs + events” is a strong beginner troubleshooting sequence."
          ],
          note: ""
        },
        {
          title: "A Minimal Deployment Manifest",
          bullets: [
            "apiVersion: apps/v1 kind: Deployment metadata: name: product-service spec: replicas: 2 template: spec: containers: - name: app image:…",
            "Key takeaway: Real manifests also need selectors/labels, probes, resources and configuration."
          ],
          note: ""
        },
        {
          title: "Rolling Update: Version 1 → Version 2",
          bullets: [
            "v1 v1 v1",
            "Current replicas",
            "v1 v1 v2",
            "Start new Pod",
            "v1 v2 v2",
            "Drain old Pods",
            "v2 v2 v2",
            "Rollout complete",
            "A rolling strategy replaces instances gradually so the service can remain available during deployment."
          ],
          note: ""
        },
        {
          title: "Kubernetes Troubleshooting Framework",
          bullets: [
            "Pending → scheduling/resources/PVC/constraints",
            "ImagePullBackOff → image/tag/registry authentication",
            "Running but not Ready → readiness probe or dependency problem",
            "Service unreachable → labels/selectors/ports/network policy",
            "OOMKilled → inspect memory usage and limits before simply increasing them"
          ],
          note: ""
        },
        {
          title: "Lab — Deploy & Break It",
          bullets: [
            "Apply a Deployment with 2 replicas",
            "Expose it with a Service",
            "Delete one Pod and watch self-healing",
            "Scale replicas from 2 → 4",
            "Deploy a new image tag and watch rollout status"
          ],
          note: ""
        }
      ]
    },
    {
      id: "cicd",
      title: "Part 4 — CI/CD",
      slides: [
        {
          title: "Part 4 — CI/CD: Automate the Delivery Path",
          bullets: [],
          note: ""
        },
        {
          title: "Continuous Integration vs Continuous Delivery",
          bullets: [
            "Continuous Integration (CI)",
            "Integrate small changes frequently",
            "Compile/build automatically",
            "Run unit/integration tests",
            "Static analysis & security checks",
            "Fail fast before changes travel further",
            "Continuous Delivery / Deployment (CD)",
            "Promote a tested artifact",
            "Deploy consistently across environments",
            "Use approvals where required"
          ],
          note: ""
        },
        {
          title: "Typical Pipeline: Commit to Kubernetes",
          bullets: [
            "COMMIT",
            "Push branch",
            "BUILD",
            "Compile + tests",
            "SCAN",
            "Quality/security",
            "IMAGE",
            "Build + push",
            "DEPLOY",
            "Kubernetes rollout"
          ],
          note: ""
        },
        {
          title: "Pipeline Stages — What Can Fail?",
          bullets: [
            "Checkout: permissions, wrong ref, unavailable dependency",
            "Build: compilation or dependency resolution",
            "Test: unit/integration regression",
            "Quality/scan: policy or vulnerability threshold",
            "Image push: registry auth/tag conflict",
            "Deploy: invalid manifest, quota, readiness failure",
            "Post-deploy: smoke test or monitoring indicates regression",
            "A good pipeline makes the failure stage obvious and leaves enough logs to diagnose it."
          ],
          note: ""
        },
        {
          title: "Jenkins-Style Pipeline Example",
          bullets: [
            "Illustrative flow — exact syntax varies by organization and shared libraries.",
            "Key takeaway: Pipeline-as-code makes delivery logic reviewable, versioned and repeatable."
          ],
          note: ""
        },
        {
          title: "Ferguson Context: How the Pieces Connect",
          bullets: [
            "Developer works on a feature branch and raises a PR",
            "Automated checks protect the shared branch",
            "Build produces a versioned application/container artifact",
            "Deployment configuration defines how the workload runs",
            "Kubernetes manages replicas, health and rollout",
            "Logs/metrics/traces help validate behavior after deployment"
          ],
          note: ""
        },
        {
          title: "AI Leverage — Use It Without Outsourcing Understanding",
          bullets: [
            "Ask AI to explain an unfamiliar Git error in plain language",
            "Generate a first Dockerfile/YAML draft — then review every line",
            "Paste sanitized logs and ask for ranked hypotheses",
            "Ask for a troubleshooting checklist before executing commands",
            "Never paste credentials, secrets or restricted company data",
            "Verify commands in docs/team standards before running against shared environments",
            "Best prompt pattern: context + symptom + expected behavior + constraints + what you already checked."
          ],
          note: ""
        }
      ]
    },
    {
      id: "recap",
      title: "Part 5 — Capstone & recap",
      slides: [
        {
          title: "Part 5 — Building the Puzzle: Capstone & Recap",
          bullets: [],
          note: ""
        },
        {
          title: "End-to-End Delivery",
          bullets: [
            "GIT",
            "Branch + commit",
            "CI",
            "Build + test",
            "DOCKER",
            "Build image",
            "REGISTRY",
            "Push tag",
            "K8S",
            "Deploy + verify"
          ],
          note: ""
        },
        {
          title: "Final Recap",
          bullets: [
            "Git — tracks and collaborates on source-code changes",
            "Docker — packages an application into a repeatable image",
            "Kubernetes — runs and manages containerized workloads",
            "CI — automatically validates every change",
            "CD — promotes/deploys validated artifacts consistently",
            "Together — faster delivery with repeatability, visibility and safer change"
          ],
          note: ""
        },
        {
          title: "Quick Knowledge Check",
          bullets: [
            "Why is a Git branch cheaper than copying the whole project folder?",
            "Image vs container — what is the difference?",
            "Why should a Service not point to one hard-coded Pod IP?",
            "Readiness vs liveness — what decision does each drive?",
            "Why should we promote the same image across environments?",
            "What would you inspect first for CrashLoopBackOff?"
          ],
          note: ""
        },
        {
          title: "Thank you!",
          bullets: [
            "+91-7395902450",
            "FERGUSON.COM",
            "Vishnu.Chaturvedi@ferguson.com"
          ],
          note: ""
        }
      ]
    },
    {
      id: "etl-intro",
      title: "Azure ETL: intro & roadmap",
      slides: [
        {
          title: "The Fresher's Guide to Azure ETL",
          bullets: [
            "SANTOSHINI PANDA",
            "Senior Software Engineer",
            "I’m a Senior Data Engineer at Ferguson, with over 8 years of experience in ETL, Data Engineering, and Data Warehousing. My core expertise includes SQL,…",
            "Career question: “Do I enjoy building pipelines, solving data problems, or turning data into business outcomes?”",
            "Challenge yourself",
            "Master a tool at a time, pick a direction.",
            "Learn the “why” first → practice the “how” → automate the repeatable.",
            "Progressive Mindset"
          ],
          note: ""
        },
        {
          title: "Agenda",
          bullets: [
            "Technology / Topic Overview What it is why it exists where it fits Basics / Foundation ETL flow data layers common terms Core Concepts SQL Server Blob ADF…",
            "01 02 03 04 05 06",
            "8/31/26"
          ],
          note: ""
        },
        {
          title: "A Freshers’ Roadmap for Data Engineer",
          bullets: [
            "Core SQL Mastery",
            "Azure Storage Basics",
            "ADF Pipeline Building",
            "Databricks PySpark Fundamentals"
          ],
          note: ""
        }
      ]
    },
    {
      id: "etl-core",
      title: "Azure ETL building blocks",
      slides: [
        {
          title: "Core ETL Architecture",
          bullets: [
            "EXTRACT",
            "Get data from sources",
            "TRANSFORM",
            "Clean, join, validate, enrich",
            "LOAD",
            "Store data for analytics/use",
            "SERVE",
            "Reports, apps, models, decisions",
            "Modern cloud pipelines often use ELT as well: load first, transform in the target platform.",
            "ETL"
          ],
          note: ""
        },
        {
          title: "SQL Server — Your Data Foundation",
          bullets: [
            "What it is",
            "Relational database platform Tables, views, stored procedures Keys & relationships Transactions & security",
            "Why ETL needs it",
            "Common source/target system Query and filter data Validate business rules Create repeatable extracts",
            "Freshers should learn",
            "SELECT JOIN GROUP BY CTEs window functions Indexes data types NULLs",
            "SQL query example",
            "Illustrative",
            "ETL checkpoint",
            "Think like a data engineer"
          ],
          note: ""
        },
        {
          title: "Azure Blob Storage — The Landing Zone",
          bullets: [
            "What it is",
            "Cloud object storage for files / blobs. Think: folders + files, not relational tables.",
            "Where it fits",
            "Raw landing → processed data → curated outputs. Useful for CSV, JSON, Parquet and other files.",
            "Key idea",
            "Separate storage from compute. Databricks can read/write files without being the permanent storage layer.",
            "Blob container — illustrative snapshot",
            "Example folder structure",
            "raw/ sales/ 2026-08-31.csv curated/ sales/ sales_delta/",
            "What to understand"
          ],
          note: ""
        },
        {
          title: "Azure Data Factory (ADF) — The Orchestrator",
          bullets: [
            "Trigger",
            "When should it run?",
            "Copy / Lookup",
            "Move or inspect data",
            "Databricks",
            "Transform at scale",
            "Sink",
            "Store output",
            "Monitor",
            "Observe success/failure"
          ],
          note: ""
        },
        {
          title: "Azure Databricks — Transform at Scale",
          bullets: [
            "What it is",
            "Lakehouse analytics platform built around Apache Spark. Commonly used for large-scale transformation.",
            "What you write",
            "Notebooks / Python / PySpark / SQL Read → transform → write Reusable jobs for production workloads.",
            "Why freshers like it",
            "Python + SQL + distributed processing. A bridge between software skills and data engineering.",
            "PySpark example",
            "Illustrative",
            "df = spark.read.parquet(\"/mnt/raw/sales\") clean = (df.dropDuplicates([\"OrderId\"]) .filter(\"Amount > 0\")) clean.write.format(\"delta\").mode(\"append\")…",
            "Concepts to learn next"
          ],
          note: ""
        },
        {
          title: "Databricks Jobs & Scheduling",
          bullets: [
            "Job",
            "Bundle notebook / task + compute + parameters",
            "Schedule",
            "Cron / recurring schedule / event-driven patterns",
            "Run & Monitor",
            "Retries logs duration success/failure",
            "Two common patterns",
            "Pattern A — Databricks owns the schedule",
            "Simple recurring transformation that can run independently.",
            "Pattern B — ADF orchestrates the job"
          ],
          note: ""
        },
        {
          title: "GitHub — Version Control for Data Engineering",
          bullets: [
            "Why GitHub matters",
            "History + collaboration + code review. Your pipeline code should be reproducible, not trapped in a laptop.",
            "What lives in a repo",
            "PySpark / Python SQL scripts ADF pipeline definitions / templates README + tests + config",
            "Core workflow",
            "Clone → branch → commit → pull request → review → merge",
            "GitHub — illustrative snapshot",
            "Repository view",
            "etl-project/ ├─ databricks/ │ └─ sales_transform.py ├─ sql/ │ └─ checks.sql ├─ adf/ │ └─ pipeline.json └─ README.md",
            "How it connects"
          ],
          note: ""
        }
      ]
    },
    {
      id: "etl-e2e",
      title: "End-to-end ETL",
      slides: [
        {
          title: "End-to-End ETL Architecture",
          bullets: [
            "GitHub sits across the lifecycle: develop → review → deploy → version",
            "Develop",
            "Review",
            "Deploy",
            "Run",
            "Monitor"
          ],
          note: ""
        },
        {
          title: "How ADF + Databricks + GitHub Work Together",
          bullets: [
            "GitHub",
            "Engineer commits PySpark / SQL changes",
            "Deploy",
            "Approved code reaches the target workspace",
            "ADF",
            "Pipeline passes parameters / triggers the workload",
            "Job",
            "Databricks runs transformation on compute",
            "Output",
            "Write curated data + checks"
          ],
          note: ""
        }
      ]
    },
    {
      id: "etl-recap",
      title: "ETL recap, hands-on & careers",
      slides: [
        {
          title: "Building the puzzle: recap & hands-on",
          bullets: [
            "Exercise 1 — SQL",
            "Create a sales query: filter by date join customer data aggregate by customer add a data-quality check",
            "Exercise 2 — Databricks",
            "Read a CSV / Parquet file → clean duplicates → add a derived column → write curated output.",
            "Exercise 3 — ADF",
            "Build: Trigger → Copy / Lookup → Databricks → success/failure. Parameterize the date.",
            "Mini challenge: draw the architecture before opening any Azure screen.",
            "✓ Can I explain ETL vs ELT?",
            "✓ Can I write a clean SQL JOIN?",
            "✓ Can I explain Blob vs SQL Server?"
          ],
          note: ""
        },
        {
          title: "Where These Skills Can Take You",
          bullets: [
            "Data Engineer",
            "SQL → ETL → ADF → Databricks / Spark → cloud architecture",
            "Analytics Engineer",
            "SQL → dimensional modeling → dbt / warehouse → BI",
            "BI Developer",
            "SQL → semantic models → Power BI → business storytelling",
            "Platform / DevOps",
            "Git → CI/CD → IaC → monitoring → cloud operations",
            "Recommendation: build strong SQL + data fundamentals first, then specialize."
          ],
          note: ""
        },
        {
          title: "Thank you!",
          bullets: [
            "Santoshini Panda",
            "Santoshini.panda@ferguson.com",
            "Start small. Build one pipeline. Understand every box.",
            "Questions / Discussion",
            "SQL Azure Blob ADF Databricks GitHub"
          ],
          note: ""
        }
      ]
    }
  ]
};
