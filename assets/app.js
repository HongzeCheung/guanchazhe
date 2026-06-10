const archive = window.ZHIHU_ARCHIVE;
const state = {
  category: "全部",
  type: "全部",
  query: "",
  sort: "dateDesc",
  selectedId: null,
  visible: [],
};

const els = {
  statGrid: document.getElementById("statGrid"),
  categoryList: document.getElementById("categoryList"),
  searchInput: document.getElementById("searchInput"),
  typeFilter: document.getElementById("typeFilter"),
  sortSelect: document.getElementById("sortSelect"),
  activeCategoryLabel: document.getElementById("activeCategoryLabel"),
  resultCount: document.getElementById("resultCount"),
  resultList: document.getElementById("resultList"),
  reader: document.getElementById("reader"),
  clearButton: document.getElementById("clearButton"),
  categoryBars: document.getElementById("categoryBars"),
};

const categoryClass = {
  "黄金": "gold",
  "白银": "silver",
  "A股": "cn",
  "美股": "us",
  "港股/中概": "green",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tokenize(query) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function scoreEntry(entry, tokens) {
  if (!tokens.length) return 1;
  let score = 0;
  const title = entry.title.toLowerCase();
  const text = entry.searchText;
  for (const token of tokens) {
    if (!text.includes(token)) return 0;
    if (title.includes(token)) score += 8;
    score += Math.min(8, (text.match(new RegExp(escapeRegExp(token), "g")) || []).length);
  }
  return score;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compareEntries(a, b) {
  if (state.sort === "dateAsc") return (a.date || "").localeCompare(b.date || "") || a.id - b.id;
  if (state.sort === "likesDesc") return b.likes - a.likes || (b.date || "").localeCompare(a.date || "");
  if (state.sort === "commentsDesc") return b.comments - a.comments || (b.date || "").localeCompare(a.date || "");
  if (state.query.trim()) return b._score - a._score || (b.date || "").localeCompare(a.date || "");
  return (b.date || "").localeCompare(a.date || "") || b.id - a.id;
}

function filterEntries() {
  const tokens = tokenize(state.query);
  state.visible = archive.entries
    .map((entry) => ({ ...entry, _score: scoreEntry(entry, tokens) }))
    .filter((entry) => entry._score > 0)
    .filter((entry) => state.category === "全部" || entry.category === state.category)
    .filter((entry) => state.type === "全部" || entry.type === state.type)
    .sort(compareEntries);
  if (!state.visible.some((entry) => entry.id === state.selectedId)) {
    state.selectedId = state.visible[0]?.id ?? null;
  }
}

function renderStats() {
  const answerCount = archive.entries.filter((entry) => entry.type === "回答").length;
  const pinCount = archive.entries.filter((entry) => entry.type === "想法").length;
  els.statGrid.innerHTML = [
    ["总条目", archive.entries.length],
    ["回答", answerCount],
    ["想法", pinCount],
    ["分类", archive.categories.length - 1],
  ]
    .map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${formatNumber(value)}</strong></div>`)
    .join("");
}

function renderCategories() {
  els.categoryList.innerHTML = archive.categories
    .map((category) => {
      const count = category === "全部" ? archive.entries.length : archive.summary[category] || 0;
      return `<button class="category-button ${state.category === category ? "active" : ""}" data-category="${escapeHtml(category)}">
        <span>${escapeHtml(category)}</span>
        <span class="category-count">${formatNumber(count)}</span>
      </button>`;
    })
    .join("");
}

function renderTypeFilter() {
  const types = ["全部", "回答", "想法"];
  els.typeFilter.innerHTML = types
    .map((type) => `<button class="${state.type === type ? "active" : ""}" data-type="${type}">${type}</button>`)
    .join("");
}

function renderBars() {
  const counts = new Map();
  for (const entry of state.visible) counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
  const rows = archive.categories
    .filter((category) => category !== "全部" && counts.get(category))
    .map((category) => [category, counts.get(category)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const max = Math.max(1, ...rows.map((row) => row[1]));
  els.categoryBars.innerHTML = rows
    .map(([category, count]) => `<div class="bar-row">
      <span>${escapeHtml(category)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(5, (count / max) * 100)}%"></div></div>
      <strong>${count}</strong>
    </div>`)
    .join("");
}

function highlight(value) {
  const tokens = tokenize(state.query).slice(0, 6);
  let html = escapeHtml(value);
  for (const token of tokens) {
    html = html.replace(new RegExp(`(${escapeRegExp(escapeHtml(token))})`, "gi"), "<mark>$1</mark>");
  }
  return html;
}

function renderResults() {
  els.activeCategoryLabel.textContent = state.category === "全部" ? "全部分类" : state.category;
  els.resultCount.textContent = `${formatNumber(state.visible.length)} 条`;
  const rows = state.visible.slice(0, 500);
  if (!rows.length) {
    els.resultList.innerHTML = `<div class="empty-state">没有匹配结果。换一个关键词或清除筛选。</div>`;
    return;
  }
  els.resultList.innerHTML = rows
    .map((entry) => {
      const pillClass = categoryClass[entry.category] || "";
      return `<button class="result-item ${entry.id === state.selectedId ? "active" : ""}" data-id="${entry.id}">
        <div class="result-meta">
          <span class="pill ${pillClass}">${escapeHtml(entry.category)}</span>
          <span>${escapeHtml(entry.type)}</span>
          <span>${escapeHtml(entry.date || "未标日期")}</span>
          <span>赞 ${formatNumber(entry.likes)}</span>
          ${entry.comments ? `<span>评 ${formatNumber(entry.comments)}</span>` : ""}
        </div>
        <h3 class="result-title">${highlight(entry.title)}</h3>
        <p class="result-excerpt">${highlight(entry.excerpt || "")}</p>
      </button>`;
    })
    .join("");
  if (state.visible.length > rows.length) {
    els.resultList.insertAdjacentHTML("beforeend", `<div class="empty-state">已显示前 ${rows.length} 条，请继续输入关键词缩小范围。</div>`);
  }
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }
    if (trimmed.startsWith(">")) {
      flushParagraph();
      blocks.push(`<blockquote>${inlineMarkdown(trimmed.replace(/^>\s?/, ""))}</blockquote>`);
      continue;
    }
    if (/^!\[[^\]]*\]\([^)]+\)/.test(trimmed)) {
      flushParagraph();
      blocks.push(`<p>${inlineMarkdown(trimmed)}</p>`);
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();
  return blocks.join("");
}

function inlineMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, `<img alt="$1" src="$2" loading="lazy" />`);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, `<strong>$1</strong>`);
  return html;
}

function renderReader() {
  const entry = archive.entries.find((item) => item.id === state.selectedId);
  if (!entry) {
    els.reader.innerHTML = `<div class="reader-empty"><h2>选择一条内容开始阅读</h2><p>列表会随关键词、分类和内容类型实时筛选。</p></div>`;
    return;
  }
  const pillClass = categoryClass[entry.category] || "";
  els.reader.innerHTML = `<div class="result-meta">
      <span class="pill ${pillClass}">${escapeHtml(entry.category)}</span>
      <span>${escapeHtml(entry.type)}</span>
      <span>${escapeHtml(entry.date || "未标日期")}</span>
      <span>赞 ${formatNumber(entry.likes)}</span>
      ${entry.comments ? `<span>评 ${formatNumber(entry.comments)}</span>` : ""}
    </div>
    <h2 class="reader-title">${escapeHtml(entry.title)}</h2>
    <div class="reader-actions">
      ${entry.url ? `<a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer">打开知乎原文</a>` : ""}
      <a href="#item-${entry.id}" id="copyLink">复制站内定位</a>
    </div>
    <div class="markdown">${renderMarkdown(entry.body || entry.excerpt || "")}</div>`;
}

function render() {
  filterEntries();
  renderCategories();
  renderTypeFilter();
  renderBars();
  renderResults();
  renderReader();
  if (state.selectedId) history.replaceState(null, "", `#item-${state.selectedId}`);
}

function selectFromHash() {
  const match = location.hash.match(/item-(\d+)/);
  if (match) state.selectedId = Number(match[1]);
}

els.categoryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  render();
});

els.typeFilter.addEventListener("click", (event) => {
  const button = event.target.closest("[data-type]");
  if (!button) return;
  state.type = button.dataset.type;
  render();
});

els.searchInput.addEventListener("input", () => {
  state.query = els.searchInput.value;
  render();
});

els.sortSelect.addEventListener("change", () => {
  state.sort = els.sortSelect.value;
  render();
});

els.resultList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-id]");
  if (!button) return;
  state.selectedId = Number(button.dataset.id);
  renderResults();
  renderReader();
});

els.reader.addEventListener("click", async (event) => {
  if (event.target.id !== "copyLink") return;
  event.preventDefault();
  const url = `${location.origin}${location.pathname}#item-${state.selectedId}`;
  await navigator.clipboard?.writeText(url);
  event.target.textContent = "已复制";
  setTimeout(() => (event.target.textContent = "复制站内定位"), 1200);
});

els.clearButton.addEventListener("click", () => {
  state.category = "全部";
  state.type = "全部";
  state.query = "";
  state.sort = "dateDesc";
  state.selectedId = null;
  els.searchInput.value = "";
  els.sortSelect.value = state.sort;
  render();
});

renderStats();
selectFromHash();
render();
