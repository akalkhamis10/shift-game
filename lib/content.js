// Boot-time content loader. Reshapes Supabase tree → legacy CATEGORIES shape
// and exposes a single promise: `window.SHIFT_CONTENT_READY`.

(() => {
  "use strict";

  // Re-export the Phase-1 fallback shape (LIFELINES + DIFFICULTIES) which lives
  // in data.js. data.js sets window.__SHIFT_FALLBACK = { LIFELINES, DIFFICULTIES, CATEGORIES }
  // (see Task 4 — we wrap the existing assignment).
  function fallback() {
    return window.__SHIFT_FALLBACK || null;
  }

  function reshape(tree) {
    const cats = [];
    for (const section of tree) {
      for (const c of section.categories || []) {
        cats.push({
          id: c.id,
          group: section.name,
          name: c.name,
          emoji: c.emoji || "",
          questions: (c.questions || [])
            .slice()
            .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
            .map(q => ({
              d: q.difficulty,
              q: q.prompt_text,
              a: q.answer_text
            }))
        });
      }
    }
    return cats;
  }

  async function boot() {
    const fb = fallback();
    if (!fb) {
      throw new Error("data.js fallback not loaded — load data.js before lib/content.js");
    }

    try {
      const tree = await window.SHIFT_SB.db.fetchContentTree();
      const cats = reshape(tree);
      if (!cats.length) throw new Error("Supabase returned 0 categories");

      window.SHIFT_DATA = {
        LIFELINES:    fb.LIFELINES,
        DIFFICULTIES: fb.DIFFICULTIES,
        CATEGORIES:   cats
      };
      console.info("[shift] loaded", cats.length, "categories from Supabase");
      return { source: "supabase", count: cats.length };

    } catch (err) {
      console.warn("[shift] Supabase content load failed — falling back to data.js bundle:", err);
      window.SHIFT_DATA = {
        LIFELINES:    fb.LIFELINES,
        DIFFICULTIES: fb.DIFFICULTIES,
        CATEGORIES:   fb.CATEGORIES
      };
      return { source: "fallback", error: err.message, count: fb.CATEGORIES.length };
    }
  }

  // Expose a single promise the bootstrap script awaits.
  window.SHIFT_CONTENT_READY = boot();
})();
