// Phase 3: admin shell auth state machine.
// Reads window.SHIFT_SB (defined by lib/supabase.js).

(() => {
  "use strict";
  if (!window.SHIFT_SB) {
    document.body.setAttribute("data-state", "signed-out");
    document.getElementById("admSigninStatus").textContent =
      "خطأ: لم يتم تحميل عميل قاعدة البيانات.";
    return;
  }

  const { auth, client } = window.SHIFT_SB;
  const $ = (id) => document.getElementById(id);

  function setState(state) {
    document.body.setAttribute("data-state", state);
  }
  function setStatus(msg, kind = "") {
    const el = $("admSigninStatus");
    el.textContent = msg || "";
    el.classList.remove("is-ok", "is-bad");
    if (kind) el.classList.add(kind);
  }

  // Serialize evaluations: the INITIAL_SESSION onAuthStateChange event and our
  // boot call would otherwise both call getSession() at the same time and race
  // for Supabase's auth-token Web Lock — one would steal the lock from the
  // other and the awaiting promise rejects, leaving the page stuck on
  // "pending". Chaining ensures only one evaluation runs at a time.
  let evalChain = Promise.resolve();
  function evaluate() {
    evalChain = evalChain.then(doEvaluate).catch((err) => {
      console.error("[admin] state evaluation failed:", err);
      setStatus("تعذّر التحقق من الجلسة. حاول التحديث.", "is-bad");
      setState("signed-out");
    });
    return evalChain;
  }
  async function doEvaluate() {
    const email = await auth.currentEmail();
    if (!email) { setState("signed-out"); return; }

    // We have a session. Show the topbar email immediately.
    $("admEmail").textContent = email;

    const ok = await auth.isAdmin();
    setState(ok ? "authorized" : "not-authorized");
  }

  // Sign-in form
  $("admSigninForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("admEmailInput").value.trim();
    if (!email) { setStatus("أدخل بريدك الإلكتروني.", "is-bad"); return; }

    const btn = $("admSendLink");
    btn.disabled = true;
    setStatus("جاري الإرسال…");
    try {
      await auth.signInWithEmail(email);
      setStatus(`تم إرسال الرابط إلى ${email} — تحقق من بريدك ثم اضغط على الرابط.`, "is-ok");
    } catch (err) {
      setStatus(`خطأ: ${err.message || err}`, "is-bad");
    } finally {
      btn.disabled = false;
    }
  });

  // Sign-out button (visible only in non-pending+non-signed-out states)
  $("admSignOut").addEventListener("click", async () => {
    try {
      await auth.signOut();
      setStatus("");
      setState("signed-out");
    } catch (err) {
      console.error("[admin] sign-out failed:", err);
    }
  });

  // Listen to all auth state changes (including the magic-link redirect).
  client.auth.onAuthStateChange(() => evaluate());

  // Initial check
  evaluate();
})();
