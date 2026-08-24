# 🧠 CodeSense — Chat with your Codebase

**CodeSense** is a modern, full-stack AI-powered developer assistant that connects to your GitHub repositories, indexes source code into vector embeddings, and enables semantic question-answering with exact file and line citations.

---

## 🚀 Key Features

- **GitHub OAuth2 Integration**: Connect with your GitHub account to access public and private repositories.
- **Automated AST Code Chunking & Indexing**: Smart token-aware chunking for codebases with support for 25+ programming languages.
- **Vector Search with Qdrant**: 3072-dimensional vector embeddings powered by `gemini-embedding-001`.
- **Software Architect Intelligence with Google Gemini**: Semantic RAG question-answering using `gemini-3.6-flash`.
- **Live Token Streaming (SSE)**: Real-time response streaming with syntax highlighting and clickable file citations.
- **ChatGPT-Style Responsive UI**: Built with React 19, Tailwind CSS v4, and Lucide icons, fully optimized for both desktop and mobile screens.

---

## 🛠️ Tech Stack

### Backend
- **Java 21** / **Spring Boot 4.1.0**
- **Spring Data JPA & Hibernate 7**
- **MySQL 8** (Relational metadata, users, sessions, chat history)
- **Qdrant Vector DB** (gRPC / TLS Vector Store)
- **Google Gemini API** (`gemini-3.6-flash` & `gemini-embedding-001`)

### Frontend
- **React 19** + **TypeScript** + **Vite 6**
- **Tailwind CSS v4** + **Radix / Base UI**
- **TanStack React Query v5**
- **Shiki / React-Markdown** (Syntax highlighting)

---

## 🏁 Getting Started

### 1. Prerequisites
- Java 21+ & Maven
- Node.js 18+ & npm
- MySQL 8+
- Qdrant Vector DB instance (Cloud or Local)
- Google Gemini API Key
- GitHub OAuth App (Client ID & Client Secret)

### 2. Configure Backend
Edit `backend/src/main/resources/application.yml` with your database credentials, Gemini API key, GitHub OAuth app, and Qdrant cluster credentials.

```bash
cd backend
./mvnw spring-boot:run
```
Backend runs on `http://localhost:8080`.

### 3. Start Frontend
```bash
cd client
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`.

---

## 📄 License
MIT License
