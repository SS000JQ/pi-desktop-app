# Pi Desktop

**A Windows desktop app for using the Pi Agent Toolkit without living in a terminal.**

Pi Desktop gives Pi a familiar desktop interface: start agent sessions, choose a workspace, configure model providers, preview generated files, and inspect what the agent is doing from one place. It is built for people who want the power of an AI coding and file-working agent, but do not want to memorize command-line workflows before they can get value from it.

[Download the latest release](https://github.com/SS000JQ/pi-desktop-app/releases/latest)

## Why Use Pi Desktop?

Pi is powerful, but terminal-first tools can feel intimidating for new users. Pi Desktop keeps the useful parts of an agent workflow visible and approachable:

- Start and continue Pi sessions from a desktop window.
- Pick a default workspace folder instead of typing paths repeatedly.
- Preview generated documents, PDFs, spreadsheets, slides, images, and text files.
- Configure AI providers and API keys through the app instead of editing config by hand.
- Keep Git workflows optional: use normal chat and file generation without installing Git first.
- Export diagnostics when something goes wrong, so issues are easier to understand and report.
- Use an open-source app that can be inspected, built, and improved by the community.

If you are comfortable with terminals, Pi Desktop can still save time by making session state, files, previews, and settings easier to scan. If you are not comfortable with terminals, it gives you a much gentler starting point.

## Install Options

Pi Desktop is currently distributed as Windows release binaries and source code. Choose the path that matches how you like to install software.

### Windows Installer

Recommended for most users:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/SS000JQ/pi-desktop-app/codex/preview-session-robustness/scripts/install.ps1)))
```

This downloads the latest setup installer to your Downloads folder. You can also download it directly:

[Download Pi-Desktop-Setup-0.2.1.exe](https://github.com/SS000JQ/pi-desktop-app/releases/download/v0.2.1/Pi-Desktop-Setup-0.2.1.exe)

### Portable Build

Use this if you want to run Pi Desktop without a system-wide install:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/SS000JQ/pi-desktop-app/codex/preview-session-robustness/scripts/install.ps1))) -Channel portable
```

Direct download:

[Download Pi-Desktop-Portable-0.2.1.exe](https://github.com/SS000JQ/pi-desktop-app/releases/download/v0.2.1/Pi-Desktop-Portable-0.2.1.exe)

### Download A Specific Version

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/SS000JQ/pi-desktop-app/codex/preview-session-robustness/scripts/install.ps1))) -Version v0.2.1
```

### From Source

For developers who want to run or modify the app locally:

```powershell
git clone https://github.com/SS000JQ/pi-desktop-app.git
cd pi-desktop-app
npm install
npm run dev
```

### Package Managers

Pi Desktop is not yet published through winget, Scoop, Chocolatey, npm, pnpm, or Bun. GitHub Releases are the official distribution channel for now. Package-manager manifests can be added later once the Windows release flow is stable.

All release files are available on [GitHub Releases](https://github.com/SS000JQ/pi-desktop-app/releases).

Use the setup installer if you want a normal Windows installation. Use the portable build if you prefer to run the app without installing it system-wide.

The packaged desktop app includes the Pi runtime libraries it needs. You do not need to install an external Pi CLI just to launch the app.

## What It Can Do

### Agent Sessions

- Create new Pi sessions from the desktop.
- Continue existing sessions.
- Choose whether a session uses the app's default folder or another workspace.
- See runtime status while the agent is working.

### Workspace And File Preview

- Browse files produced or edited during a session.
- Preview common generated outputs without leaving the app.
- PDF preview support is packaged with the desktop build, including PDF.js worker assets, fonts, CMaps, and WASM resources.
- Office-style preview support covers common Word, PowerPoint, and spreadsheet flows used by Pi-generated artifacts.

### Provider Setup

- Configure providers from the Pi AI provider catalog.
- Use OpenAI-compatible providers where supported by the Pi provider system.
- Store provider settings in the app's user data directory instead of this source repository.

### Safer Desktop Behavior

- External links are opened through a guarded desktop IPC path.
- File access is scoped to expected workspace/session locations.
- Large workspaces and oversized files have guardrails so the UI does not try to load everything blindly.
- Diagnostics export is available from Settings for easier debugging.

### Optional Git Workflows

Git is useful for diff, branch, commit, and push workflows, but it is not required for basic chat, file generation, or preview usage. Pi Desktop checks whether Git is available and explains what is missing instead of silently failing.

## First-Run Setup

1. Download and run the latest Windows build.
2. Choose a default file address for new sessions.
3. Configure at least one AI provider, API key, and model.
4. Optional: install Git if you want version-control workflows.
5. Start a session and choose the workspace where Pi should work.

On Windows, Git can be installed with:

```powershell
winget install --id Git.Git -e --source winget
```

## Choosing A Workspace

The default file address is used when creating a new chat with the app's default folder. For most users, a folder such as this is a good starting point:

```text
C:/Users/you/Pi-Desktop-Sessions
```

Avoid pointing it at the Pi Desktop source checkout unless you intentionally want agent sessions to write into the app repository.

## Privacy And Data

Pi Desktop works with files in the workspace or session directory you choose. Model providers may receive prompts, chat context, file excerpts, or generated content that you send to Pi. Review your provider's data policy before using private or sensitive files.

Local app data is stored under Electron's user data directory for Pi Desktop when using the packaged app. API keys and provider settings should never be committed to the repository or shared in screenshots.

## Troubleshooting

### The App Opens, But Chat Is Disabled

Configure an AI provider, API key, and model in Settings. Pi needs at least one usable provider before it can answer.

### PDF Preview Does Not Work

Use the latest release build. Version `0.2.1` packages the PDF.js worker, fonts, CMaps, and WASM resources so PDF preview works in the installed desktop app, not only in source development.

### Links Do Not Open

Use the latest release build. Version `0.2.1` routes external links through the desktop shell with safer URL handling.

### Generated Files Are Not Where You Expected

Check the active session workspace and the default file address in Settings. Pi writes files relative to the workspace selected for the session.

### Git Is Missing

Install Git only if you need Git-specific workflows. Normal chat, file generation, and file preview can still work without it.

### Something Still Looks Wrong

Open Settings and export diagnostics. The diagnostic report is designed to make environment, provider, runtime, and packaging issues easier to report.

## For Developers

Source development requires Node.js 20+, npm, and Git.

```powershell
git clone https://github.com/SS000JQ/pi-desktop-app.git
cd pi-desktop-app
npm install
npm run dev
```

Useful checks:

```powershell
npm run verify:release
npm run typecheck
npm test
npm run build
```

Build a Windows release package:

```powershell
npm run dist:win
```

Release artifacts are written to `release/`.

## Release Quality

The `0.2.1` release was built after validating:

- Release asset packaging with `npm run verify:release`.
- TypeScript checks with `npm run typecheck`.
- Automated tests with `npm test`.
- Windows installer and portable builds with `npm run dist:win`.

The release includes hardening for packaged PDF preview, external link handling, diagnostics export, file IPC boundaries, and large workspace/file guardrails.

## Project Status

Pi Desktop is early-stage desktop software. The current release is focused on Windows users and on making Pi easier to use outside the terminal. Feedback, bug reports, and focused pull requests are welcome.

## License

MIT
