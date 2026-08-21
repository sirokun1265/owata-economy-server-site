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

  function roundLabel(round, maxRound) {
    if (round === maxRound) return "決勝";
    if (round === maxRound - 1) return "準決勝";
    return `${round}回戦`;
  }

  function matchHtml(match) {
    return `<article class="match ${esc(match.status)}" data-match-id="${esc(match.id)}" data-source-a="${esc(match.sourceA || "")}" data-source-b="${esc(match.sourceB || "")}"><div class="player-row ${match.winner === match.playerA ? "winner" : ""}"><span>${esc(match.playerA || "未定")}</span>${match.winner === match.playerA ? "勝" : ""}</div><div class="player-row ${match.winner === match.playerB ? "winner" : ""}"><span>${esc(match.playerB || "未定")}</span>${match.winner === match.playerB ? "勝" : ""}</div>${match.reason ? `<small>${esc(match.reason)}</small>` : ""}</article>`;
  }

  function bracketHtml(matches, champion) {
    if (!matches?.length) return '<div class="empty">組み合わせ作成前です</div>';
    const rounds = new Map();
    matches.forEach((match) => {
      const round = Number(match.round) || 1;
      if (!rounds.has(round)) rounds.set(round, []);
      rounds.get(round).push(match);
    });
    rounds.forEach((list) => list.sort((a, b) => (Number(a.slot) || 0) - (Number(b.slot) || 0)));
    const roundNumbers = [...rounds.keys()].sort((a, b) => a - b);
    const maxRound = Math.max(...roundNumbers);
    const baseColumns = Math.max(1, rounds.get(roundNumbers[0])?.length || 1);
    const minWidth = Math.max(720, baseColumns * 210);
    const levels = roundNumbers.slice().reverse().map((round) => {
      const span = Math.max(1, 2 ** (round - 1));
      const slots = rounds.get(round).map((match) => {
        const start = (Number(match.slot) || 0) * span + 1;
        return `<div class="bracket-slot" style="grid-column:${start} / span ${span}">${matchHtml(match)}</div>`;
      }).join("");
      return `<section class="bracket-level" data-round="${round}" style="--level-columns:${baseColumns}"><h4>${roundLabel(round, maxRound)}</h4><div class="bracket-level-grid">${slots}</div></section>`;
    }).join("");
    return `<div class="bracket-scroll"><div class="bracket-tree" style="--bracket-columns:${baseColumns};--bracket-min-width:${minWidth}px"><svg class="bracket-lines" aria-hidden="true"></svg><div class="champion-node"><span>優勝</span><strong>${esc(champion || "未決定")}</strong></div>${levels}</div></div>`;
  }

  function drawTreeConnections(rootSelector) {
    const tree = document.querySelector(`${rootSelector} .bracket-tree`);
    const svg = tree?.querySelector(".bracket-lines");
    if (!tree || !svg) return;
    const treeRect = tree.getBoundingClientRect();
    const width = tree.scrollWidth;
    const height = tree.scrollHeight;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    const point = (element, edge) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left - treeRect.left + rect.width / 2, y: rect[edge] - treeRect.top };
    };
    const paths = [];
    tree.querySelectorAll(".match").forEach((parent) => {
      const parentPoint = point(parent, "bottom");
      const sourceIds = parent.dataset.sourceIds ? parent.dataset.sourceIds.split(",").filter(Boolean) : [parent.dataset.sourceA, parent.dataset.sourceB].filter(Boolean);
      sourceIds.forEach((sourceId) => {
        const source = tree.querySelector(`.match[data-match-id="${CSS.escape(sourceId)}"]`);
        if (!source) return;
        const sourcePoint = point(source, "top");
        const middleY = parentPoint.y + (sourcePoint.y - parentPoint.y) / 2;
        paths.push(`<path d="M ${parentPoint.x} ${parentPoint.y} V ${middleY} H ${sourcePoint.x} V ${sourcePoint.y}"/>`);
      });
    });
    const finalMatch = tree.querySelector(".bracket-level .match");
    const championNode = tree.querySelector(".champion-node");
    if (finalMatch && championNode) {
      const from = point(championNode, "bottom");
      const to = point(finalMatch, "top");
      paths.push(`<path class="champion-line" d="M ${from.x} ${from.y} V ${to.y}"/>`);
    }
    svg.innerHTML = paths.join("");
  }

  function drawBracketConnections() {
    drawTreeConnections("#pvpBracket");
    drawTreeConnections("#boatHeats");
  }

  function boatHeatHtml(heat, final = false) {
    const rows = heat.participants?.length
      ? heat.participants.map((player) => `<div class="player-row ${heat.result?.[0] === player ? "winner" : ""}"><span>${esc(player)}</span>${heat.result?.[0] === player ? "1位" : heat.result?.includes(player) ? `${heat.result.indexOf(player) + 1}位` : ""}</div>`).join("")
      : '<div class="player-row"><span>予選結果待ち</span></div>';
    return `<article class="match boat-heat ${esc(heat.status)}" data-match-id="boat-${esc(heat.id)}"${final ? ` data-source-ids="${esc(heat.sourceIds || "")}"` : ""}>${rows}</article>`;
  }

  function heatsHtml(heats, champion) {
    if (!heats?.length) return '<div class="empty">組み合わせ作成前です</div>';
    const qualifiers = heats.filter((h) => Number(h.round) === 1);
    const storedFinal = heats.find((h) => Number(h.round) === 2);
    const final = storedFinal || (qualifiers.length === 1 ? qualifiers[0] : { id: "final", round: 2, participants: [], result: [], status: "pending" });
    const columns = Math.max(1, qualifiers.length);
    const finalSourceIds = Number(final?.round) === 2 ? qualifiers.map((h) => `boat-${h.id}`).join(",") : "";
    const finalMarkup = final ? boatHeatHtml({ ...final, sourceIds: finalSourceIds }, Number(final.round) === 2) : "";
    const qualifierMarkup = Number(final?.round) === 2 ? qualifiers.map((heat, index) => `<div class="bracket-slot" style="grid-column:${index + 1}"><div class="boat-group-label">予選 第${index + 1}組</div>${boatHeatHtml(heat)}</div>`).join("") : "";
    const minWidth = Math.max(680, columns * 220);
    return `<div class="bracket-scroll"><div class="bracket-tree boat-tree" style="--bracket-columns:${columns};--bracket-min-width:${minWidth}px"><svg class="bracket-lines" aria-hidden="true"></svg><div class="champion-node"><span>優勝</span><strong>${esc(champion || "未決定")}</strong></div><section class="bracket-level boat-final-level"><h4>決勝（予選各組1位）</h4><div class="bracket-level-grid" style="--level-columns:${columns}"><div class="bracket-slot" style="grid-column:1 / span ${columns}">${finalMarkup}</div></div></section>${qualifierMarkup ? `<section class="bracket-level boat-qualifier-level"><h4>予選（各組3人・1位が決勝進出）</h4><div class="bracket-level-grid" style="--level-columns:${columns}">${qualifierMarkup}</div></section>` : ""}</div></div>`;
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
    $("pvpBracket").innerHTML = bracketHtml(state.pvp?.matches || [], state.pvp?.champion);
    requestAnimationFrame(drawBracketConnections);
    $("boatCount").textContent = `${boatPeople.length}人`;
    $("boatChampion").textContent = state.boat?.champion || "未決定";
    $("boatStatus").textContent = statusText(state.events?.boat);
    $("boatParticipants").innerHTML = participantsHtml(boatPeople);
    $("boatHeats").innerHTML = heatsHtml(state.boat?.heats || [], state.boat?.champion);
    requestAnimationFrame(drawBracketConnections);
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
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawBracketConnections, 100);
  });
  refresh(); setInterval(refresh, pollMs);
})();
