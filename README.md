# WhatsApp-Style Email Chat

A simple full-stack WhatsApp-style 1-to-1 chat app:
- Register/login with email + password
- Search users by exact email
- Start a direct chat
- Real-time messages with Socket.IO
- Online/offline status
- Typing indicator
- Message timestamps
- Responsive WhatsApp-inspired UI

## Stack
Frontend: React + Vite + Axios + Socket.IO Client
Backend: Node.js + Express + MongoDB/Mongoose + Socket.IO + JWT + bcryptjs

## Requirements
- Node.js 18+
- MongoDB Atlas or local MongoDB

## Run backend
cd backend
copy .env.example .env
# Put your MongoDB URI and JWT secret in .env
npm install
npm run dev

## Run frontend
cd frontend
copy .env.example .env
npm install
npm run dev

Open the Vite URL shown in the terminal.

## Important
This is a WhatsApp-inspired learning project, not the official WhatsApp service. Do not use WhatsApp trademarks/assets as your own brand.

## Search behavior
Users are searchable by exact email. The backend only returns safe public profile fields (name, email, avatar, online status).
