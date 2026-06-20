# Sanctum 🏛️

Welcome to **Sanctum**, a digital workspace, library catalog, and horological showcase. Built with a **Horological Dark Academia** aesthetic, this project blends the depth of classic vellum manuscripts and brass clockwork with clean, high-performance web engineering.

This application is built as an EJS-powered **Node.js & Express** app featuring a custom **Tactile Bento** dashboard layout. It also compiles to a fully static website for hosting.

---

## 🏛️ Inside the Study

### 🕰️ The Orrery
A live, canvas-rendered mechanical clockwork. Operating on a 3D-perspective physics engine, it translates the current hour, minute, and second into rotating celestial orbits. You can click and drag on the canvas to inspect the mechanism from different angles.

### ⏳ VCE Ephemeris
A countdown tracking the exact time remaining until the VCE examination epoch. It utilizes custom glowing typography and runs in permanent view on the dashboard to help structure study sessions.

### ♟️ Tactics Tile
A live ELO score widget connected directly to Chess.com. It fetches real-time statistics and displays hand-drawn vector icons representing Bullet, Blitz, or Rapid ratings depending on which mode is toggled.

### 📖 The Daily Ledger
A daily contemplation block integrated into the dashboard. It cycles through architectural, philosophical, and stoic maxims at the start of each day to offer quiet, grounding thoughts.

### 🔊 The Phonograph
A music widget tracking the host's recently played YouTube Music tracks. It proxies connection states and metadata to a local Rust backend service on port `8000` to show what is currently spinning.

### 📂 The Scholar's Desk (The Prospectus)
An interactive drawer overlay simulating a physical wooden desk. Selecting a volume opens high-fidelity, 3D-flippable booklets:
- **V.I.S.O.R Technical Dossier**: Technical schematics for stereoscopic industrial hazard HUD systems.
- **Expedition Logs**: Personal field journals detailing humanitarian deployments in Vietnam and Cambodia.
- *Controls*: Supports smooth page-flipping using click targets or keyboard arrows. Pressing the `Escape` key closes the desk instantly, and booklets automatically fold back to their cover state.

### 🧪 The Scriptorium (Subject Catalogs)
A resource vault hosting folders for academic subjects, including **Physics, Systems Engineering, Specialist Maths, Mathematical Methods, Chemistry, and English**.
- **Interactive Decanting**: Selecting a resource prompts a terminal-style vault connection sequence with checksum validation and simulated decryption.
- **Redirection Architecture**: Requests are routed through the backend endpoint (`/resources/download/:subject/:title`) which redirects to the actual files hosted on the [Apoo711/vce-resources](https://github.com/Apoo711/vce-resources) releases page for direct browser downloads.

### ⏱️ The Sandglass (Focus Chronometer)
A dedicated focus timer (/pomodoro) styled as a vintage mechanical sandglass. Supports custom work and rest configurations with ambient audio cues to accompany intense study sessions.

### 📜 The Codex (Poems Codex)
A locked poetry vault (/poems) containing compiled verses and personal manuscripts. Accessing the Codex requires entering a passkey cipher. This page securely queries a local Rust API backend, which tracks login state and implements IP-based lockout tracking to prevent brute-forcing.

### ✍️ The Chronicles
A dynamically compiled web log (/blog) built to store dispatches, expedition archives, and design logs. It reads Markdown files from disk, parsing frontmatter meta with `gray-matter` and rendering text and KaTeX equations through `marked`.

---

## 🎨 Aesthetic Design: Tactile Bento

The design system focuses on physical weight, texture, and materiality:
- **Palette**: Deep walnut and obsidian background gradients (`#020202`), warm golden brass accents (`#B5935B`), and soft, paper-textured vellum containers (`#F4F1EA`).
- **Typography**: Scholarly headers set in *EB Garamond* and *Playfair Display*, paired with monospaced code blocks set in *JetBrains Mono*.
- **Depth**: Translucent glassmorphic tiles using backdrop filters, overlay drop shadows, and subtle page transitions.

---

## 🛠️ Setup & Execution

### 1. Installation
Clone this repository to your local drive, navigate to the project directory, and install the frontend dependencies:
```bash
npm install
```

### 2. Run the Web Server
To run the server in **development mode** (which watches for file changes and reloads automatically), use:
```bash
npm run dev
```
Alternatively, to start the server in **production mode**:
```bash
npm start
```
The application will launch on `http://localhost:3000`.

### 3. Static Site Compilation
To compile the site, blogs, and resources into static HTML files inside the `/dist` directory (along with generating a sitemap), run:
```bash
npm run build
```

### 4. Configure the Rust Backend (Optional)
The Phonograph music widget and Poems Codex query a local Rust backend running on port `8000`.

1. Make sure you have the Rust toolchain installed.
2. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
3. Copy or rename the `.env` configuration file and edit the password details:
   - Keep or adjust the `POEM_PASSWORD` variable.
4. For YouTube Music integration, generate a `browser.json` file containing your authentication credentials using the `ytmapi-rs` structure, and place it in the project root.
5. Launch the backend:
   ```bash
   cargo run --release
   ```
   The backend server will bind to `127.0.0.1:8000`.

---

## 📄 License

Distributed under the Apache 2.0 License. See `LICENSE` for more information.

<p align="center">
  <i>Maintained and developed with precision by <a href="https://github.com/apoo711">Aryan Gupta</a></i>
</p>

