(function () {
  "use strict";
  const config = window.OWATA_EVENT_CONFIG || {};
  const apiBase = String(config.API_BASE_URL || "").replace(/\/$/, "");
  const pollMs = Math.max(1500, Number(config.POLL_INTERVAL_MS || 2500));
  let state = null;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (v) => v ? new Date(v).toLocaleString("ja-JP") : "--";
  const statusText = (e) => e?.locked ? "組み合わせ確定" : e?.status === "OPEN" ? "受付中" : "受付終了";

  async function api(path, options = {}) {
    if (!apiBase || apiBase.includes("YOUR-PUBLIC-API")) throw new Error("API URLが未設定です");
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const response = await fetch(`${apiBase}${path}`, { ...options, headers, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.code || `HTTP ${response.status}`);
    return body;
  }

  function setConnection(online) {
    const badge = $("connectionBadge");
    badge.textContent = online ? "● LIVE" : "● OFFLINE";
    badge.className = `status-badge ${online ? "online" : "offline"}`;
    $("offlineNotice").classList.toggle("hidden", online);
  }

  function participantsHtml(rows, pvp = false) {
    if (!rows?.length) return '<div class="empty">まだ参加者はいません</div>';
    return rows.map((p) => `<div class="participant"><span>${pvp ? `<i class="team-dot team-${esc(p.team || "red")}"></i>` : ""}${esc(p.player || p.name)}</span>${pvp ? `<small>${p.team === "white" ? "白" : "赤"}</small>` : ""}</div>`).join("");
  }

  function bracketHtml(matches) {
    if (!matches?.length) return '<div class="empty">組み合わせ作成前です</div>';
    const rounds = new Map();
    matches.forEach((m) => { if (!rounds.has(m.round)) rounds.set(m.round, []); rounds.get(m.round).push(m); });
    return [...rounds.entries()].map(([round, list]) => `<div class="round"><div class="round-title">ROUND ${round}</div>${list.map((m) => `<article class="match ${esc(m.status)}"><div class="player-row ${m.winner === m.playerA ? "winner" : ""}"><span>${esc(m.playerA || "未定")}</span>${m.winner === m.playerA ? "勝" : ""}</div><div class="player-row ${m.winner === m.playerB ? "winner" : ""}"><span>${esc(m.playerB || "未定")}</span>${m.winner === m.playerB ? "勝" : ""}</div>${m.reason ? `<small>${esc(m.reason)}</small>` : ""}</article>`).join("")}</div>`).join("");
  }

  function heatsHtml(heats) {
    if (!heats?.length) return '<div class="empty">組み合わせ作成前です</div>';
    return heats.map((h) => `<article class="heat"><h4>第${esc(h.id)}組</h4><div>${h.participants.map(esc).join(" / ")}</div>${h.result?.length ? `<div class="result">結果: ${h.result.map((p, i) => `${i + 1}位 ${esc(p)}`).join("・")}</div>` : '<small>結果待ち</small>'}</article>`).join("");
  }

  function render() {
    if (!state) return;
    const pvpPeople = state.participants?.pvp || [];
    const boatPeople = state.participants?.boat || [];
    $("pvpCount").textContent = `${pvpPeople.length}人`;
    $("redCount").textContent = `${state.pvp?.teams?.red || 0}人`;
    $("whiteCount").textContent = `${state.pvp?.teams?.white || 0}人`;
    $("pvpChampion").textContent = state.pvp?.champion || "未決定";
    $("pvpStatus").textContent = statusText(state.events?.pvp);
    $("pvpParticipants").innerHTML = participantsHtml(pvpPeople, true);
    $("pvpBracket").innerHTML = bracketHtml(state.pvp?.matches || []);
    $("boatCount").textContent = `${boatPeople.length}人`;
    $("boatChampion").textContent = state.boat?.champion || "未決定";
    $("boatStatus").textContent = statusText(state.events?.boat);
    $("boatParticipants").innerHTML = participantsHtml(boatPeople);
    $("boatHeats").innerHTML = heatsHtml(state.boat?.heats || []);
    $("lastUpdated").textContent = `最終更新: ${fmt(state.lastUpdated)}`;
  }

  async function refresh(showAdminError = false) {
    try { state = await api("/api/public/state"); setConnection(true); render(); }
    catch (error) { setConnection(false); if (showAdminError) message(error.message, true); }
  }
  document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === button));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === `${button.dataset.tab}Panel`));
  }));
  refresh(); setInterval(refresh, pollMs);
})();
