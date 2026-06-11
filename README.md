# Pi Desktop

Pi Desktop is a desktop GUI for the Pi Agent Toolkit. It helps you start and continue Pi sessions, browse the active workspace, preview generated files, and configure model providers without living entirely in a terminal.

## Quick Start

1. Download the Windows build from GitHub Releases.
2. Launch Pi Desktop.
3. Choose a default file address for new sessions.
4. Configure an AI Provider and API key.
5. Optional: install Git if you want version-control workflows.

The packaged desktop app includes the Pi runtime libraries it needs. You do not need to install an external Pi CLI just to launch the app.

## Downloads

- End users: download the latest `.exe` or setup package from [GitHub Releases](https://github.com/SS000JQ/pi-desktop-app/releases).
- Source users: clone this repository and install dependencies with `npm install`.
- npm note: Pi Desktop is currently distributed as source plus GitHub release binaries, not as a published npm desktop package.

## First-Run Setup

Pi Desktop checks these items on first launch and in Settings:

- Pi Core: bundled runtime can load.
- AI Provider: at least one provider has auth and a model.
- Default file address: where new sessions are created by default.
- Git: optional, used for version-control workflows.
- Git repository: optional, detected for the current workspace.

Git is intentionally optional. If it is missing, normal chat, file generation, and preview flows can still work. On Windows, the suggested command is:

```powershell
winget install --id Git.Git -e --source winget
```

## Default File Address

The default file address is used when creating a new chat with "Use Pi Desktop default folder". Set it during first-run setup or later from Settings.

Avoid pointing it at this source checkout unless you really want Pi sessions to write into the app repository. For most users, a folder such as `C:/Users/you/Pi-Desktop-Session` is a safer default.

## Provider And API Keys

Pi Desktop supports configured providers from the Pi AI provider catalog, including OpenAI-compatible providers. You need at least one provider with an API key and a model before Pi can answer chat requests.

API keys are stored in the app's user data directory through the existing provider configuration system. Do not commit local config files or screenshots that include secrets.

## Privacy

Pi Desktop works with files in the workspace or session directory you choose. Model providers may receive prompts and file/context content that you send to Pi. Review your provider's data policy before using private or sensitive files.

Local app data is stored under Electron's user data directory for Pi Desktop, not inside this repository when using the packaged app.

## Development From Source

Source development requires Node.js 20+, npm, and Git.

```powershell
git clone https://github.com/SS000JQ/pi-desktop-app.git
cd pi-desktop-app
npm install
npm run dev
```

Useful checks:

```powershell
npm test
npm run typecheck
npm run build
```

Build a Windows release package:

```powershell
npm run dist:win
```

Release artifacts are written to `release/`.

## Troubleshooting

- If Pi Core fails to load, reinstall dependencies or download a fresh release build.
- If chat is disabled or fails immediately, configure an AI Provider and API key.
- If generated files do not appear where expected, check the active session workspace and the default file address in Settings.
- If Git is missing, install it only if you need Git workflows such as diff, commit, branch, or push.

## License

MIT
