// Shared Supabase client + small helper API used by both the game and the admin.
// Loaded as a classic <script> (we expose `window.SHIFT_SB`).

(() => {
  "use strict";

  // Project credentials. The anon key is safe to ship in client code; RLS
  // protects the database. NEVER put the service_role key here.
  const SUPABASE_URL  = "https://vpemuntrgfqettjbqkbn.supabase.co";
  const SUPABASE_ANON_KEY = "REPLACE_WITH_ANON_KEY";

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

  // ---- content write (used by migrate.js + future admin) ----
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

  window.SHIFT_SB = {
    client,
    auth: { signInWithEmail, signOut, currentEmail, isAdmin },
    db: { fetchContentTree, insertSection, insertCategory, insertQuestion }
  };
})();
