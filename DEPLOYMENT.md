# 🚀 Vercel Deployment Guide: Independent Frontend & Backend Architecture

This guide explains how to deploy **CertifyAI** on **Vercel** with the **Backend** (FastAPI Serverless) and **Frontend** (Vite + React) deployed as two decoupled projects connected via API.

---

## 🏗 Architecture Overview

```mermaid
graph LR
    User([Browser Client]) -->|HTTPS| Frontend[Vercel Frontend: React SPA]
    Frontend -->|REST API / SSE| Backend[Vercel Backend: FastAPI Serverless]
    Backend -->|PostgreSQL Wire| NeonDB[(Neon Cloud PostgreSQL)]
```

- **Frontend**: Static SPA hosted on Vercel Edge Network (`https://certifyai-frontend.vercel.app`).
- **Backend**: Python Serverless Functions running FastAPI on Vercel (`https://certifyai-backend.vercel.app`).
- **Database**: Cloud Neon PostgreSQL already connected & seeded.

---

## 📦 Step 1: Deploy the Backend to Vercel

1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **"Add New Project"** → **Import your GitHub Repository**.
3. In the project setup screen:
   - **Project Name**: `certifyai-backend` (or your choice)
   - **Framework Preset**: `Other`
   - **Root Directory**: Click **Edit** and choose `backend`
4. Expand **Environment Variables** and add:
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `DATABASE_URL` | `postgresql://neondb_owner:npg_xpW4vCeoiaq0@ep-sparkling-truth-b4hzi3a8-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require` | Neon Postgres Connection |
   | `ADMIN_USERNAME` | `admin` | Admin login |
   | `ADMIN_PASSWORD` | `admin` | Admin password |
   | `USER_USERNAME` | `user` | User login |
   | `USER_PASSWORD` | `user` | User password |
5. Click **Deploy**.
6. Once deployed, note your **Backend URL** (e.g. `https://certifyai-backend.vercel.app`).
   - Test it by visiting `https://certifyai-backend.vercel.app/api/health` — it will return:
     ```json
     {
       "status": "healthy",
       "service": "CertifyAI Enterprise Governance API",
       "version": "10.3.0",
       "engine": "FastAPI on Vercel Serverless / Cloud"
     }
     ```

---

## 🎨 Step 2: Deploy the Frontend to Vercel

1. In [Vercel Dashboard](https://vercel.com), click **"Add New Project"** → **Import the same GitHub Repository**.
2. In the project setup screen:
   - **Project Name**: `certifyai-frontend` (or your choice)
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click **Edit** and choose `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Expand **Environment Variables** and add:
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `VITE_API_URL` | `https://certifyai-backend.vercel.app` | **Your actual Backend Vercel URL from Step 1** (without trailing slash) |
4. Click **Deploy**.
5. Once deployed, your Frontend is live at `https://certifyai-frontend.vercel.app`!

---

## 🔄 Testing the Live Connection

1. Open your live Frontend URL in the browser.
2. Log in with either:
   - **Admin Account**: Email/Username `syed` or `admin`, Password `admin`
   - **User Account**: Email/Username `ismeet` or `user`, Password `user`
3. The Frontend will automatically route all authentication, test runs, and analytics requests to your deployed Vercel backend.

---

## 🛠 Local Development (Running Locally)

To run both services locally on your machine:

1. **Start Backend**:
   ```bash
   cd backend
   python backend.py
   # Running on http://127.0.0.1:8000
   ```
2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   # Running on http://localhost:5173
   ```
