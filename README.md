**CAMPUS CIRCLE — Lightweight Frontend**

A small static social-feed UI built with plain HTML, CSS and JavaScript. Intended as a simple demo/assignment project you can host as a static site.

**Features:**
- **Minimal:** Static frontend only, no backend included.
- **Feed UI:** Compose box, feed tabs, suggestions and notifications UI.
- **Chat & Modals:** Basic chat and modal UI components for interactions.

**Files:**
- [app.js](app.js) : Main JavaScript that powers the UI.
- [style.css](style.css) : All styles and layout.
- [index.html](index.html) : Landing / entry page.
- [home.html](home.html) : Main feed UI.
- [explore.html](explore.html) : Explore/campus feed.
- [profile.html](profile.html) : User profile page.
- [users.html](users.html) : Users / directory page.

**Run locally**
- Open `index.html` or `home.html` in a browser.
- Or serve the folder with a simple HTTP server (recommended):

```
# Python 3
python -m http.server 8000
# then open http://localhost:8000 in your browser
```

**How to use**
- Place any required assets (e.g. logo images) in the project root.
- The compose box and UI are client-side only and do not persist between reloads.

**Tips before publishing**
- Add the project logo file `nexus-logo.png` to the repository root so the sidebar logo shows.
- Add a short license (MIT recommended) and a descriptive project README on GitHub.
- Optionally enable GitHub Pages from the repository settings to host the static site.

**Contributing**
- This is a simple demo. Feel free to open issues or PRs to improve accessibility, responsiveness, or add persistence.

**License**
- Add a license file (e.g. `LICENSE`) if you plan to publish this publicly.

---

If you want, I can also:
- add an MIT `LICENSE` file,
- add a GitHub Pages-ready `404.html` and `CNAME`, or
- commit and push a new repo scaffold for you.
