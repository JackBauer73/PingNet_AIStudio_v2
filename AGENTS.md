# Persistent Guidelines for TournoisTT Development

Whenever editing this codebase, please adhere to these project-specific engineering rules:

## 1. Respect Semantic Versioning & Record History
- The current project baseline version is **`0.5.0`**.
- Any future changes or feature additions **MUST** include an incremental update to the version following the **SemVer** convention:
  - Increment **PATCH** (e.g., `0.5.0` ➔ `0.5.1`) for bug fixes, cosmetic enhancements, menu label updates, or tiny UI tweaks.
  - Increment **MINOR** (e.g., `0.5.0` ➔ `0.6.0`) for backwards-compatible new features (e.g., new analytics, new settings options, custom filters).
  - Increment **MAJOR** (e.g., `0.5.0` ➔ `1.0.0`) for breaking changes or structural overhauls.
- When incrementing the version:
  1. Update `"version"` in `/package.json`.
  2. Document the update and date in `/VERSION.md` under the "Historique des versions" section.
  3. Update the static version displays in:
     - `/src/components/layout/Sidebar.tsx` (sidebar footer badge)
     - `/src/pages/player/Landing.tsx` (page footer version tag)

## 2. Structural Principles
- **Tournament Single Focus**: Do not restore multi-tournament selector menus. The application is tailored specifically to organize and run a single high-quality tournament at a time.
- **Header & Branding**: Keep the direct landing page route on the logo (`/` link on the `TT` brand logo) active for all layouts.
