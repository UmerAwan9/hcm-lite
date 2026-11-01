# HCM Lite MVP (MERN)

## Requirements
- Node.js 20+
- MongoDB connection string (Atlas or local MongoDB)

## Run
1. Extract the zip.
2. Backend:
   - `cd backend`
   - Copy `.env.example` to `.env` and set `MONGO_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
   - `npm install`
   - `npm run dev`
3. Frontend (new terminal):
   - `cd frontend`
   - `npm install`
   - `npm run dev`
4. Open the Vite URL shown in the terminal.

First admin account is created automatically on backend startup if it doesn't exist.
This is an MVP scaffold, not a finished production system. AI, PDF payslips, camera/geofence, CSV import/export,
notifications, audit UI and strict payroll locking need further implementation before claiming full brief compliance.
