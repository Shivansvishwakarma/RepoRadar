
import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.css'

const API_BASE = `${(import.meta.env.API_BASE_URL || '').replace(/\/$/, '')}/api`

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString()
}

function formatDate(value) {
  if (!value) return 'Unknown'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
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

function validateGitHubUrl(value) {
  try {
    const parsed = new URL(value)

    if (
      parsed.protocol !== 'https:' ||
      !['github.com', 'www.github.com'].includes(
        parsed.hostname.toLowerCase(),
      )
    ) {
      return null
    }

    const parts = parsed.pathname.split('/').filter(Boolean)

    if (parts.length !== 2) return null

    const [owner, repository] = parts
    const cleanRepository = repository.replace(/\.git$/i, '')

    if (
      !owner ||
      !cleanRepository ||
      owner.startsWith('-') ||
      cleanRepository.startsWith('-')
    ) {
      return null
    }

    return `https://github.com/${owner}/${cleanRepository}`
  } catch {
    return null
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

  const [aiAnalysis, setAiAnalysis] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiReportVisible, setAiReportVisible] = useState(true)
  const [copyStatus, setCopyStatus] = useState('')

  async function exploreRepository(event) {
    event.preventDefault()

    const cleanUrl = validateGitHubUrl(url.trim())

    if (!cleanUrl) {
      setError(
        'Enter a valid public GitHub URL, such as https://github.com/tiangolo/fastapi',
      )
      return
    }

    setLoading(true)
    setError('')
    setRepository(null)
    setTree(null)
    setSearch('')
    setAiAnalysis(null)
    setAiError('')
    setCopyStatus('')

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
          getErrorMessage(repoData, 'Could not load repository details.'),
        )
      }

      if (!treeResponse.ok) {
        throw new Error(
          getErrorMessage(treeData, 'Could not load the repository file tree.'),
        )
      }

      setUrl(cleanUrl)
      setRepository(repoData)
      setTree(treeData)
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Cannot connect to the backend. Make sure FastAPI is running and the frontend proxy is configured.'
          : err.message || 'Something went wrong while exploring the repository.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function analyzeRepository() {
    if (!repository || aiLoading) return

    const startedAt = performance.now()

    setAiLoading(true)
    setAiError('')
    setAiAnalysis(null)
    setCopyStatus('')

    try {
      const response = await fetch(`${API_BASE}/repository/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: repository.url || url,
        }),
      })

      const data = await readResponse(response)

      if (!response.ok) {
        throw new Error(
          getErrorMessage(data, 'Could not analyze this repository.'),
        )
      }

      if (
        typeof data.analysis !== 'string' ||
        !data.analysis.trim()
      ) {
        throw new Error(
          'The server returned an empty analysis. Check the backend response.',
        )
      }

      const filesAnalyzed = Array.isArray(data.files_analyzed)
        ? data.files_analyzed
            .map((file) =>
              typeof file === 'string' ? file : file?.path,
            )
            .filter(
              (file) =>
                typeof file === 'string' && file.trim().length > 0,
            )
        : []

      setAiAnalysis({
        ...data,
        files_analyzed: filesAnalyzed,
        duration_seconds: Number(
          ((performance.now() - startedAt) / 1000).toFixed(2),
        ),
      })

      setAiReportVisible(true)
    } catch (err) {
      setAiError(
        err instanceof TypeError
          ? 'Cannot connect to the backend. Check that FastAPI is running.'
          : err.message || 'Something went wrong during analysis.',
      )
    } finally {
      setAiLoading(false)
    }
  }

  const items = Array.isArray(tree?.items) ? tree.items : []

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()

    return items.filter((item) => {
      const matchesSearch = String(item.path ?? '')
        .toLowerCase()
        .includes(query)

      const matchesType = showFiles || item.type === 'tree'

      return matchesSearch && matchesType
    })
  }, [items, search, showFiles])

  const folderCount = items.filter(
    (item) => item.type === 'tree',
  ).length

  const fileCount = items.length - folderCount

  const isFallback = aiAnalysis?.analysis_source === 'fallback'

  async function copyReport() {
    if (!aiAnalysis?.analysis) return

    try {
      await navigator.clipboard.writeText(aiAnalysis.analysis)
      setCopyStatus('Report copied')
    } catch {
      setCopyStatus('Copy unavailable in this browser')
    }

    window.setTimeout(() => setCopyStatus(''), 2500)
  }

  function downloadReport() {
    if (!aiAnalysis?.analysis) return

    const content = [
      `# ${aiAnalysis.repository || repository?.full_name || 'Repository Analysis'}`,
      '',
      `Branch: ${aiAnalysis.branch || 'Unknown'}`,
      `Analysis mode: ${isFallback ? 'Fallback' : 'AI'}`,
      `Files analyzed: ${aiAnalysis.files_analyzed.length}`,
      `Analysis duration: ${aiAnalysis.duration_seconds ?? 'Unknown'} seconds`,
      '',
      '## Files included',
      ...(aiAnalysis.files_analyzed.length
        ? aiAnalysis.files_analyzed.map((path) => `- ${path}`)
        : ['- No source files confirmed']),
      '',
      '## Analysis',
      '',
      aiAnalysis.analysis,
    ].join('\n')

    const blob = new Blob([content], {
      type: 'text/markdown;charset=utf-8',
    })

    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = objectUrl
    link.download = 'reporadar-analysis.md'
    document.body.appendChild(link)
    link.click()
    link.remove()

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }

  return (
    <main className="app-shell" id="home">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="RepoRadar home">
          <span className="brand-mark">R</span>
          <span>Repo<span className="brand-accent">Radar</span></span>
        </a>

        <div className="topbar-right">
          <span className="topbar-label">
            <span className="status-dot" />
            GitHub repository explorer
          </span>
          <span className="version-label">BETA</span>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-icon">✳</span>
              YOUR CODEBASE, DECODED
            </div>

            <h1>
              Less guessing.
              <br />
              <span className="gradient-text">More understanding.</span>
            </h1>

            <p className="hero-description">
              Explore repository structure, identify key technologies,
              and get a developer-friendly guide to unfamiliar code.
            </p>

            <div className="hero-points">
              <span><span>✓</span> Repository insights</span>
              <span><span>✓</span> File explorer</span>
              <span><span>✓</span> AI-assisted reports</span>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <div className="visual-core">
              <span className="visual-symbol">R</span>
              <span className="visual-core-label">REPO RADAR</span>
            </div>
            <div className="floating-chip chip-top">
              <span className="chip-dot purple" /> Source code
            </div>
            <div className="floating-chip chip-right">
              <span className="chip-dot green" /> Structure mapped
            </div>
            <div className="floating-chip chip-bottom">
              <span className="chip-dot blue" /> Insights ready
            </div>
          </div>
        </div>

        <form className="search-form" onSubmit={exploreRepository}>
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://github.com/owner/repository"
            aria-label="GitHub repository URL"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? (
              <>
                <span className="button-spinner" />
                Exploring…
              </>
            ) : (
              <>Explore repository <span aria-hidden="true">↗</span></>
            )}
          </button>
        </form>

        <div className="form-bottom-row">
          <p className="form-hint">
            <span>↳</span> Works with public GitHub repositories
          </p>
          <span className="privacy-note">
            <span>⌑</span> No code execution
          </span>
        </div>

        {error && (
          <div className="error-message" role="alert">
            <span className="message-icon">!</span>
            <div>
              <strong>Could not explore repository</strong>
              <p>{error}</p>
            </div>
          </div>
        )}
      </section>

      {loading && (
        <section className="loading-panel" aria-live="polite">
          <span className="spinner" />
          <div>
            <strong>Mapping your repository</strong>
            <p>Fetching metadata and building the file tree…</p>
          </div>
        </section>
      )}

      {repository && tree && (
        <section className="results-section">
          <div className="section-heading">
            <div>
              <h2>Start with the big picture</h2>
              <p className="section-subtitle">
                The essentials of your repository, all in one place.
              </p>
            </div>

            <a
              className="secondary-button"
              href={repository.url || url}
              target="_blank"
              rel="noreferrer"
            >
              View on GitHub <span aria-hidden="true">↗</span>
            </a>
          </div>

          <article className="repo-card">
            <div className="repo-card-top">
              <div className="repo-avatar">
                {(repository.name || 'R').slice(0, 1).toUpperCase()}
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
                'No description provided by the repository owner.'}
            </p>

            <div className="stats-grid">
              <div className="stat">
                <span className="stat-icon">☆</span>
                <div>
                  <span className="stat-label">Stars</span>
                  <strong>{formatNumber(repository.stars)}</strong>
                </div>
              </div>

              <div className="stat">
                <span className="stat-icon">⑂</span>
                <div>
                  <span className="stat-label">Forks</span>
                  <strong>{formatNumber(repository.forks)}</strong>
                </div>
              </div>

              <div className="stat">
                <span className="stat-icon">⌁</span>
                <div>
                  <span className="stat-label">Default branch</span>
                  <strong className="stat-value-small">
                    {repository.default_branch || tree.branch || 'Unknown'}
                  </strong>
                </div>
              </div>

              <div className="stat">
                <span className="stat-icon">◷</span>
                <div>
                  <span className="stat-label">Last updated</span>
                  <strong className="stat-value-small">
                    {formatDate(repository.updated_at)}
                  </strong>
                </div>
              </div>
            </div>
          </article>

          <div className="section-heading tree-heading">
            <div>
              <h2>Find your way around</h2>
              <p className="section-subtitle">
                Search paths and see how the project is organized.
              </p>
            </div>
            <span className="item-count">
              {formatNumber(tree.total_items ?? items.length)} items
            </span>
          </div>

          <article className="tree-card">
            <div className="tree-toolbar">
              <div className="tree-tabs" role="group" aria-label="Filter item type">
                <button
                  type="button"
                  className={showFiles ? 'tree-tab active' : 'tree-tab'}
                  onClick={() => setShowFiles(true)}
                >
                  All items <span>{formatNumber(items.length)}</span>
                </button>

                <button
                  type="button"
                  className={!showFiles ? 'tree-tab active' : 'tree-tab'}
                  onClick={() => setShowFiles(false)}
                >
                  Folders <span>{formatNumber(folderCount)}</span>
                </button>
              </div>

              <label className="tree-search-wrap">
                <span aria-hidden="true">⌕</span>
                <input
                  className="tree-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search file paths…"
                  aria-label="Filter repository paths"
                />
                {search && (
                  <button
                    type="button"
                    className="clear-search"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </label>
            </div>

            <div className="tree-summary">
              <span className="branch-label">
                <span aria-hidden="true">⌁</span>
                {tree.branch || repository.default_branch || 'Default branch'}
              </span>
              <span>{tree.truncated ? 'Partial file tree' : 'File tree loaded'}</span>
              <span>
                {formatNumber(fileCount)} files · {formatNumber(folderCount)} folders
              </span>
            </div>

            <div className="file-list">
              {filteredItems.map((item) => {
                const isFolder = item.type === 'tree'
                const extension =
                  !isFolder && item.path?.includes('.')
                    ? item.path.split('.').pop().toUpperCase()
                    : ''

                return (
                  <div className="file-row" key={item.path}>
                    <span className={isFolder ? 'file-icon folder-icon' : 'file-icon'}>
                      {isFolder ? '▰' : '▤'}
                    </span>
                    <span className="file-path" title={item.path}>
                      {item.path}
                    </span>
                    <span className="file-type">
                      {isFolder ? 'Folder' : extension || 'File'}
                    </span>
                    <span className="file-size">
                      {!isFolder && item.size != null
                        ? `${formatNumber(item.size)} B`
                        : '—'}
                    </span>
                  </div>
                )
              })}

              {filteredItems.length === 0 && (
                <div className="empty-state">
                  <span className="empty-state-icon">⌕</span>
                  <strong>No matching paths</strong>
                  <p>Try another search term or clear the search.</p>
                  {search && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setSearch('')}
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )}
            </div>

            {tree.truncated && (
              <p className="tree-note">
                GitHub returned a truncated tree. Some repository items may not be shown.
              </p>
            )}
          </article>

          <section className="ai-section">
            <div className="section-heading">
              <div>
                <h2>Understand the codebase</h2>
                <p className="section-subtitle">
                  Turn selected repository files into a practical developer guide.
                </p>
              </div>

              <button
                type="button"
                className="primary-button ai-analyze-button"
                onClick={analyzeRepository}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <>
                    <span className="button-spinner" />
                    Analyzing…
                  </>
                ) : (
                  <>{aiAnalysis ? '↻ Analyze again' : '✳ Analyze with AI'}</>
                )}
              </button>
            </div>

            <div className="ai-feature-row">
              <div className="ai-feature">
                <span className="ai-feature-icon">⌘</span>
                <div>
                  <strong>Architecture</strong>
                  <span>Understand key components</span>
                </div>
              </div>
              <div className="ai-feature">
                <span className="ai-feature-icon">⌁</span>
                <div>
                  <strong>Technologies</strong>
                  <span>Identify tools and frameworks</span>
                </div>
              </div>
              <div className="ai-feature">
                <span className="ai-feature-icon">↗</span>
                <div>
                  <strong>Next steps</strong>
                  <span>Find practical improvements</span>
                </div>
              </div>
            </div>

            {aiLoading && (
              <div className="ai-status" aria-live="polite">
                <span className="spinner" />
                <div>
                  <strong>Reading repository context…</strong>
                  <p>
                    Retrieving relevant files and preparing your report.
                    This can take a little while.
                  </p>
                </div>
              </div>
            )}

            {aiError && (
              <div className="error-message" role="alert">
                <span className="message-icon">!</span>
                <div>
                  <strong>Analysis failed</strong>
                  <p>{aiError}</p>
                </div>
              </div>
            )}

            {!aiAnalysis && !aiLoading && !aiError && (
              <div className="analysis-empty">
                <div className="empty-orbit"><span>✳</span></div>
                <h3>Your codebase guide starts here</h3>
                <p>
                  Run an analysis to get an overview, important file paths,
                  code-quality observations, and suggested next steps.
                </p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={analyzeRepository}
                >
                  Generate repository guide <span>↗</span>
                </button>
              </div>
            )}

            {aiAnalysis && (
              <article className="ai-report">
                <div className="ai-report-header">
                  <div className="report-heading-main">
                    <div className="report-icon">✳</div>
                    <div>
                      <div className="section-kicker">REPOSITORY REPORT</div>
                      <h3>{aiAnalysis.repository || repository.full_name}</h3>
                    </div>
                  </div>

                  <span className={isFallback ? 'source-badge fallback-badge' : 'source-badge ai-badge'}>
                    <span className="source-dot" />
                    {isFallback ? 'Fallback analysis' : 'AI analysis'}
                  </span>
                </div>

                {isFallback && (
                  <div className="report-notice">
                    <strong>AI service unavailable</strong>
                    <p>
                      This report was generated by RepoRadar’s rule-based fallback.
                      Treat it as a starting point, not as a complete AI code review.
                    </p>
                  </div>
                )}

                <div className="report-metrics">
                  <div>
                    <span>Branch</span>
                    <strong>{aiAnalysis.branch || 'Unknown'}</strong>
                  </div>
                  <div>
                    <span>Files retrieved</span>
                    <strong>{aiAnalysis.files_analyzed.length}</strong>
                  </div>
                  <div>
                    <span>Report type</span>
                    <strong>{isFallback ? 'Rule-based' : 'Generated'}</strong>
                  </div>
                  <div>
                    <span>Duration</span>
                    <strong>
                      {aiAnalysis.duration_seconds != null
                        ? `${aiAnalysis.duration_seconds}s`
                        : 'Unknown'}
                    </strong>
                  </div>
                </div>

                {aiAnalysis.files_analyzed.length > 0 ? (
                  <details className="analyzed-files">
                    <summary>
                      <span>Files included in this analysis</span>
                      <span className="details-count">
                        {aiAnalysis.files_analyzed.length}
                      </span>
                    </summary>
                    <ul>
                      {aiAnalysis.files_analyzed.map((path, index) => (
                        <li key={`${path}-${index}`}>
                          <code>{path}</code>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <div className="report-notice">
                    <strong>No source files were confirmed as retrieved</strong>
                    <p>
                      The report may rely mainly on repository metadata and file-tree information.
                    </p>
                  </div>
                )}

                <div className="ai-report-toolbar">
                  <span className="report-reading-label">REPORT CONTENT</span>
                  <div>
                    <button
                      type="button"
                      className="report-action"
                      onClick={copyReport}
                    >
                      {copyStatus === 'Report copied' ? '✓ Copied' : 'Copy report'}
                    </button>
                    <button
                      type="button"
                      className="report-action"
                      onClick={downloadReport}
                    >
                      ↓ Export Markdown
                    </button>
                    <button
                      type="button"
                      className="report-action"
                      onClick={() => setAiReportVisible((visible) => !visible)}
                    >
                      {aiReportVisible ? 'Hide report' : 'Show report'}
                    </button>
                  </div>
                </div>

                {copyStatus && copyStatus !== 'Report copied' && (
                  <p className="copy-status" role="status">{copyStatus}</p>
                )}

                {aiReportVisible && (
                  <div className="ai-report-content">
                    <ReactMarkdown>{aiAnalysis.analysis}</ReactMarkdown>
                  </div>
                )}
              </article>
            )}
          </section>
        </section>
      )}

      <footer className="footer">
        <a className="footer-brand" href="#home">
          <span className="brand-mark footer-mark">R</span>
          RepoRadar
        </a>
        <span>Understand the codebase before you dive in.</span>
        <span className="footer-note">Built for developers · 2026</span>
      </footer>
    </main>
  )
}

export default App
