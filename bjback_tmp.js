/* Blog J 공통 — 휴대폰 · PC 뒤로 가기 v2 (11-13 제이: 뒤로 가기로 앱이 바로 꺼지지 않게 · 이전 화면으로 · 닫기 전에 꼭 확인)
   한 번 누를 때마다 한 단계씩: 떠 있는 창 닫기 → 앱의 이전 화면(views) → 앱이 정한 단계(hook) → 맨 처음이면 「○○ 앱을 닫을까요?」 확인 창.
   확인 창에서 「닫기」를 누를 때만 앱이 닫힘(뒤로 한 번 더 누르면 확인 창만 닫힘).
   쓰는 법: BJBACK.init({ ov: [창 선택자...], views: { get: () => 지금 화면, set: v => 그 화면으로 }, hook: () => true(처리함)/false }) */
(function () {
  if (window.bjAskExit) return;
  const name = () => (document.title.split("|")[0] || "").trim() || "이";
  window.bjAskOpen = () => !!document.getElementById("bjAsk");
  window.bjAskClose = () => { const o = document.getElementById("bjAsk"); if (o) o.remove(); };
  window.bjAskExit = function (o) {
    o = o || {}; if (window.bjAskOpen()) return;
    const w = document.createElement("div"); w.id = "bjAsk"; w.setAttribute("role", "alertdialog"); w.setAttribute("aria-modal", "true");
    w.style.cssText = "position:fixed;inset:0;z-index:2147483600;background:rgba(11,25,32,.5);display:flex;align-items:center;justify-content:center;padding:20px;font-family:SUIT,Pretendard,'Malgun Gothic',system-ui,sans-serif";
    w.innerHTML = '<div style="background:#fff;color:#14202B;border-radius:18px;padding:22px 22px 18px;width:min(360px,100%);box-shadow:0 20px 50px rgba(0,0,0,.3)">'
      + '<b style="display:block;font-size:18px;font-weight:900;letter-spacing:-.02em;margin-bottom:8px"></b>'
      + '<p style="margin:0 0 18px;font-size:14.5px;line-height:1.6;color:#5F6B7A">다시 열면 이어서 쓸 수 있어요.</p>'
      + '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" data-k="stay" style="height:44px;padding:0 16px;border-radius:11px;border:0;background:#fff;box-shadow:0 0 0 1px #CDD3DC;font:inherit;font-weight:800;font-size:15px;color:#14202B;cursor:pointer">계속 쓰기</button>'
      + '<button type="button" data-k="leave" style="height:44px;padding:0 18px;border-radius:11px;border:0;background:#0C737D;color:#fff;font:inherit;font-weight:800;font-size:15px;cursor:pointer">닫기</button></div></div>';
    w.querySelector("b").textContent = name() + " 앱을 닫을까요?";
    w.addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (!b && e.target !== w) return; window.bjAskClose(); if (b && b.dataset.k === "leave") { if (o.leave) o.leave(); } else if (o.stay) o.stay(); });
    w.addEventListener("keydown", e => { if (e.key === "Escape") { window.bjAskClose(); if (o.stay) o.stay(); } });
    document.body.appendChild(w); setTimeout(() => { const b = w.querySelector('[data-k="stay"]'); if (b) b.focus(); }, 30);
  };
})();
(function () {
  const C = { ov: [".bkx-ov", ".fpx-ov"], btn: { ".ippg": "[data-ipclose],.ipx" }, hook: null, views: null };
  let armed = false, busy = false; const VS = [];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function arm() { window.__bjExit = false; if (history.state && history.state.bjg) { armed = true; return; } try { history.pushState(Object.assign({}, history.state || {}, { bjg: 1 }), ""); armed = true; } catch (e) {} }
  const vis = e => e && e.isConnected && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
  function topOv() { const sel = C.ov.concat(Object.keys(C.btn)).join(","); if (!sel) return null; const L = [...document.querySelectorAll(sel)].filter(vis); return L[L.length - 1] || null; }
  async function closeOv(o) {
    for (const k in C.btn) if (o.matches(k)) { const b = o.querySelector(C.btn[k]); if (b) { b.click(); await wait(60); if (!vis(o)) return; } }
    o.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); await wait(80); if (!vis(o)) return;
    o.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); await wait(80);
  }
  /* 이전 화면 기억: 화면(views.get())이 바뀔 때마다 적어 둠 → 뒤로 가기 = 바로 앞 화면 */
  function track() { if (!C.views) return; let v; try { v = C.views.get(); } catch (e) { return; } const k = JSON.stringify(v); if (k === undefined) return; if (!VS.length || VS[VS.length - 1].k !== k) { const at = VS.findIndex(x => x.k === k); if (at >= 0) VS.splice(at + 1); else VS.push({ k, v }); if (VS.length > 40) VS.shift(); } }
  function say(m) { let t = document.getElementById("bjbToast"); if (!t) { t = document.createElement("div"); t.id = "bjbToast"; t.setAttribute("role", "status"); t.style.cssText = "position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483000;background:rgba(20,32,43,0.92);color:#fff;font:600 14.5px/1.4 SUIT,Pretendard,system-ui,sans-serif;padding:11px 18px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.25);max-width:calc(100vw - 32px);text-align:center;pointer-events:none;transition:opacity .2s;opacity:0"; document.body.appendChild(t); }
    t.textContent = m; t.style.opacity = "1"; clearTimeout(say.t); say.t = setTimeout(() => { t.style.opacity = "0"; }, 2400); }
  function ask() { arm(); window.bjAskExit({ stay: () => arm(), leave: () => { window.__bjExit = true; history.back(); } }); }
  window.addEventListener("popstate", async () => {
    armed = false; if (window.__bjExit) { history.back(); return; } if (busy) return; busy = true;
    try {
      if (window.bjAskOpen()) { window.bjAskClose(); arm(); return; }
      const o = topOv(); if (o) { await closeOv(o); arm(); return; }
      track();
      if (C.views && VS.length > 1) { VS.pop(); const p = VS[VS.length - 1]; try { C.views.set(p.v); } catch (e) {} window.scrollTo(0, 0); arm(); return; }
      let done = false; if (C.hook) { try { done = !!(await C.hook()); } catch (e) { done = false; } }
      if (done) { track(); arm(); return; }
      ask();
    } finally { busy = false; }
  });
  ["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, () => { if (!armed) arm(); }, true));
  setInterval(track, 400);
  window.BJBACK = { init(o) { if (o) { if (o.ov) C.ov = C.ov.concat(o.ov); if (o.btn) Object.assign(C.btn, o.btn); if (o.hook) C.hook = o.hook; if (o.views) { C.views = o.views; VS.length = 0; track(); } } }, arm, say, ask };
})();
