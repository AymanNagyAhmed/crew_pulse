# 🚀 CrewPulse

**CrewPulse** is a scalable, low-latency workforce management and biometric tracking platform built specifically for catering companies, event agencies, and hospitality operations. It replaces legacy check-in workflows with real-time computer vision, ensuring seamless multi-venue crew tracking and automated attendance auditing.

---

## ✨ Key Features

- **Contactless Facial Recognition:** High-speed biometric identification optimized for multi-angle and varied lighting conditions at venue entrances.
- **Multi-Venue Shift Sync:** Real-time logging of staff arrivals, departures, and role assignments across concurrent events.
- **Asynchronous Processing Pipeline:** Event-driven architecture handling peak check-in queues without bottlenecks.
- **Audit & Compliance Ready:** Comprehensive logging and secure embedding storage adhering to modern data privacy standards.

---

## 🛠️ Tech Stack

- **Computer Vision & AI:** Python, OpenCV, DeepFace / RetinaFace, NumPy
- **Backend Core:** Node.js / NestJS, TypeScript, Python (FastAPI microservice for vision processing)
- **Data & Message Broker:** PostgreSQL (with vector indexing), Redis, BullMQ / Kafka KRaft
- **Infrastructure & Deployment:** Docker, Docker Compose, Nginx

---

## 📁 Project Architecture

```text
crewpulse/
├── services/
│   ├── api-gateway/       # NestJS core API & business logic
│   ├── vision-engine/     # FastAPI Python service for face detection & embeddings
│   └── worker-node/       # Background job queue processing (attendance logs, webhooks)
├── infrastructure/        # Docker compose, database migrations, and env configs
└── docs/                  # System architecture diagrams and API specs