# Schedula – Smart Doctor Appointment Scheduling API 🏥

[![NestJS](https://img.shields.io/badge/NestJS-v11-red?logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-UNLICENSED-lightgrey)](LICENSE)

> A production-grade RESTful backend for scheduling appointments between patients and doctors. Built with **NestJS**, **TypeORM**, and **PostgreSQL**.

---

## 📑 Table of Contents

- [Features Implemented](#-features-implemented)
- [Tech Stack](#-tech-stack)
- [Project Setup](#-project-setup)
- [Environment Variables](#-environment-variables)
- [Running the App](#-running-the-app)
- [API Reference](#-api-reference)
- [API Collection](#-api-collection)
- [Live Server](#-live-server)
- [GitHub Workflow](#-github-workflow)

---

## ✅ Features Implemented

| # | Feature | Status |
|---|---------|--------|
| 1 | **User Authentication** – JWT-based signup/login with hashed passwords | ✅ Done |
| 2 | **Role-Based Access Control** – Separate `DOCTOR` and `PATIENT` roles with route guards | ✅ Done |
| 3 | **Doctor Profile Management** – Create, read, update doctor profiles | ✅ Done |
| 4 | **Patient Profile Management** – Create, read, update patient profiles | ✅ Done |
| 5 | **Doctor Discovery** – List and filter all doctors; get doctor by ID | ✅ Done |
| 6 | **Doctor Availability System** – Recurring weekly schedules + custom date overrides | ✅ Done |
| 7 | **Available Slot Generation** – Dynamic time slot generation based on doctor's availability and slot duration | ✅ Done |
| 8 | **Appointment Booking** – Patients can book available slots; conflict detection | ✅ Done |
| 9 | **Appointment Cancellation** – Patients can cancel their own appointments | ✅ Done |
| 10 | **View My Appointments** – Patients and doctors can view their scheduled appointments | ✅ Done |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [NestJS](https://nestjs.com/) v11 |
| **Language** | [TypeScript](https://www.typescriptlang.org/) 5.x |
| **Database** | [PostgreSQL](https://www.postgresql.org/) 16 |
| **ORM** | [TypeORM](https://typeorm.io/) |
| **Auth** | JWT + Passport.js + bcrypt |
| **Validation** | class-validator + class-transformer |
| **Testing** | Jest |
| **Hosting** | [Render](https://render.com) |

---

## 🚀 Project Setup

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **PostgreSQL** running locally OR a hosted DB (e.g., Neon, Supabase, Render DB)

### Clone & Install

```bash
# 1. Clone the repository
git clone https://github.com/PRINCE-MEHTA91/Schedula-Prince-kumar.git
cd Schedula-Prince-kumar

# 2. Install all dependencies
npm install
```

---

## 🔑 Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE_NAME

# JWT secret – use a long, random string in production
JWT_SECRET=your_super_secret_jwt_key_here

# (Optional) Server port – defaults to 3000
PORT=3000
```

> ⚠️ **Never commit your `.env` file.** It is already in `.gitignore`.

---

## ▶️ Running the App

```bash
# Development (with file watching)
npm run start:dev

# Standard start
npm run start

# Production (builds first, then runs)
npm run build && npm run start:prod
```

Once started, the server is available at **`http://localhost:3000`**.

### Running Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov
```

---

## 📡 API Reference

> All protected routes require `Authorization: Bearer <token>` header.  
> Get your token from `POST /auth/login`.

---

### 🔐 Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/signup` | ❌ Public | Register a new user (`DOCTOR` or `PATIENT`) |
| `POST` | `/auth/login` | ❌ Public | Login and receive JWT token |
| `GET` | `/auth/profile` | ✅ Any | Get the current authenticated user's profile |

**Signup Body:**
```json
{
  "name": "Dr. Priya Sharma",
  "email": "priya@example.com",
  "password": "securePass123",
  "role": "DOCTOR"
}
```

**Login Body:**
```json
{
  "email": "priya@example.com",
  "password": "securePass123"
}
```

---

### 👨‍⚕️ Doctor Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/doctor/profile` | ✅ DOCTOR | Create doctor profile |
| `GET` | `/doctor/profile` | ✅ DOCTOR | Get own doctor profile |
| `PATCH` | `/doctor/profile` | ✅ DOCTOR | Update own doctor profile |
| `GET` | `/doctor` | ✅ Any | List all doctors (with optional filters) |
| `GET` | `/doctor/:id` | ✅ Any | Get a specific doctor by ID |

**Create Profile Body:**
```json
{
  "fullName": "Dr. Priya Sharma",
  "specialization": "Cardiology",
  "experience": 8,
  "qualification": "MBBS, MD",
  "consultationFee": 500,
  "availabilityHours": "Mon-Fri 10:00-18:00",
  "slotDuration": 15,
  "profileDetails": "Senior cardiologist with 8 years of experience"
}
```

**Query Filters for `GET /doctor`:**
```
?specialization=Cardiology
?name=Priya
?isAvailable=true
```

---

### 🗓️ Doctor Availability

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/doctor/availability` | ✅ DOCTOR | Set recurring weekly availability slot |
| `GET` | `/doctor/availability` | ✅ DOCTOR | Get own recurring availability |
| `PATCH` | `/doctor/availability/:id` | ✅ DOCTOR | Update a recurring availability slot |
| `DELETE` | `/doctor/availability/:id` | ✅ DOCTOR | Delete a recurring availability slot |
| `POST` | `/doctor/availability/override` | ✅ DOCTOR | Add a custom date availability/unavailability |
| `GET` | `/doctor/availability/date?date=YYYY-MM-DD` | ✅ DOCTOR | View own availability on a specific date |
| `GET` | `/doctor/availability/:doctorId/slots?date=YYYY-MM-DD` | ❌ Public | Get available booking slots for a doctor on a date |

**Create Recurring Availability Body:**
```json
{
  "dayOfWeek": "MONDAY",
  "startTime": "10:00",
  "endTime": "17:00"
}
```

**Custom Override Body:**
```json
{
  "date": "2026-07-04",
  "isAvailable": false
}
```
```json
{
  "date": "2026-07-05",
  "isAvailable": true,
  "startTime": "09:00",
  "endTime": "13:00"
}
```

---

### 🧑‍💼 Patient Profile

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/patient/profile` | ✅ PATIENT | Create patient profile |
| `GET` | `/patient/profile` | ✅ PATIENT | Get own patient profile |
| `PATCH` | `/patient/profile` | ✅ PATIENT | Update own patient profile |

**Create Patient Profile Body:**
```json
{
  "fullName": "Ramesh Verma",
  "age": 35,
  "gender": "MALE",
  "contactNumber": "9876543210",
  "address": "123 MG Road, Mumbai"
}
```

---

### 📅 Appointments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/appointments` | ✅ PATIENT | Book an appointment with a doctor |
| `GET` | `/appointments/my` | ✅ PATIENT | View all my appointments |
| `DELETE` | `/appointments/:id` | ✅ PATIENT | Cancel an appointment |
| `POST` | `/appointment` | ✅ PATIENT | Book appointment (alternate route) |
| `GET` | `/appointment/my` | ✅ PATIENT | View appointments (alternate route) |
| `PATCH` | `/appointment/:id` | ✅ PATIENT | Reschedule appointment |
| `PATCH` | `/appointment/:id/cancel` | ✅ PATIENT | Cancel appointment (alternate route) |

**Book Appointment Body:**
```json
{
  "doctorId": 1,
  "date": "2026-07-10",
  "startTime": "10:00"
}
```

---

## 📦 API Collection

The full API collection is included in this repository:

📄 **[`api-collection.json`](./api-collection.json)** — Import this file into **Postman**, **Hoppscotch**, or **Thunder Client**.

### How to import:
- **Postman**: File → Import → Upload `api-collection.json`
- **Hoppscotch**: Collections → Import → Hoppscotch Collection
- **Thunder Client**: View → Command Palette → Thunder Client: Import

---

## 🌐 Live Server

| Environment | URL |
|-------------|-----|
| **Production** |  |
| **Local Dev** | `http://localhost:3000` |

> Health check: `GET /` → `{ "message": "Schedula API is running and healthy!" }`

---

## 🔀 GitHub Workflow

### Branching Strategy

```
main (production-ready)
  └── feature/feature-name         ← New independent feature
  └── fix/bug-description          ← Bug fix
  └── chore/task-description       ← Non-feature work (docs, config)
```

**When to create a branch from `main`:**
> Always branch from `main` when starting a new, independent feature. This ensures you're building on the latest stable code.
```bash
git checkout main
git pull origin main
git checkout -b feature/doctor-availability
```

**When to create a branch from another feature branch:**
> Only when your work directly depends on an unreleased feature from that branch. For example, `feature/appointment-booking` may branch from `feature/doctor-availability` if booking logic needs availability logic that isn't in `main` yet.

### PR (Pull Request) Process

| Step | Description |
|------|-------------|
| 1️⃣ | Push your feature branch to GitHub |
| 2️⃣ | Open a PR targeting `main` |
| 3️⃣ | Write a clear PR description (what changed, why, how to test) |
| 4️⃣ | Teammate reviews → leaves comments/approvals |
| 5️⃣ | Address review feedback |
| 6️⃣ | Merge only after approval + CI passes |

**When should a PR be merged?**
- ✅ All requested changes are addressed
- ✅ At least 1 reviewer has approved
- ✅ No merge conflicts with `main`
- ✅ CI/build passes

**Why PR reviews?**
- Catch bugs before they reach `main`
- Share knowledge across the team
- Keep code quality consistent
- Create a clear audit trail of decisions

### Commits Convention

```
feat: add doctor availability recurring slots
fix: resolve duplicate import in doctor.module
chore: update README with API collection
refactor: simplify appointment booking logic
```

---

## 👨‍💻 Author

**Prince Kumar Mehta**  
GitHub: [@PRINCE-MEHTA91](https://github.com/PRINCE-MEHTA91)

---

## 📝 License

This project is **UNLICENSED** – for educational purposes only.
