---
title: "First Expedition: Notes from the Digital Frontier"
date: "2026-03-18"
description: "An inaugural entry — cataloguing the architecture of this Sanctum, the philosophies that shaped its design, and the instruments now running within its walls."
tags: ["sanctum", "architecture", "meta", "dark-academia"]
---

The Sanctum is live.

What you are reading now is the first entry in a system I have been meaning to build for some time — a *living manuscript* rather than a static page. Each post here is a raw `.md` file, parsed by `gray-matter` and rendered by `marked`, woven into the dark oak panels of this site's design.

## Why a Manuscript?

Most personal sites fall into one of two failure modes: the **over-engineered portfolio** that screams *look at my stack* louder than it communicates thought, or the **neglected blog** that was last updated in 2019. I wanted neither.

Instead: a **Scholar's Desk**. An environment that rewards slow reading. Something that feels like it was *found*, not generated.

> "The purpose of a writer is to keep civilisation from destroying itself."
> — Bernard Malamud

## What Runs Beneath

The engine beneath this page is deliberately minimal:

- **Express.js** as the server — no framework overhead
- **EJS** for templating — composable, legible
- **`gray-matter`** for YAML frontmatter extraction
- **`marked`** for Markdown → HTML conversion
- **KaTeX** for equations, because $e^{i\pi} + 1 = 0$ deserves proper rendering

There is no database. There is no CMS dashboard. Posts are files, committed to git, versioned like code. This is the way.

## The Design Vocabulary

The visual language of the Sanctum is built on four tokens:

| Token      | Hex       | Role                          |
|------------|-----------|-------------------------------|
| Obsidian   | `#020202` | Background, the void          |
| Walnut     | `#1A110A` | Surface warmth                |
| Brass/Gold | `#B5935B` | Accent, borders, hover states |
| Vellum     | `#F4F1EA` | Primary reading text          |

Typography is a deliberate pair: **EB Garamond** for titles and body (a classical serif with authentic ink-trap character), and **JetBrains Mono** for code fragments and technical labels.

## Inline Code & Blocks

Referencing `server.js` inline feels natural in this environment. Extended code:

```javascript
// The Manuscript Engine — route handler
app.get('/chronicles/:slug', async (req, res) => {
    const filePath = path.join(__dirname, 'content/logs', `${req.params.slug}.md`);
    const raw = await fs.readFile(filePath, 'utf8');
    const { data, content } = matter(raw);
    const html = marked.parse(content);
    res.render('post', { meta: data, content: html });
});
```

Clean. Comprehensible. No magic.

## What Comes Next

Future entries will cover:

1. The **Orrery** — a real-time celestial clock encoded in vanilla JS
2. The **VCE Ephemeris** — a precision countdown to the Victorian Certificate of Education
3. The **Chess Complication** — a Fischer Random generator styled as a pocket-watch complication
4. Deep dives into **mathematical structures** rendered with KaTeX

Until then, the Sanctum is open. The candle is lit.

— *A.G.*
