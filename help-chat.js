/* Help chat widget — My Computer tools
   Add this ONE line just before </body> on every page:
     <script src="help-chat.js"></script>
   Optional attributes on that tag:
     data-endpoint="https://…"   use another worker address for this page
     data-lang="nl" | "en"       force the language (otherwise the page's <html lang> is used)
*/

// >>> Your Cloudflare worker address — the ONLY place you need to change it <<<
const HELP_CHAT_ENDPOINT = "https://abimael-help.perezabimael01.workers.dev";

(function(){
  const script = document.currentScript;
  const ENDPOINT = (script && script.dataset.endpoint) || HELP_CHAT_ENDPOINT;
  const isNL = ((script && script.dataset.lang) || document.documentElement.lang || "").toLowerCase().startsWith("nl");
  const PAGE = location.pathname.split("/").pop() || "index.html";
  const STORE_KEY = "mchat-history-v2";
  const TIMEOUT_MS = 30000;

  const T = isNL ? {
    button: "Hulp", title: "Hulp bij deze pagina",
    hello: "Hoi! Vraag me hoe deze pagina werkt, bijvoorbeeld wat je in een veld invult of waarom je een melding krijgt.",
    placeholder: "Typ je vraag…", send: "Verstuur", thinking: "Even denken",
    error: "De hulp is nu niet bereikbaar.", retry: "Opnieuw proberen", close: "Sluiten",
    reset: "Nieuw gesprek", timeout: "Het antwoord duurde te lang.",
    noWorker: "Kan de hulpserver niet bereiken. Controleer je internetverbinding.",
    privacy: "Typ geen klantgegevens in de chat."
  } : {
    button: "Help", title: "Help with this page",
    hello: "Hi! Ask me how this page works, for example what to enter in a field or why you see a message.",
    placeholder: "Type your question…", send: "Send", thinking: "Thinking",
    error: "Help isn't available right now.", retry: "Try again", close: "Close",
    reset: "New conversation", timeout: "The answer took too long.",
    noWorker: "Can't reach the help server. Check your internet connection.",
    privacy: "Don't type customer details into the chat."
  };

  // Starter questions per page (one tap sends them)
  const STARTERS = {
    "index.html": isNL
      ? ["Welk document heb ik nodig?", "Hoe maak ik een final notice vanuit een statement?"]
      : ["Which document do I need?", "How do I make a final notice from a statement?"],
    "customer-statement.html": isNL
      ? ["Wat is het verschil tussen optie A en B?", "Hoe wordt de late fee berekend?"]
      : ["What's the difference between Option A and B?", "How are late fees calculated?", "What does the payment agreement deduction do?"],
    "final-notice.html": isNL
      ? ["Hoe wordt de escalatiedatum berekend?", "Kan ik gegevens uit een statement overnemen?"]
      : ["How is the escalation date calculated?", "Can I take details from a statement?"],
    "bevel-tot-betaling.html": isNL
      ? ["Hoe werkt het uploaden van een statement?", "Wanneer vink ik 'fysieke winkel' aan?", "Hoe sla ik een kantoor op?"]
      : ["How does uploading a statement work?", "When do I tick 'physical store'?"],
    "lease-agreement.html": isNL
      ? ["Hoe zet ik meerdere items in het contract?", "Waarom mag de incassodag maximaal 28 zijn?"]
      : ["How do I add several items?", "Why is the billing day at most 28?"],
    "betalingen-boeken.html": isNL
      ? ["Slepen naar de bladwijzerbalk lukt niet", "Wat doet Testrun?", "Een betaling is 'Niet gevonden'"]
      : ["Dragging to the bookmarks bar doesn't work", "What does Test run do?"],
    "factoring.html": isNL
      ? ["Hoe maak ik een factoring vanuit een statement?", "Hoe verander ik de verkoper?"]
      : ["How do I make a factoring from a statement?", "How do I change the seller?"]
  };

  const css = `
  #mchat-root{
    --mc-brand:var(--brand,#0F5D94);--mc-brand-ink:var(--brand-ink,#0A4470);--mc-accent:var(--accent,#F2810E);
    --mc-ink:var(--ink,#16202A);--mc-soft:var(--ink-soft,#4E5B68);--mc-line:var(--line,#D2DBE2);--mc-bg:var(--surface-2,#F5F7F9);
    position:fixed;right:20px;bottom:20px;z-index:2147483000;
    font-family:var(--font,"IBM Plex Sans","Segoe UI",system-ui,sans-serif);color:var(--mc-ink);font-size:15px;line-height:1.5;}
  #mchat-root *{box-sizing:border-box;}
  .mchat-btn{display:flex;align-items:center;gap:8px;background:var(--mc-brand);color:#fff;border:none;border-radius:999px;
    padding:12px 18px 12px 14px;font:600 15px/1 inherit;font-family:inherit;cursor:pointer;min-height:46px;
    box-shadow:0 6px 18px -6px rgba(10,68,112,.55);}
  .mchat-btn:hover{background:var(--mc-brand-ink);}
  .mchat-btn .dot{width:9px;height:9px;border-radius:50%;background:var(--mc-accent);margin-left:2px;}
  #mchat-root button:focus-visible,#mchat-root textarea:focus-visible{outline:3px solid var(--mc-accent);outline-offset:2px;}
  .mchat-panel{display:none;flex-direction:column;width:min(390px,calc(100vw - 32px));height:min(560px,calc(100vh - 100px));
    background:#fff;border:1px solid var(--mc-line);border-radius:14px;box-shadow:0 18px 44px -12px rgba(20,32,42,.35);overflow:hidden;}
  #mchat-root.open .mchat-panel{display:flex;animation:mchatIn .18s ease-out;}
  #mchat-root.open .mchat-btn{display:none;}
  @keyframes mchatIn{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:none;}}
  .mchat-head{display:flex;align-items:center;gap:8px;padding:12px 10px 12px 16px;border-bottom:1px solid var(--mc-line);border-top:4px solid var(--tool,var(--mc-brand));}
  .mchat-head b{font-size:15.5px;font-weight:600;flex:1;}
  .mchat-iconbtn{background:none;border:none;color:var(--mc-soft);cursor:pointer;border-radius:8px;padding:6px 8px;font:500 13px/1 inherit;font-family:inherit;}
  .mchat-iconbtn:hover{background:var(--mc-bg);color:var(--mc-ink);}
  .mchat-x{font-size:22px;line-height:1;padding:4px 9px;}
  .mchat-log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:var(--mc-bg);}
  .mchat-msg{max-width:88%;padding:10px 13px;border-radius:12px;font-size:14.5px;line-height:1.55;word-wrap:break-word;}
  .mchat-msg p{margin:0 0 8px;} .mchat-msg p:last-child{margin:0;}
  .mchat-msg ol,.mchat-msg ul{margin:4px 0 8px;padding-left:20px;} .mchat-msg li{margin:2px 0;}
  .mchat-msg code{background:rgba(0,0,0,.06);border-radius:4px;padding:0 4px;font-size:13.5px;}
  .mchat-msg a{color:inherit;}
  .mchat-bot{align-self:flex-start;background:#fff;border:1px solid var(--mc-line);border-bottom-left-radius:4px;}
  .mchat-user{align-self:flex-end;background:var(--mc-brand);color:#fff;border-bottom-right-radius:4px;white-space:pre-wrap;}
  .mchat-err{align-self:stretch;max-width:none;background:#FDEDEB;border:1px solid #F0C2BC;color:#8A1C12;}
  .mchat-err button{margin-top:8px;background:#fff;border:1px solid #E3A49C;color:#8A1C12;border-radius:7px;padding:6px 12px;font:600 13.5px/1.2 inherit;font-family:inherit;cursor:pointer;}
  .mchat-typing{display:inline-flex;gap:4px;align-items:center;}
  .mchat-typing i{width:7px;height:7px;border-radius:50%;background:var(--mc-soft);opacity:.35;animation:mchatDot 1s infinite;}
  .mchat-typing i:nth-child(2){animation-delay:.15s;} .mchat-typing i:nth-child(3){animation-delay:.3s;}
  @keyframes mchatDot{0%,60%,100%{opacity:.25;transform:none;}30%{opacity:.9;transform:translateY(-3px);}}
  .mchat-starters{display:flex;flex-direction:column;align-items:flex-start;gap:6px;}
  .mchat-starters button{background:#fff;border:1px solid var(--mc-line);color:var(--mc-brand);border-radius:999px;padding:7px 13px;
    font:500 13.5px/1.3 inherit;font-family:inherit;cursor:pointer;text-align:left;}
  .mchat-starters button:hover{border-color:var(--mc-brand);background:#F0F6FB;}
  .mchat-note{font-size:12.5px;color:var(--mc-soft);padding:0 14px 8px;background:#fff;}
  .mchat-form{display:flex;gap:8px;padding:10px 12px 6px;border-top:1px solid var(--mc-line);background:#fff;align-items:flex-end;}
  .mchat-form textarea{flex:1;resize:none;min-height:44px;max-height:120px;border:1px solid #B4C1CC;border-radius:10px;padding:10px 12px;
    font:15px/1.4 inherit;font-family:inherit;color:var(--mc-ink);}
  .mchat-form textarea:focus{outline:none;border-color:var(--mc-brand);box-shadow:0 0 0 3px rgba(15,93,148,.18);}
  .mchat-send{background:var(--mc-brand);color:#fff;border:none;border-radius:10px;width:44px;height:44px;flex:none;cursor:pointer;
    display:flex;align-items:center;justify-content:center;}
  .mchat-send:hover{background:var(--mc-brand-ink);}
  .mchat-send:disabled{opacity:.45;cursor:default;}
  @media print{#mchat-root{display:none !important;}}
  @media (max-width:480px){#mchat-root{right:12px;bottom:12px;}
    #mchat-root.open{left:8px;right:8px;bottom:8px;} .mchat-panel{width:100%;height:min(600px,calc(100vh - 16px));}}
  @media (prefers-reduced-motion:reduce){#mchat-root *{animation:none !important;}}`;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "mchat-root";
  root.innerHTML = `
    <button class="mchat-btn" type="button" aria-expanded="false" aria-controls="mchat-panel">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>
      ${T.button}<span class="dot" aria-hidden="true"></span>
    </button>
    <div class="mchat-panel" id="mchat-panel" role="dialog" aria-label="${T.title}">
      <div class="mchat-head">
        <b>${T.title}</b>
        <button class="mchat-iconbtn mchat-reset" type="button">${T.reset}</button>
        <button class="mchat-iconbtn mchat-x" type="button" aria-label="${T.close}">&times;</button>
      </div>
      <div class="mchat-log" aria-live="polite"></div>
      <div class="mchat-form">
        <textarea rows="1" placeholder="${T.placeholder}" aria-label="${T.placeholder}" maxlength="2000"></textarea>
        <button class="mchat-send" type="button" aria-label="${T.send}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="mchat-note">${T.privacy}</div>
    </div>`;
  document.body.appendChild(root);

  const openBtn = root.querySelector(".mchat-btn");
  const closeBtn = root.querySelector(".mchat-x");
  const resetBtn = root.querySelector(".mchat-reset");
  const log = root.querySelector(".mchat-log");
  const input = root.querySelector("textarea");
  const sendBtn = root.querySelector(".mchat-send");
  let history = loadHistory();
  let busy = false;

  // ---- storage: the conversation follows you from page to page in this tab ----
  function loadHistory(){
    try { const h = JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]"); return Array.isArray(h) ? h.slice(-30) : []; }
    catch { return []; }
  }
  function saveHistory(){ try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-30))); } catch {} }

  // ---- safe, small markdown: **bold**, `code`, lists, paragraphs, e-mail links ----
  function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
  function inline(s){
    return escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\b([\w.+-]+@[\w-]+\.[\w.]+)\b/g, '<a href="mailto:$1">$1</a>');
  }
  function renderMarkdown(text){
    const out = []; let list = null;
    const close = () => { if (list){ out.push(`</${list}>`); list = null; } };
    text.replace(/\r/g, "").split("\n").forEach(line => {
      const ol = line.match(/^\s*\d+[.)]\s+(.*)/), ul = line.match(/^\s*[-*•]\s+(.*)/);
      if (ol || ul){
        const tag = ol ? "ol" : "ul";
        if (list !== tag){ close(); out.push(`<${tag}>`); list = tag; }
        out.push(`<li>${inline((ol || ul)[1])}</li>`);
      } else if (!line.trim()){ close(); }
      else { close(); out.push(`<p>${inline(line)}</p>`); }
    });
    close();
    return out.join("");
  }

  function addMsg(text, who){
    const el = document.createElement("div");
    el.className = "mchat-msg " + (who === "user" ? "mchat-user" : "mchat-bot");
    if (who === "user") el.textContent = text; else el.innerHTML = renderMarkdown(text);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  function addTyping(){
    const el = document.createElement("div");
    el.className = "mchat-msg mchat-bot";
    el.setAttribute("aria-label", T.thinking);
    el.innerHTML = '<span class="mchat-typing"><i></i><i></i><i></i></span>';
    log.appendChild(el); log.scrollTop = log.scrollHeight;
    return el;
  }
  function addStarters(){
    const list = STARTERS[PAGE];
    if (!list || !list.length) return;
    const box = document.createElement("div");
    box.className = "mchat-starters";
    list.forEach(q => {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = q;
      b.addEventListener("click", () => { box.remove(); send(q); });
      box.appendChild(b);
    });
    log.appendChild(box);
  }
  function renderAll(){
    log.innerHTML = "";
    addMsg(T.hello, "bot");
    history.forEach(m => addMsg(m.content, m.role === "user" ? "user" : "bot"));
    if (!history.length) addStarters();
  }

  // ---- what the assistant may know about the page: labels, buttons and messages, never field values ----
  function pageContext(){
    const visible = el => el.offsetParent !== null || el.getClientRects().length > 0;
    const clean = el => el.textContent.replace(/\s+/g, " ").trim();
    const outside = el => !root.contains(el);
    const labels = [...document.querySelectorAll("label, h1, h2, h3, button, th, summary")]
      .filter(el => outside(el) && visible(el)).map(clean).filter(Boolean).slice(0, 70);
    const messages = [...document.querySelectorAll(".error, .alert-error, #errorBox, .status, .prefill-note.show, .result.show, #pdfStatus, [role=alert]")]
      .filter(el => outside(el) && visible(el) && el.textContent.trim()).map(clean);
    const flagged = [...document.querySelectorAll('.field.invalid, .field.needs-input, [aria-invalid="true"]')]
      .filter(outside).map(el => {
        const f = el.closest(".field, .row > div, .contract, .card") || el;
        const lab = f.querySelector("label");
        return lab ? clean(lab) : (el.id || "");
      }).filter(Boolean);
    const previewShown = ["#output", "#statement", "#preview", "#previewWrap"].some(sel => {
      const el = document.querySelector(sel); return el && visible(el) && getComputedStyle(el).display !== "none";
    });
    return `Page title: ${document.title}\nPage file: ${PAGE}\n` +
      `Showing the generated document/preview: ${previewShown ? "yes" : "no"}\n` +
      `Visible labels/buttons: ${[...new Set(labels)].join(" | ")}\n` +
      `Fields marked as missing or invalid: ${flagged.length ? [...new Set(flagged)].join(" | ") : "none"}\n` +
      `Visible messages: ${messages.length ? [...new Set(messages)].join(" | ") : "none"}`;
  }

  async function ask(){
    const wait = addTyping();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      if (!ENDPOINT) throw new Error("No worker address set in help-chat.js");
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, page: pageContext(), lang: isNL ? "nl" : "en" }),
        signal: ctrl.signal
      });
      let data;
      try { data = await res.json(); }
      catch { throw new Error("The worker did not answer with chat data (is worker.js deployed?)"); }
      if (!res.ok || !data.reply) throw new Error(data.error || ("HTTP " + res.status));
      wait.remove();
      history.push({ role: "assistant", content: data.reply });
      saveHistory();
      addMsg(data.reply, "bot");
    } catch (err){
      console.error("Help chat:", err);
      wait.remove();
      const why = err.name === "AbortError" ? T.timeout
        : (err.message === "Failed to fetch" || err instanceof TypeError) ? T.noWorker
        : err.message;
      const el = document.createElement("div");
      el.className = "mchat-msg mchat-err";
      el.setAttribute("role", "alert");
      el.innerHTML = `<div>${escapeHtml(T.error)} ${escapeHtml(why)}</div>`;
      const retry = document.createElement("button");
      retry.type = "button"; retry.textContent = T.retry;
      retry.addEventListener("click", async () => { el.remove(); setBusy(true); await ask(); setBusy(false); });
      el.appendChild(retry);
      log.appendChild(el); log.scrollTop = log.scrollHeight;
    } finally {
      clearTimeout(timer);
    }
  }

  function setBusy(b){ busy = b; sendBtn.disabled = b; if (!b) input.focus(); }

  async function send(preset){
    const text = (preset || input.value).trim();
    if (!text || busy) return;
    setBusy(true);
    input.value = ""; grow();
    log.querySelectorAll(".mchat-starters, .mchat-err").forEach(el => el.remove());
    addMsg(text, "user");
    history.push({ role: "user", content: text });
    saveHistory();
    await ask();
    setBusy(false);
  }

  function grow(){ input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 120) + "px"; }

  function open(){
    root.classList.add("open"); openBtn.setAttribute("aria-expanded", "true");
    if (!log.children.length) renderAll();
    input.focus();
  }
  function close(){
    root.classList.remove("open"); openBtn.setAttribute("aria-expanded", "false"); openBtn.focus();
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  resetBtn.addEventListener("click", () => { if (busy) return; history = []; saveHistory(); renderAll(); input.focus(); });
  sendBtn.addEventListener("click", () => send());
  input.addEventListener("input", grow);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); send(); }
  });
  root.addEventListener("keydown", e => { if (e.key === "Escape" && root.classList.contains("open")) close(); });
})();
