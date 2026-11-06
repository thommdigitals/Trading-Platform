# FortunoAI Trading Platform

Institutional-grade web trading terminal and multi-provider AI Co-Pilot built for **Fortuno Markets** (Match-Trader Trader API v1) with **Next.js 15 App Router**, **TypeScript 5.8**, **Zustand**, and **TradingView Lightweight Charts v5**.

---

## ✨ Key Capabilities

### 1. Complete Match-Trader Trader API v1 Integration (17 Endpoints)
- **Account & Portfolio**: Real-time Balance, Equity, Used Margin, Free Margin, Margin Level %, and Floating P&L with margin-call and stop-out visual alerts.
- **Market Orders**: Instant `BUY` / `SELL` execution with lot step normalization, automatic pip-based TP/SL calculation, margin estimation, and `Idempotency-Key` protection against duplicate submissions.
- **Position Management**: Modify Take Profit / Stop Loss (`PATCH /v1/positions/{id}`), partial position close, full close, and one-click Close All.
- **Pending Orders**: Create, modify, and cancel `LIMIT` and `STOP` orders with directional activation price validation.
- **Market Data & Charting**: Live Bid/Ask quotes with spread in pips, interactive candlesticks across 9 timeframes (`M1`..`MN1`), volume histogram, technical overlays (`SMA 20`, `SMA 50`, `EMA 20`, `Bollinger Bands 20,2`, `RSI 14`), and active position price lines.
- **Historical Audit & Export**: Range-paginated closed positions and financial ledger statements with formula-injection-safe CSV export.

### 2. Multi-Provider AI Trading Co-Pilot (7 Provider Presets)
- **Supported Providers**: OpenAI (`GPT-4o`), Anthropic (`Claude`), Google (`Gemini`), Mistral AI, Groq, Ollama (`Local`), and any custom OpenAI-compatible endpoint.
- **Live Portfolio Context**: Every AI turn is grounded with real-time account equity, margin level, open positions, pending orders, and watched quotes.
- **Confirmed Tool Calling**: Natural language commands (e.g., *"Buka BUY EURUSD 0.05 lot"*) generate a structured confirmation card requiring explicit user approval before execution.
- **AI Signal Scanner & Strategy Automation**: Single-symbol technical analysis, multi-symbol watchlist scanner, and a 4-step natural language strategy automation engine guarded by hard risk limits (Max Open Positions, Max Daily Loss, Max Drawdown %, Active Hours).

### 3. Defense-in-Depth Security & Reliability Architecture
- **Non-Extractable Web Crypto Vault**: JWT tokens and AI API keys are encrypted client-side with **AES-256-GCM** using a non-extractable `CryptoKey` stored in IndexedDB and slot-bound via Additional Authenticated Data (AAD).
- **Hardened CORS Proxy**: `/api/proxy/[...path]` enforces a strict path allow-list, rejects path traversal (`..`), strips hop-by-hop headers, enforces payload size limits, and applies per-IP sliding-window rate limiting.
- **Per-Request CSP Nonce & Security Headers**: `src/middleware.ts` issues a cryptographic CSP nonce per request alongside `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Permissions-Policy`.
- **Race-Condition & Rate-Limit Resilience**: Sliding-window client rate limiter (`60 req/min` general, `20 req/min` candles), exponential backoff with jitter, in-flight request coalescing (`TtlCache`), and `Mutex`-serialized automation cycles.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** `>= 20.0.0`
- **npm** `>= 10.0.0`

### Installation & Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
- **Live Mode**: Paste your Fortuno Markets (Match-Trader) Bearer JWT token and click **Connect to Fortuno Markets**.
- **Instant Demo Sandbox Mode**: Click **Launch Demo Sandbox (Instant)** on the login page to explore all trading, charting, AI Co-Pilot, and automation features immediately with simulated market data.

---

## 🧪 Verification & Quality Gates

```bash
# Type-check with TypeScript (--noEmit)
npm run type-check

# Lint codebase with ESLint
npm run lint

# Run unit, component & integration tests (Vitest)
npm test

# Production build
npm run build
```

---

## 📁 Project Architecture

```text
src/
├── app/                  # Next.js 15 App Router pages & hardened API proxy route
├── components/
│   ├── account/          # AccountSummaryWidget, ConnectionStatus, PortfolioOverview
│   ├── ai/               # ChatInterface, MarketAnalysisPanel, MultiSignalGrid, AutomationBuilder/Monitor
│   ├── history/          # ClosedPositionsTable, LedgerTable, HistorySummaryCard, ExportButton
│   ├── layout/           # AppLayout, Sidebar, Header, BottomNav, TokenExpiryBanner
│   ├── market/           # CandleChart, WatchlistWidget, QuoteCard, SymbolBrowser, TradingHoursInfo
│   ├── trading/          # OrderForm, CreatePendingOrderForm, PositionTable, PendingOrderTable, Dialogs
│   └── ui/               # Accessible UI primitives (Button, Card, Dialog, Input, Select, Table, Toast)
├── config/               # Centralized market constants, AI presets, security CSP, env schemas
├── hooks/                # Polling, Account, Positions, Orders, Quotes, Candles, AI, Automation, Shortcuts
├── server/               # Server-side rate limiter & CORS proxy policy/handler
├── services/
│   ├── aiProviders/      # 7 AI provider adapters + DemoSandboxAIProvider + AIProviderRouter
│   ├── fortuno/          # Typed Match-Trader client (17 endpoints + pagination) & Demo Sandbox backend
│   ├── http/             # HttpClient, SlidingWindowRateLimiter, exponential backoff retry
│   └── storage/          # IndexedDB non-extractable CryptoKey store & AES-256-GCM SecureStorage
├── store/                # Zustand state stores (configStore, tradingStore, aiStore)
├── types/                # Strict Zod schemas & TypeScript contracts (api.ts, ai.ts)
└── utils/                # Pure math, technical indicators (SMA/EMA/RSI/BB), JWT, CSV sanitizer, Mutex/TtlCache
```

---

## 📄 License

Released under the [MIT License](./LICENSE).

