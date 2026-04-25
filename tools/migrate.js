// One-off migration: copies window.SHIFT_DATA.CATEGORIES into Supabase.
// Idempotent: re-running skips rows that already exist (matched by name).

(() => {
  "use strict";
  const { auth, db, client } = window.SHIFT_SB;
  const log = (msg, cls="") => {
    const el = document.getElementById("log");
    el.innerHTML += `<span class="${cls}">${msg}</span>\n`;
    el.scrollTop = el.scrollHeight;
  };
  const setStatus = (msg, cls="") => {
    document.getElementById("status").innerHTML = `<span class="${cls}">${msg}</span>`;
  };

  const $ = (id) => document.getElementById(id);

  async function refreshAuthUI(){
    const email = await auth.currentEmail();
    if (!email){
      setStatus("Not signed in.");
      $("migrate").disabled = true;
      $("signout").disabled = true;
      return;
    }
    const isAdm = await auth.isAdmin();
    if (isAdm){
      setStatus(`Signed in as ${email} ✓ admin`, "ok");
      $("migrate").disabled = false;
    } else {
      setStatus(`Signed in as ${email} — NOT in admins table`, "bad");
      $("migrate").disabled = true;
    }
    $("signout").disabled = false;
  }

  $("signin").addEventListener("click", async () => {
    const email = $("email").value.trim();
    if (!email){ setStatus("Enter an email first", "bad"); return; }
    try{
      await auth.signInWithEmail(email);
      setStatus(`Magic link sent to ${email} — check your inbox, then come back to this page.`, "ok");
    } catch (e){
      setStatus(`Sign-in error: ${e.message}`, "bad");
    }
  });

  $("signout").addEventListener("click", async () => {
    await auth.signOut();
    refreshAuthUI();
  });

  client.auth.onAuthStateChange(() => refreshAuthUI());
  refreshAuthUI();

  // ---- migration logic ----
  $("migrate").addEventListener("click", async () => {
    $("migrate").disabled = true;
    try{
      const cats = window.SHIFT_DATA?.CATEGORIES;
      if (!Array.isArray(cats)) throw new Error("window.SHIFT_DATA.CATEGORIES not found");

      // Group categories by their `group` field → distinct sections.
      const groupNames = [...new Set(cats.map(c => c.group))];
      log(`found ${groupNames.length} sections, ${cats.length} categories`);

      // 1) Sections
      const { data: existingSections } = await client.from("sections").select("id,name");
      const sectionByName = new Map(existingSections.map(s => [s.name, s]));
      for (let i = 0; i < groupNames.length; i++){
        const name = groupNames[i];
        if (sectionByName.has(name)){
          log(`  · section "${name}" already exists — skipping`);
          continue;
        }
        const row = await db.insertSection({ name, order_index: i });
        sectionByName.set(name, row);
        log(`  + section "${name}" created`, "ok");
      }

      // 2) Categories
      const { data: existingCats } = await client.from("categories").select("id,name,section_id");
      const catKey = (sectionId, name) => `${sectionId}|${name}`;
      const catByKey = new Map(existingCats.map(c => [catKey(c.section_id, c.name), c]));
      for (let i = 0; i < cats.length; i++){
        const c = cats[i];
        const section = sectionByName.get(c.group);
        if (!section) throw new Error(`no section for group ${c.group}`);
        const key = catKey(section.id, c.name);
        if (catByKey.has(key)){
          log(`  · category "${c.name}" already exists — skipping`);
          continue;
        }
        const row = await db.insertCategory({
          section_id: section.id,
          name: c.name,
          emoji: c.emoji,
          order_index: i
        });
        catByKey.set(key, row);
        log(`  + category "${c.name}" created`, "ok");
      }

      // 3) Questions
      // For idempotency, match questions by (category_id, prompt_text).
      let qInserted = 0, qSkipped = 0;
      for (const c of cats){
        const section = sectionByName.get(c.group);
        const cat = catByKey.get(catKey(section.id, c.name));
        const { data: existingQs } = await client
          .from("questions")
          .select("id,prompt_text")
          .eq("category_id", cat.id);
        const promptSet = new Set(existingQs.map(q => q.prompt_text));
        let order = 0;
        for (const q of c.questions){
          if (promptSet.has(q.q)){ qSkipped++; order++; continue; }
          await db.insertQuestion({
            category_id: cat.id,
            difficulty: q.d,
            prompt_text: q.q,
            answer_text: q.a,
            order_index: order
          });
          qInserted++; order++;
        }
      }
      log(`questions: +${qInserted} inserted, ${qSkipped} skipped`, "ok");
      log("DONE.", "ok");
    } catch (e){
      log(`ERROR: ${e.message}`, "bad");
      console.error(e);
    } finally {
      $("migrate").disabled = false;
    }
  });
})();
