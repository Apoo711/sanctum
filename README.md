# Sanctum 🏛️

Welcome to **Sanctum**, a digital workspace, laboratory catalog, and horological showcase. Built with a **Horological Dark Academia** aesthetic, this project blends the weight of classic vellum manuscripts and brass clockwork with clean, high-performance web engineering.

This application was originally built as a static site and has since been overhauled into a fast **Node.js & Express** app featuring a custom **Tactile Bento** dashboard layout.

---

## 🏛️ Inside the Study

### 🕰️ The Orrery
A live, canvas-drawn mechanical clockwork. Operating through a 3D-perspective physics engine, it translates the current hour, minute, and second into rotating celestial orbits. You can click and drag on the canvas to inspect it from different angles.

### ⏳ VCE Ephemeris
A dedicated countdown tracking the exact time remaining until the VCE examination epoch. It utilizes custom glowing typography and runs in permanent view on the dashboard to help organize study routines.

### ♟️ Tactics Tile
A live ELO score widget connected directly to Chess.com. It automatically fetches current statistics and displays thematic, hand-drawn vector icons representing Bullet, Blitz, or Rapid ratings depending on which ELO mode is active.

### 📂 The Scholar's Desk (The Prospectus)
An interactive drawer overlay simulating a physical desktop desk. By selecting a volume, you can open and read through high-fidelity 3D flippable booklets:
- **V.I.S.O.R Technical Dossier**: Schematics for stereoscopic industrial hazard HUD systems.
- **Expedition Logs**: Field logs detailing humanitarian deployments in Vietnam and Cambodia.
- *Controls*: Supports smooth page-flipping using visual arrow buttons or keyboard arrows. Pressing the `Escape` key closes the desk instantly, and booklets automatically turn back to their cover state when folded closed.

### 🧪 The Scriptorium (Subject Catalogs)
A study vault hosting dedicated folders for six academic subjects: **Physics, Systems Engineering, Specialist Maths, Mathematical Methods, Chemistry, and English**.
- **Interactive Decanting**: Selecting a resource prompts a terminal-style vault connection console simulating checksum validations and decryption.
- **Redirection Architecture**: Once vault retrieval is complete, requests are securely routed via a backend endpoint (`/resources/download/:subject/:title`) which redirects to the actual resources hosted on the [Apoo711/vce-resources](https://github.com/Apoo711/vce-resources) releases page for direct browser downloads.

---

## 🎨 The Aesthetic System: Tactile Bento

The design system focuses on material honesty, texture, and physical weight:
- **Palette**: Deep walnut and obsidian background gradients (`#020202`), warm golden brass accents (`#B5935B`), and soft paper-like vellum containers (`#F4F1EA`).
- **Typography**: Scholarly headers set in *EB Garamond* and *Playfair Display*, paired with monospaced code blocks set in *JetBrains Mono*.
- **Depth**: Translucent glassmorphic tiles using backdrop filters, overlay drop shadows, and page transitions.

---

## 🛠️ Local Setup & Execution

If you'd like to run the Sanctum locally on your machine, follow these steps:

### 1. Installation
Clone this repository to your local drive, open your terminal in the project directory, and install the dependencies:
```bash
npm install
```

### 2. Run the Server
To run the server in **development mode** (which watches for file changes and reloads the process automatically), use:
```bash
npm run dev
```
Alternatively, to start the server normally in **production mode**:
```bash
npm start
```
The application will launch on `http://localhost:3000`.

### 3. YouTube Music Proxy (Optional)
The Scriptorium music widget attempts to proxy recently played tracks from a local python backend running on port `5000`. If you wish to configure this, adjust the `oauth.json` credentials as required by the backend service.

---

## 📄 License

Distributed under the Apache 2.0 License. See `LICENSE` for more information.

<p align="center">
  <i>Maintained and developed with precision by <a href="https://github.com/apoo711">Aryan Gupta</a></i>
</p>
