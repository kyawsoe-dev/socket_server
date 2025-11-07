# KS Chat App – Backend

A **real-time chat backend** built with **Node.js**, **Express**, and **Socket.IO**.  
It powers instant messaging, group chats, typing indicators, online status, WebRTC signaling, and push notifications.

---

## Features

- **Real-time messaging** via **Socket.IO** (WebSocket + fallback)
- **Private & group conversations** with ownership & member roles
- **Typing indicators** (per-conversation)
- **Online/offline tracking** with `lastActive` timestamps
- **Message editing & deletion** (for everyone)
- **WebRTC signaling** (1:1 & group calls)
- **TURN credential provisioning** (via Xirsys or Metered)
- **Push notifications** (VAPID + Web Push)
- **JWT authentication** with refresh & validation middleware
- **Rate limiting** & input sanitization
- **CORS** & secure headers
- **REST API** fallback for offline clients

---

## Tech Stack

| Layer             | Technology                                                                 |
|-------------------|----------------------------------------------------------------------------|
| **Runtime**       | [Node.js](https://nodejs.org) (>= 18)                                      |
| **Framework**     | [Express.js](https://expressjs.com)                                        |
| **Realtime**      | [Socket.IO](https://socket.io)                                             |
| **Database**      | PostgreSQL (via [Prisma ORM](https://prisma.io))                           |
| **WebRTC**        | Signaling only (ICE via STUN/TURN)                                         |
| **Push**          | Web Push Protocol, VAPID keys                                              |
| **Dev Tools**     | `nodemon`, `dotenv`, `prisma`                                              |
| **Deployment**    | Render, Railway, or any Node.js host                                       |

---