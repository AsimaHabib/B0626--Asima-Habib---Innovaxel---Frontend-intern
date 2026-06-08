// ---- DATA ----
const STORAGE_KEY = 'spendwise_expenses_v2';
const CATEGORIES = ['Food & Dining','Transport','Utilities','Shopping','Entertainment','Health','Travel','Other'];

const CAT_COLORS = {
  'Food & Dining':    { bg: '#fdf3e0', text: '#b87a1a', dot: '#e09b30', chart: '#e09b30' },
  'Transport':        { bg: '#e8f1fa', text: '#2d6ea8', dot: '#3d84c8', chart: '#3d84c8' },
  'Utilities':        { bg: '#eaf5f0', text: '#2d8a6b', dot: '#38a882', chart: '#38a882' },
  'Shopping':         { bg: '#f0ebf9', text: '#6b4da8', dot: '#8b6dc8', chart: '#8b6dc8' },
  'Entertainment':    { bg: '#fdf0e8', text: '#c96b41', dot: '#e8845a', chart: '#e8845a' },
  'Health':           { bg: '#fbeaea', text: '#c94040', dot: '#e05555', chart: '#e05555' },
  'Travel':           { bg: '#e8f8f8', text: '#1a7a7a', dot: '#2a9595', chart: '#2a9595' },
  'Other':            { bg: '#f0ede4', text: '#6b6760', dot: '#9b9893', chart: '#9b9893' },
};

let expenses = [];
let editingId = null;
let pieChartInst = null;
let barChartInst = null;
let barCatInst = null;
let doughnutInst = null;

function loadData() {
  try {
    expenses = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { expenses = []; }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function formatCurrency(n) {
  return '$' + parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${parseInt(day)}, ${y}`;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---- VIEWS ----
let currentView = 'dashboard';

function switchView(v) {
  currentView = v;
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('view-' + v).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(v)) el.classList.add('active');
  });
  const titles = { dashboard: 'Dashboard', expenses: 'All Expenses', analytics: 'Analytics' };
  document.getElementById('page-title').textContent = titles[v];
  renderAll();
}

function renderAll() {
  updateSidebarTotal();
  if (currentView === 'dashboard') renderDashboard();
  else if (currentView === 'expenses') renderExpenses();
  else if (currentView === 'analytics') renderAnalytics();
}

// ---- SIDEBAR TOTAL ----
function updateSidebarTotal() {
  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  document.getElementById('sidebar-total').textContent = formatCurrency(total);
}

// ---- CATEGORY BADGE ----
function catBadge(cat) {
  const c = CAT_COLORS[cat] || CAT_COLORS['Other'];
  return `<span class="cat-badge" style="background:${c.bg};color:${c.text};">
    <span class="cat-dot" style="background:${c.dot};"></span>${cat}
  </span>`;
}

// ---- DASHBOARD ----
function renderDashboard() {
  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthExpenses = expenses.filter(e => e.date.startsWith(thisMonth));
  const monthTotal = monthExpenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const avgTx = expenses.length ? total / expenses.length : 0;
  const topCat = getTopCategory();

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card accent">
      <div class="stat-label">Total Spent</div>
      <div class="stat-value">${formatCurrency(total)}</div>
      <div class="stat-sub">${expenses.length} transaction${expenses.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">This Month</div>
      <div class="stat-value">${formatCurrency(monthTotal)}</div>
      <div class="stat-sub">${monthExpenses.length} transactions</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg Transaction</div>
      <div class="stat-value">${formatCurrency(avgTx)}</div>
      <div class="stat-sub">per expense</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">Top Category</div>
      <div class="stat-value" style="font-size:18px;margin-top:2px;">${topCat || '—'}</div>
      <div class="stat-sub">most spending</div>
    </div>
  `;

  renderPieChart();
  renderBarChart();

  // Recent 5
  const recent = [...expenses].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5);
  const wrap = document.getElementById('recent-expenses-wrap');
  if (!recent.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No expenses yet</div><div class="empty-sub">Add your first expense to get started.</div></div>`;
    return;
  }
  wrap.innerHTML = `<table class="expenses-table">
    <thead><tr><th>Title</th><th>Category</th><th>Date</th><th>Amount</th></tr></thead>
    <tbody>${recent.map(e => `
      <tr onclick="switchView('expenses')">
        <td><div class="expense-title">${escHtml(e.title)}</div>${e.notes?`<div class="expense-notes">${escHtml(e.notes)}</div>`:''}</td>
        <td>${catBadge(e.category)}</td>
        <td class="expense-date">${formatDate(e.date)}</td>
        <td class="expense-amount">${formatCurrency(e.amount)}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function getTopCategory() {
  const totals = {};
  expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + parseFloat(e.amount); });
  let top = null, max = 0;
  for (const k in totals) { if (totals[k] > max) { max = totals[k]; top = k; } }
  return top;
}

function getCategoryTotals() {
  const totals = {};
  expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + parseFloat(e.amount); });
  return totals;
}

function renderPieChart() {
  const totals = getCategoryTotals();
  const labels = Object.keys(totals);
  const data = labels.map(l => +totals[l].toFixed(2));
  const colors = labels.map(l => (CAT_COLORS[l] || CAT_COLORS['Other']).chart);

  if (pieChartInst) pieChartInst.destroy();
  if (!labels.length) return;

  pieChartInst = new Chart(document.getElementById('pieChart'), {
    type: 'pie',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#faf8f3' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` } } }
    }
  });

  const total = data.reduce((a,b) => a+b, 0);
  document.getElementById('pie-legend').innerHTML = labels.map((l, i) =>
    `<div class="legend-item"><span class="legend-dot" style="background:${colors[i]}"></span>${l} (${((data[i]/total)*100).toFixed(0)}%)</div>`
  ).join('');
}

function renderBarChart() {
  const monthMap = {};
  expenses.forEach(e => {
    const m = e.date.slice(0, 7);
    monthMap[m] = (monthMap[m] || 0) + parseFloat(e.amount);
  });
  const sorted = Object.keys(monthMap).sort();
  const labels = sorted.map(m => { const [y,mo] = m.split('-'); const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return months[parseInt(mo)-1]+' '+y.slice(2); });
  const data = sorted.map(m => +monthMap[m].toFixed(2));

  if (barChartInst) barChartInst.destroy();
  if (!sorted.length) return;

  barChartInst = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Spending', data, backgroundColor: '#e8845a', borderRadius: 5, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#9b9893' } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: v => '$'+v.toLocaleString(), font: { size: 11 }, color: '#9b9893' } }
      }
    }
  });
}

// ---- ALL EXPENSES VIEW ----
function renderExpenses() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const catFilter = document.getElementById('filter-cat').value;
  const fromFilter = document.getElementById('filter-from').value;
  const toFilter = document.getElementById('filter-to').value;

  // Update category filter options
  const catSel = document.getElementById('filter-cat');
  const usedCats = [...new Set(expenses.map(e => e.category))].sort();
  const current = catSel.value;
  catSel.innerHTML = '<option value="">All Categories</option>' + usedCats.map(c => `<option${c===current?' selected':''}>${c}</option>`).join('');

  let filtered = [...expenses].sort((a,b) => b.date.localeCompare(a.date));

  if (search) filtered = filtered.filter(e => e.title.toLowerCase().includes(search) || (e.notes||'').toLowerCase().includes(search));
  if (catFilter) filtered = filtered.filter(e => e.category === catFilter);
  if (fromFilter) filtered = filtered.filter(e => e.date >= fromFilter);
  if (toFilter) filtered = filtered.filter(e => e.date <= toFilter);

  const tbody = document.getElementById('expenses-tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">No expenses found</div><div class="empty-sub">Try adjusting your filters.</div></div></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(e => `
    <tr>
      <td><div class="expense-title">${escHtml(e.title)}</div>${e.notes?`<div class="expense-notes">${escHtml(e.notes)}</div>`:''}</td>
      <td>${catBadge(e.category)}</td>
      <td class="expense-date">${formatDate(e.date)}</td>
      <td class="expense-amount">${formatCurrency(e.amount)}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" onclick="editExpense('${e.id}')" title="Edit">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="action-btn delete" onclick="deleteExpense('${e.id}')" title="Delete">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function clearFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('filter-cat').value = '';
  document.getElementById('filter-from').value = '';
  document.getElementById('filter-to').value = '';
  renderExpenses();
}

// ---- ANALYTICS VIEW ----
function renderAnalytics() {
  const total = expenses.reduce((s, e) => s + parseFloat(e.amount), 0);
  const totals = getCategoryTotals();
  const numCats = Object.keys(totals).length;
  const maxCat = getTopCategory();
  const maxAmt = maxCat ? totals[maxCat] : 0;

  document.getElementById('analytics-stats').innerHTML = `
    <div class="stat-card accent">
      <div class="stat-label">Total Spent</div>
      <div class="stat-value">${formatCurrency(total)}</div>
      <div class="stat-sub">all time</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Categories</div>
      <div class="stat-value">${numCats}</div>
      <div class="stat-sub">active categories</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Transactions</div>
      <div class="stat-value">${expenses.length}</div>
      <div class="stat-sub">recorded</div>
    </div>
    <div class="stat-card green">
      <div class="stat-label">Largest Category</div>
      <div class="stat-value" style="font-size:16px;margin-top:4px;">${maxCat||'—'}</div>
      <div class="stat-sub">${maxAmt ? formatCurrency(maxAmt) : '—'}</div>
    </div>
  `;

  // Category Bar Chart (horizontal)
  const catLabels = Object.keys(totals).sort((a,b) => totals[b]-totals[a]);
  const catData = catLabels.map(l => +totals[l].toFixed(2));
  const catColors = catLabels.map(l => (CAT_COLORS[l]||CAT_COLORS['Other']).chart);

  if (barCatInst) barCatInst.destroy();
  if (catLabels.length) {
    const h = Math.max(200, catLabels.length * 44 + 60);
    document.getElementById('barCatChart').parentElement.style.height = h + 'px';
    barCatInst = new Chart(document.getElementById('barCatChart'), {
      type: 'bar',
      data: { labels: catLabels, datasets: [{ data: catData, backgroundColor: catColors, borderRadius: 4, borderSkipped: false }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + formatCurrency(ctx.raw) } } },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: v => '$'+v.toLocaleString(), font: { size: 11 }, color: '#9b9893' } },
          y: { grid: { display: false }, ticks: { font: { size: 12 }, color: '#1a1a1a' } }
        }
      }
    });
  }

  // Doughnut
  if (doughnutInst) doughnutInst.destroy();
  if (catLabels.length) {
    doughnutInst = new Chart(document.getElementById('doughnutChart'), {
      type: 'doughnut',
      data: { labels: catLabels, datasets: [{ data: catData, backgroundColor: catColors, borderWidth: 3, borderColor: '#faf8f3' }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '62%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}` } } }
      }
    });
    document.getElementById('doughnut-legend').innerHTML = catLabels.map((l, i) =>
      `<div class="legend-item"><span class="legend-dot" style="background:${catColors[i]}"></span>${l}</div>`
    ).join('');
  }

  // Category Summary Table
  if (!catLabels.length) { document.getElementById('cat-summary-table').innerHTML = ''; return; }
  document.getElementById('cat-summary-table').innerHTML = `
    <table>
      <thead><tr><th>Category</th><th>Transactions</th><th>Total</th><th>% of Spend</th><th style="width:160px;">Share</th></tr></thead>
      <tbody>${catLabels.map(cat => {
        const amt = totals[cat];
        const count = expenses.filter(e => e.category === cat).length;
        const pct = total ? ((amt / total) * 100).toFixed(1) : 0;
        const c = CAT_COLORS[cat] || CAT_COLORS['Other'];
        return `<tr>
          <td>${catBadge(cat)}</td>
          <td style="color:var(--text-muted)">${count}</td>
          <td style="font-family:var(--font-serif);font-size:16px;">${formatCurrency(amt)}</td>
          <td style="color:var(--text-muted)">${pct}%</td>
          <td>
            <div class="progress-bar-wrap">
              <div class="progress-bar" style="width:${pct}%;background:${c.chart}"></div>
            </div>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table>`;
}

// ---- MODAL ----
function openModal(id = null) {
  editingId = id;
  const e = id ? expenses.find(x => x.id === id) : null;
  document.getElementById('modal-title').textContent = id ? 'Edit Expense' : 'Add Expense';
  document.getElementById('f-title').value = e ? e.title : '';
  document.getElementById('f-amount').value = e ? e.amount : '';
  document.getElementById('f-category').value = e ? e.category : '';
  document.getElementById('f-date').value = e ? e.date : new Date().toISOString().split('T')[0];
  document.getElementById('f-notes').value = e ? (e.notes || '') : '';
  clearErrors();
  document.getElementById('modal-backdrop').classList.add('open');
  setTimeout(() => document.getElementById('f-title').focus(), 100);
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  editingId = null;
}

function handleBackdropClick(e) {
  if (e.target === document.getElementById('modal-backdrop')) closeModal();
}

function clearErrors() {
  ['title','amount','category','date'].forEach(f => {
    document.getElementById('f-' + f).classList.remove('error');
    document.getElementById('err-' + f).classList.remove('show');
  });
}

function saveExpense() {
  const title = document.getElementById('f-title').value.trim();
  const amount = parseFloat(document.getElementById('f-amount').value);
  const category = document.getElementById('f-category').value;
  const date = document.getElementById('f-date').value;
  const notes = document.getElementById('f-notes').value.trim();

  clearErrors();
  let valid = true;

  if (!title) { setError('title', 'Title is required.'); valid = false; }
  if (!amount || amount <= 0 || isNaN(amount)) { setError('amount', 'Enter a valid positive amount.'); valid = false; }
  if (!category) { setError('category', 'Please select a category.'); valid = false; }
  if (!date) { setError('date', 'Date is required.'); valid = false; }
  if (!valid) return;

  if (editingId) {
    const idx = expenses.findIndex(e => e.id === editingId);
    if (idx !== -1) expenses[idx] = { ...expenses[idx], title, amount, category, date, notes };
    showToast('Expense updated', 'success');
  } else {
    expenses.push({ id: genId(), title, amount, category, date, notes });
    showToast('Expense added', 'success');
  }

  saveData();
  closeModal();
  renderAll();
}

function setError(field, msg) {
  document.getElementById('f-' + field).classList.add('error');
  const el = document.getElementById('err-' + field);
  el.textContent = msg;
  el.classList.add('show');
}

function editExpense(id) {
  openModal(id);
}

function deleteExpense(id) {
  expenses = expenses.filter(e => e.id !== id);
  saveData();
  showToast('Expense deleted', 'deleted');
  renderAll();
}

// ---- TOAST ----
let toastTimer = null;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---- UTILITY ----
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Keyboard shortcut
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openModal(); }
});

// ---- INIT with sample data ----
loadData();

if (expenses.length === 0) {
  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const d = (n) => { const dd = new Date(today); dd.setDate(dd.getDate() - n); return fmt(dd); };
  expenses = [
    { id: genId(), title: 'Grocery Run', amount: 84.50, category: 'Food & Dining', date: d(1), notes: 'Weekly groceries' },
    { id: genId(), title: 'Electricity Bill', amount: 120.00, category: 'Utilities', date: d(3), notes: '' },
    { id: genId(), title: 'Netflix Subscription', amount: 15.99, category: 'Entertainment', date: d(5), notes: '' },
    { id: genId(), title: 'Uber Ride', amount: 22.40, category: 'Transport', date: d(6), notes: 'Airport trip' },
    { id: genId(), title: 'Dinner with Friends', amount: 68.00, category: 'Food & Dining', date: d(8), notes: 'Italian restaurant' },
    { id: genId(), title: 'Running Shoes', amount: 129.99, category: 'Shopping', date: d(10), notes: 'Nike Air Max' },
    { id: genId(), title: 'Doctor Visit', amount: 75.00, category: 'Health', date: d(12), notes: 'Annual checkup' },
    { id: genId(), title: 'Flight Tickets', amount: 340.00, category: 'Travel', date: d(15), notes: 'NYC weekend trip' },
    { id: genId(), title: 'Coffee Shop', amount: 18.50, category: 'Food & Dining', date: d(17), notes: '' },
    { id: genId(), title: 'Internet Bill', amount: 60.00, category: 'Utilities', date: d(20), notes: '' },
    { id: genId(), title: 'Movie Tickets', amount: 32.00, category: 'Entertainment', date: d(22), notes: 'IMAX' },
    { id: genId(), title: 'Bus Pass', amount: 45.00, category: 'Transport', date: d(25), notes: 'Monthly pass' },
  ];
  saveData();
}

renderAll();
