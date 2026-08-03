# WebPen — Pentest Pocket Reference

A static, in-depth **web application penetration testing & red teaming pocketbook** — methodology, OSINT techniques, tool cheatsheets, payloads, and curated open-source tools — all in one offline-friendly site.

Nothing here runs scans or contacts a target. Every command and payload is plain reference text meant to be copied into your own tooling.

## What’s inside

| Section | Contents |
| --- | --- |
| **Methodology** | 7-phase engagement flow (scope → reporting), with an OWASP Top 10–mapped vuln phase |
| **OSINT** | Passive intel techniques with copy-ready commands and “why this matters” notes |
| **Cheatsheet** | Tool commands (Nmap, Nuclei, sqlmap, ffuf, jwt_tool, …) grouped and searchable |
| **Payloads** | Probe strings by vulnerability class (XSS, SQLi, SSRF, SSTI, XXE, …) |
| **GitHub Tools** | Curated upstream repos for recon, scanning, exploitation, APIs, wordlists, and more |

## Quick start

Serve the folder with any static file server:

```bash
# Python
python -m http.server 5500

# Node (if you prefer)
npx --yes serve -l 5500
```

Then open [http://localhost:5500](http://localhost:5500).

No build step. No dependencies. Open `index.html` via a local server (preferred over `file://` so clipboard and routing behave normally).

## Project layout

```
index.html      # App shell
css/styles.css  # Dark console theme
js/data.js      # All reference content
js/app.js       # Rendering, search, copy, modal
```

## Authorized use only

This guide assumes **explicit written permission** to test systems in scope. Commands and payloads are for authorized security testing and education. Unauthorized testing is illegal in most jurisdictions.

## License

MIT — see [LICENSE](LICENSE).
