// Shared Supabase client + small helper API used by both the game and the admin.
// Loaded as a classic <script> (we expose `window.SHIFT_SB`).

(() => {
  "use strict";

  // Project credentials. The anon key is safe to ship in client code; RLS
  // protects the database. NEVER put the service_role key here.
  const SUPABASE_URL  = "https://vpemuntrgfqettjbqkbn.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwZW11bnRyZ2ZxZXR0amJxa2JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTE2MDIsImV4cCI6MjA5MjY4NzYwMn0.ier2Qt6SJ-SIPA6WlowIuJK_wmrZywF9lSc3oOuTX3U";

  if (!window.supabase || !window.supabase.createClient){
    throw new Error("supabase-js not loaded. Add the CDN <script> before lib/supabase.js.");
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  // ---- auth helpers ----
  async function signInWithEmail(email){
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href }
    });
    if (error) throw error;
  }
  async function signOut(){
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }
  async function currentEmail(){
    const { data } = await client.auth.getSession();
    return data?.session?.user?.email ?? null;
  }
  async function isAdmin(){
    const email = await currentEmail();
    if (!email) return false;
    const { data, error } = await client
      .from("admins")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }

  // ---- content read ----
  async function fetchContentTree(){
    const { data, error } = await client
      .from("sections")
      .select(`
        id, name, cover_url, order_index,
        categories (
          id, section_id, name, emoji, image_url, cover_url, order_index,
          questions (
            id, category_id, difficulty, order_index,
            prompt_text, prompt_media_type, prompt_media_url,
            answer_text, answer_media_type, answer_media_url
          )
        )
      `)
      .order("order_index", { ascending: true });
    if (error) throw error;
    return data;
  }

  // ---- content write (used by migrate.js + admin) ----
  async function insertSection(row){
    const { data, error } = await client.from("sections").insert(row).select().single();
    if (error) throw error;
    return data;
  }
  async function insertCategory(row){
    const { data, error } = await client.from("categories").insert(row).select().single();
    if (error) throw error;
    return data;
  }
  async function insertQuestion(row){
    const { data, error } = await client.from("questions").insert(row).select().single();
    if (error) throw error;
    return data;
  }

  // ---- generic CRUD (Phase 4) ----
  // Allowed tables — defensive enum so a typo can never reach the server.
  const TABLES = new Set(["sections", "categories", "questions"]);
  function assertTable(t){
    if (!TABLES.has(t)) throw new Error(`unknown table: ${t}`);
  }

  // listAll(table, { eq, order, select })
  // - eq:    { col: value } filters
  // - order: array of { col, ascending? } applied in order
  // - select: comma-separated columns or relation, default "*"
  async function listAll(table, opts = {}){
    assertTable(table);
    let q = client.from(table).select(opts.select || "*");
    if (opts.eq) for (const [col, val] of Object.entries(opts.eq)) q = q.eq(col, val);
    for (const o of (opts.order || [{ col: "order_index" }])){
      q = q.order(o.col, { ascending: o.ascending !== false });
    }
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  async function update(table, id, patch){
    assertTable(table);
    const { data, error } = await client.from(table).update(patch).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }

  async function remove(table, id){
    assertTable(table);
    const { error } = await client.from(table).delete().eq("id", id);
    if (error) throw error;
    return { id };
  }

  // For the Categories tab — a quick map { category_id: question_count } so the
  // table can show "6 سؤال" without a per-row query.
  async function categoryQuestionCounts(){
    const { data, error } = await client.from("questions").select("category_id");
    if (error) throw error;
    const counts = new Map();
    for (const r of data) counts.set(r.category_id, (counts.get(r.category_id) || 0) + 1);
    return counts;
  }

  window.SHIFT_SB = {
    client,
    auth: { signInWithEmail, signOut, currentEmail, isAdmin },
    db:   {
      fetchContentTree,
      insertSection, insertCategory, insertQuestion,
      listAll, update, remove,
      categoryQuestionCounts
    }
  };
})();
