
import { useState } from 'react'
import './App.css'

const API_BASE = '/api'

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString()
}

function formatDate(value) {
  if (!value) return 'Unknown'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toLocaleDateString()
}

function getErrorMessage(data, fallback) {
  if (typeof data?.detail === 'string') return data.detail

  if (Array.isArray(data?.detail)) {
    return data.detail.map((item) => item.msg).join(', ')
  }

  return fallback
}

async function readResponse(response) {
  const text = await response.text()

  try {
    return text ? JSON.parse(text) : {}
  } catch {
    throw new Error('The server returned an invalid response.')
  }
}

function App() {
  const [url, setUrl] = useState(
    'https://github.com/tiangolo/fastapi',
  )
  const [repository, setRepository] = useState(null)
  const [tree, setTree] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showFiles, setShowFiles] = useState(true)

  // AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiReportVisible, setAiReportVisible] = useState(false)

  async function exploreRepository(event) {
    event.preventDefault()

    const trimmedUrl = url.trim()

    if (
      !/^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(trimmedUrl)
    ) {
      setError(
        'Enter a public GitHub repository URL, such as https://github.com/tiangolo/fastapi',
      )
      return
    }

    const cleanUrl = trimmedUrl.replace(/\/+$/, '')

    setLoading(true)
    setError('')
    setRepository(null)
    setTree(null)
    setSearch('')
    setAiAnalysis(null)
    setAiError('')
    setAiReportVisible(false)

    try {
      const [repoResponse, treeResponse] = await Promise.all([
        fetch(`${API_BASE}/repository`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: cleanUrl }),
        }),
        fetch(`${API_BASE}/repository/tree`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: cleanUrl }),
        }),
      ])

      const [repoData, treeData] = await Promise.all([
        readResponse(repoResponse),
        readResponse(treeResponse),
      ])

      if (!repoResponse.ok) {
        throw new Error(
          getErrorMessage(
            repoData,
            'Could not load repository details.',
          ),
        )
      }

      if (!treeResponse.ok) {
        throw new Error(
          getErrorMessage(
            treeData,
            'Could not load the repository file tree.',
          ),
        )
      }

      setRepository(repoData)
      setTree(treeData)
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Cannot connect to the backend. Make sure FastAPI is running at http://127.0.0.1:8000.'
          : err.message ||
              'Something went wrong while exploring the repository.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function analyzeRepository() {
    if (!repository || aiLoading) return

    setAiLoading(true)
    setAiError('')
    setAiAnalysis(null)
    setAiReportVisible(false)

    try {
      const response = await fetch(
        `${API_BASE}/repository/analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: repository.url || url.trim().replace(/\/+$/, ''),
          }),
        },
      )

      const data = await readResponse(response)

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            'Could not analyze this repository.',
          ),
        )
      }

      if (
        typeof data.analysis !== 'string' ||
        !data.analysis.trim()
      ) {
        throw new Error(
          'The AI response did not contain a readable analysis. Check the backend response format.',
        )
      }

      setAiAnalysis(data)
      setAiReportVisible(true)
    } catch (err) {
      setAiError(
        err instanceof TypeError
          ? 'Cannot connect to the backend. Check that FastAPI is running.'
          : err.message ||
              'Something went wrong during AI analysis.',
      )
    } finally {
      setAiLoading(false)
    }
  }

  const items = Array.isArray(tree?.items) ? tree.items : []

  const filteredItems = items.filter((item) =>
    String(item.path ?? '')
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  const folders = filteredItems.filter(
    (item) => item.type === 'tree',
  )

  const visibleItems = showFiles
    ? filteredItems
    : folders

  return (
    <main className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#home"
          aria-label="RepoRadar home"
        >
          <span className="brand-mark">R</span>
          <span>
            Repo<span className="brand-accent">Radar</span>
          </span>
        </a>

        <span className="topbar-label">
          <span className="status-dot" />
          GitHub repository explorer
        </span>
      </header>

      <section className="hero-section" id="home">
        <div className="eyebrow">
          <span className="eyebrow-icon">✳</span>
          UNDERSTAND REPOSITORIES FASTER
        </div>

        <h1>
          Every repository.
          <br />
          <span className="gradient-text">
            A clearer picture.
          </span>
        </h1>

        <p className="hero-description">
          Explore project structure, discover technologies, and get
          a clearer view of any public GitHub repository.
        </p>

        <form
          className="search-form"
          onSubmit={exploreRepository}
        >
          <span className="search-icon" aria-hidden="true">
            ⌕
          </span>

          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://github.com/owner/repository"
            aria-label="GitHub repository URL"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? 'Exploring…' : 'Explore repository'}
            {!loading && (
              <span aria-hidden="true"> ↗</span>
            )}
          </button>
        </form>

        <p className="form-hint">
          <span>↳</span> Start with any public GitHub repository
        </p>

        {error && (
          <div className="error-message" role="alert">
            <strong>Something went wrong</strong>
            <span>{error}</span>
          </div>
        )}
      </section>

      {loading && (
        <section
          className="loading-panel"
          aria-live="polite"
        >
          <span className="spinner" />
          <div>
            <strong>Mapping your repository…</strong>
            <p>
              Fetching repository details and file structure.
            </p>
          </div>
        </section>
      )}

      {repository && tree && (
        <section className="results-section">
          <div className="section-heading">
            <div>
              <div className="section-kicker">
                REPOSITORY OVERVIEW
              </div>
              <h2>Your repository at a glance</h2>
            </div>

            <a
              className="github-link"
              href={repository.url || url}
              target="_blank"
              rel="noreferrer"
            >
              View on GitHub ↗
            </a>
          </div>

          <article className="repo-card">
            <div className="repo-card-top">
              <div className="repo-avatar">
                {(repository.name || 'R')
                  .slice(0, 1)
                  .toUpperCase()}
              </div>

              <div className="repo-title">
                <a
                  href={repository.url || url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {repository.full_name || repository.name}
                </a>

                <span className="visibility-label">
                  <span className="status-dot" />
                  Public repository
                </span>
              </div>

              <span className="repo-language">
                <span className="language-dot" />
                {repository.language || 'Multiple languages'}
              </span>
            </div>

            <p className="repo-description">
              {repository.description ||
                'No description provided.'}
            </p>

            <div className="stats-grid">
              <div className="stat">
                <span className="stat-label">Stars</span>
                <strong>
                  ☆ {formatNumber(repository.stars)}
                </strong>
              </div>

              <div className="stat">
                <span className="stat-label">Forks</span>
                <strong>
                  ⑂ {formatNumber(repository.forks)}
                </strong>
              </div>

              <div className="stat">
                <span className="stat-label">
                  Default branch
                </span>
                <strong>
                  ⌁{' '}
                  {repository.default_branch ||
                    tree.branch ||
                    'Unknown'}
                </strong>
              </div>

              <div className="stat">
                <span className="stat-label">
                  Last updated
                </span>
                <strong>
                  {formatDate(repository.updated_at)}
                </strong>
              </div>
            </div>
          </article>

          <div className="section-heading tree-heading">
            <div>
              <div className="section-kicker">
                SOURCE EXPLORER
              </div>
              <h2>Explore the file structure</h2>
            </div>

            <span className="item-count">
              {formatNumber(
                tree.total_items ?? items.length,
              )}{' '}
              items
            </span>
          </div>

          <article className="tree-card">
            <div className="tree-toolbar">
              <div className="tree-tabs">
                <button
                  type="button"
                  className={
                    showFiles
                      ? 'tree-tab active'
                      : 'tree-tab'
                  }
                  onClick={() => setShowFiles(true)}
                >
                  All items{' '}
                  <span>{formatNumber(items.length)}</span>
                </button>

                <button
                  type="button"
                  className={
                    !showFiles
                      ? 'tree-tab active'
                      : 'tree-tab'
                  }
                  onClick={() => setShowFiles(false)}
                >
                  Folders{' '}
                  <span>
                    {formatNumber(
                      items.filter(
                        (item) => item.type === 'tree',
                      ).length,
                    )}
                  </span>
                </button>
              </div>

              <input
                className="tree-search"
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Filter paths…"
                aria-label="Filter repository paths"
              />
            </div>

            <div className="tree-summary">
              <span className="branch-label">
                ⌁{' '}
                {tree.branch ||
                  repository.default_branch ||
                  'Default branch'}
              </span>

              <span>
                {tree.truncated
                  ? 'Showing a partial tree'
                  : 'Tree retrieved successfully'}
              </span>
            </div>

            <div className="file-list">
              {visibleItems.map((item, index) => {
                const isFolder = item.type === 'tree'

                return (
                  <div
                    className="file-row"
                    key={`${item.path}-${index}`}
                  >
                    <span
                      className={
                        isFolder
                          ? 'file-icon folder-icon'
                          : 'file-icon'
                      }
                    >
                      {isFolder ? '▰' : '▤'}
                    </span>

                    <span
                      className="file-path"
                      title={item.path}
                    >
                      {item.path}
                    </span>

                    <span className="file-type">
                      {isFolder ? 'Folder' : 'File'}
                    </span>

                    <span className="file-size">
                      {!isFolder && item.size != null
                        ? `${formatNumber(item.size)} B`
                        : '—'}
                    </span>
                  </div>
                )
              })}

              {visibleItems.length === 0 && (
                <div className="empty-state">
                  No matching items. Try a different search.
                </div>
              )}
            </div>

            {tree.truncated && (
              <p className="tree-note">
                GitHub returned a truncated tree. Some files
                may not be shown.
              </p>
            )}
          </article>

          {/* AI analysis section */}
          <section className="ai-section">
            <div className="section-heading">
              <div>
                <div className="section-kicker">
                  AI-POWERED ANALYSIS
                </div>
                <h2>Understand the codebase</h2>
              </div>

              <button
                type="button"
                className="ai-analyze-button"
                onClick={analyzeRepository}
                disabled={aiLoading}
              >
                {aiLoading
                  ? 'Analyzing…'
                  : aiAnalysis
                    ? 'Analyze again'
                    : '✳ Analyze with AI'}
              </button>
            </div>

            <p className="ai-description">
              Get a beginner-friendly explanation of the project,
              its technologies, important files, and possible
              improvements.
            </p>

            {aiLoading && (
              <div
                className="ai-status"
                aria-live="polite"
              >
                <span className="spinner" />
                <div>
                  <strong>
                    Analyzing your repository…
                  </strong>
                  <p>This may take a little while.</p>
                </div>
              </div>
            )}

            {aiError && (
              <div className="error-message" role="alert">
                <strong>Analysis failed</strong>
                <span>{aiError}</span>
              </div>
            )}

            {aiAnalysis && aiReportVisible && (
              <article className="ai-report">
                <div className="ai-report-header">
                  <div>
                    <div className="section-kicker">
                      ANALYSIS REPORT
                    </div>
                    <h3>
                      {aiAnalysis.repository ||
                        repository.full_name}
                    </h3>
                  </div>

                  <button
                    type="button"
                    className="report-toggle"
                    onClick={() =>
                      setAiReportVisible(false)
                    }
                  >
                    Hide report
                  </button>
                </div>

                <p className="ai-report-meta">
                  Branch: {aiAnalysis.branch || 'Unknown'} ·{' '}
                  {Array.isArray(aiAnalysis.files_analyzed)
                    ? aiAnalysis.files_analyzed.length
                    : 0}{' '}
                  files analyzed
                </p>

                {Array.isArray(
                  aiAnalysis.files_analyzed,
                ) &&
                  aiAnalysis.files_analyzed.length > 0 && (
                    <details className="analyzed-files">
                      <summary>View files analyzed</summary>
                      <ul>
                        {aiAnalysis.files_analyzed.map(
                          (path) => (
                            <li key={path}>
                              <code>{path}</code>
                            </li>
                          ),
                        )}
                      </ul>
                    </details>
                  )}

                <div className="ai-report-content">
                  {aiAnalysis.analysis}
                </div>
              </article>
            )}

            {aiAnalysis && !aiReportVisible && (
              <button
                type="button"
                className="report-toggle"
                onClick={() =>
                  setAiReportVisible(true)
                }
              >
                Show report
              </button>
            )}
          </section>
        </section>
      )}

      <footer className="footer">
        <a className="footer-brand" href="#home">
          RepoRadar
        </a>
        <span>
          Understand the codebase before you dive in.
        </span>
        <span>Built for developers · 2026</span>
      </footer>
    </main>
  )
}

export default App
