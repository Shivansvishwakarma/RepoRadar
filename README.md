# 🛰️ RepoRadar — AI-Powered GitHub Repository Analyzer

**Explore repositories. Understand project structure. Generate actionable code insights.**

RepoRadar is a web-based developer tool that helps you explore public GitHub repositories, navigate their file structures, and generate structured repository analysis reports using Google's Gemini API, with a rule-based fallback when AI analysis is unavailable.

🔗 **Live Demo:** [Try RepoRadar](https://repo-radar-hhl4.vercel.app/)  
📦 **Source Code:** [GitHub Repository](https://github.com/Shivansvishwakarma/RepoRadar)

---

## ✨ Features

- **🔍 GitHub Repository Exploration** — Enter a public GitHub repository URL to retrieve repository information and explore its contents.
- **🌳 Interactive File Tree** — Browse repository directories and files through a recursive file-tree explorer.
- **🔎 File Search and Selection** — Search the repository structure and select files for analysis.
- **🤖 AI-Powered Analysis** — Generate repository insights using the Gemini API when the service is available.
- **🛟 Fallback Analysis** — Use rule-based analysis when AI generation is unavailable, such as during API quota exhaustion.
- **📊 Structured Analysis Reports** — Review repository findings through a readable report interface.
- **📝 Markdown Rendering** — Display formatted analysis reports using Markdown.
- **📋 Copy and Export** — Copy reports or export them as Markdown for documentation and further review.
- **👁️ Flexible Report View** — Show or hide the generated report as needed.

## 🛠️ Tech Stack

| Area | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript |
| Styling | CSS |
| Markdown | react-markdown |
| Backend | Python, FastAPI |
| HTTP Requests | httpx |
| Configuration | python-dotenv |
| AI Integration | Google Gemini API |
| Deployment | Vercel |

## 🏗️ Architecture

RepoRadar separates its user interface from its API and analysis logic.

```text
                  ┌────────────────────────┐
                  │        User            │
                  └────────────┬───────────┘
                               │
                               ▼
                  ┌────────────────────────┐
                  │   React + Vite UI      │
                  │ Repository Explorer    │
                  └────────────┬───────────┘
                               │ HTTP requests
                               ▼
                  ┌────────────────────────┐
                  │    FastAPI Backend     │
                  │ Repository API         │
                  └────────────┬───────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
          ┌─────────────────┐  ┌─────────────────┐
          │ GitHub Data     │  │ Gemini API      │
          │ Retrieval       │  │ AI Analysis     │
          └─────────────────┘  └────────┬────────┘
                                        │
                              AI unavailable?
                                        │
                                        ▼
                              ┌─────────────────┐
                              │ Rule-Based      │
                              │ Fallback        │
                              └─────────────────┘
```

The frontend communicates with the FastAPI backend, which retrieves repository data and generates analysis results. When Gemini is unavailable, the backend can fall back to rule-based reporting.

## 🚀 Getting Started

Follow these steps to run RepoRadar locally.

### Prerequisites

- [Node.js and npm](https://nodejs.org/)
- [Python 3.10+](https://www.python.org/) (a compatible Python version for the backend dependencies)
- Git
- A Gemini API key for AI-powered analysis

### 1. Clone the repository

```bash
git clone https://github.com/Shivansvishwakarma/RepoRadar.git
cd RepoRadar
```

### 2. Configure the backend

Open a terminal in the project root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

**Windows PowerShell:**

```powershell
.\.venv\Scripts\Activate.ps1
```

**Windows Command Prompt:**

```bat
.venv\Scripts\activate.bat
```

Install the dependencies:

```bash
python -m pip install -r requirements.txt
```

Create a `.env` file inside the `backend` directory and configure your Gemini API key:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Keep your real API key private. Never commit your `.env` file or expose the key in frontend code.

Start the backend:

```bash
uvicorn main:app --reload
```

The backend should be available at:

- API: `http://127.0.0.1:8000`
- Interactive API documentation: `http://127.0.0.1:8000/docs`

### 3. Configure the frontend

Open a **second terminal** from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, typically `http://localhost:5173`.

> **Note:** The deployed frontend currently uses the production backend URL. To run the frontend locally against your local FastAPI server, configure the development API base URL and Vite proxy consistently with the project's frontend configuration.

### 4. Build for production

From the `frontend` directory:

```bash
npm run build
```

Vite generates the production build in the `dist` directory.

## 🔌 API Overview

The FastAPI backend exposes the following API routes:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend health |
| POST | `/api/repository` | Retrieve repository information |
| POST | `/api/repository/tree` | Retrieve repository file-tree data |
| POST | `/api/repository/analyze` | Generate a repository analysis report |

Interactive endpoint documentation is available at `/docs` when the backend is running.

## ⚙️ Configuration

RepoRadar uses environment variables for backend configuration.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | API key for Gemini-powered analysis |
| `GEMINI_MODEL` | Optional Gemini model override; the backend defines a default |

The Gemini API has usage and quota limits. If AI generation cannot be completed, RepoRadar can use its fallback analysis path instead.

## 🧪 Testing

The backend test suite has previously passed **15 tests** during development, and the frontend production build has completed successfully.

To run the project's tests, inspect the repository's current test configuration and use the relevant test command.

## 🔒 Limitations

- Repository exploration is intended for public GitHub repositories.
- AI-generated insights depend on Gemini API availability and quota.
- Fallback reports may provide less detailed insights than AI-generated reports.
- Analysis depends on the repository data and files available to the application.
- RepoRadar analyzes repository content; it does not execute repository code.

## 🎯 Why RepoRadar?

Understanding an unfamiliar codebase can take time. RepoRadar brings repository exploration and structured analysis into one interface, helping developers inspect project organization and get an initial overview without manually navigating every file.

The project also demonstrates practical integration of a modern React frontend, a Python API backend, external services, resilient fallback behavior, and cloud deployment.

## 🗺️ Future Improvements

Potential directions for future development include:

- Repository language and dependency insights
- More detailed architecture and module relationship analysis
- Improved filtering and navigation for large repositories
- Analysis history and downloadable report formats
- Expanded test coverage and error handling
- More detailed repository metrics and visualizations

## 👨‍💻 Author

**Shivansh Vishwakarma**

- GitHub: [@Shivansvishwakarma](https://github.com/Shivansvishwakarma)
- Project: [RepoRadar](https://github.com/Shivansvishwakarma/RepoRadar)
- Live Demo: [RepoRadar on Vercel](https://repo-radar-hhl4.vercel.app/)

---

*Built to make exploring and understanding GitHub repositories easier.*

If RepoRadar is useful to you, consider giving the repository a ⭐ on GitHub!
