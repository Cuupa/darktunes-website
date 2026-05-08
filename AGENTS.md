Developer & Agent Guidelines (AGENTS.md)
MANDATORY: All developers and AI agents working on this project MUST strictly adhere to the following guidelines. This ensures code quality, security, legal compliance (GDPR), perfect UI/UX, and maintainability.

Clean Code & Architecture (ISO/IEC 25010)
Single Responsibility Principle (SRP): No "God Objects". Files like App.tsx must not contain thousands of lines of code. Split functionality into small, focused, and reusable components.
Separation of Concerns: Keep UI components (React), state management (Hooks/Context), and business logic (API calls/Lib functions) separate.
Code Splitting & Lazy Loading: Use React.lazy() and Suspense for heavy components (e.g., 3D models, admin panels, complex galleries) to keep the initial JavaScript bundle small and performant.
Strict Typing: Avoid the use of any in TypeScript. All variables, function parameters, API responses, and test mocks MUST be strictly typed.
Dry Principle: Do not repeat code. Use reusable hooks and utility functions.

Test Driven Development (TDD): Define conditions through tests before implementing complex logic.
Avoid Anti-Patterns: Absolutely avoid anti-patterns like prop-drilling over more than two levels and massive monolithic files.
YAGNI (You Aren't Gonna Need It): Do not generate speculative code for hypothetical features. Keep the codebase lean.
KISS (Keep It Simple, Stupid): Prefer native HTML/JS solutions over the importation of heavy NPM packages.

Technology Stack & Styling
Core Infrastructure: Next.js (App Router), React, Supabase (PostgreSQL), Cloudflare R2, Vercel deployment, and Vite build system.
UI & Design: Exclusively use Tailwind CSS and ensure the CSS output is minified.
Motion & UX: Implement fluid page transitions and shared layout animations with Framer Motion, and utilize Lenis for smooth scrolling. Use Phosphor Icons for all vector graphics.

Unit Testing & Quality Assurance
Unit Testing: Write unit tests for all new utilities, API routes, and complex hooks using Vitest.
Test Isolation: Tests must not rely on external network requests. Mock all external APIs (including iTunes, Bandsintown, Odesli, Spotify, and Discogs).

Inversion of Control (IoC) & Component Contracts
Props Over State: UI components MUST receive all data and callbacks as props — they must not directly access global state, context, or external stores.
No Direct Context Reads: Components that render UI (sections, cards, widgets) must receive their data via props. Context access is only permitted in top-level wiring components (e.g., App.tsx, AdminPanel.tsx, use-app-state.ts).
Section Contracts: All page sections must extend SectionProps (or EditableSectionProps<T>) from src/lib/component-contracts.ts. The editMode, sectionLabels, and onLabelChange props are mandatory.
Admin Panel Contracts: All admin sub-forms must extend AdminPanelProps<T> from src/lib/component-contracts.ts. No sub-form should import or read AdminSettings directly from storage/context.
Dialog Contracts: All modals must extend DialogProps (with open / onClose). No dialog should manage its own visibility state internally.

Agent Workflow Requirements
These rules apply specifically to AI agent runs on this project:
Update AGENTS.md: AGENTS.md is the living specification of this project and serves as a dedicated, predictable place for context. If new conventions, patterns, or architectural decisions were introduced, add or update the relevant section in this file after every run.
Update Documentation: If new public APIs, components, or utilities were added, update the relevant docs in the docs/ directory or inline JSDoc comments.
Minimal Changes Principle: Make the smallest possible change that fully addresses the requirement. Do not refactor unrelated code in the same PR. Do not add new dependencies unless absolutely necessary — check npm audit for any new package.
