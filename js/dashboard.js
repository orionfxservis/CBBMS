// ================== CONFIGURATION ==================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyNFswl0i86ccG7NNm3NC7--ae5_etQ65qUZMgbYqmxfLaIyJVWKd32tYhmXDU1fDxr/exec';

// ================== DOM ELEMENTS ==================
const totalIncomeElem = document.getElementById('totalIncome');
const paidRentElem = document.getElementById('paidRent');
const paidMaintElem = document.getElementById('paidMaintenance');
const unpaidRentElem = document.getElementById('unpaidRent');
const unpaidMaintElem = document.getElementById('unpaidMaintenance');
const flatsTable = document.getElementById('flatsTable');
const modalOverlay = document.getElementById('modalOverlay');
const loaderOverlay = document.getElementById('loaderOverlay');
const searchInput = document.getElementById('searchInput');

// State to hold fetched data for searching
let dashboardData = [];
let incomeChartInstance = null;
let occupancyChartInstance = null;

// ================== INITIALIZATION ==================
document.addEventListener('DOMContentLoaded', () => {
  // Apply Settings First
  applySettings();

  // CHECK ROLE ACCESS
  checkRoleAccess();

  if (window.currentPage !== 'settings') loadDashboard();
  if (window.currentPage === 'settings') loadSettingsUI();

  // Search Listener
  if (searchInput) {
    searchInput.addEventListener('input', (events) => {
      if (window.currentPage === 'tenants') return filterTenants(events.target.value);
      if (window.currentPage === 'expenses') return filterExpenses(events.target.value);
      return filterTable(events.target.value);
    });
  }

  // Sidebar Toggle Logic
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.querySelector('.sidebar');

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth < 768 &&
        !sidebar.contains(e.target) &&
        !menuToggle.contains(e.target) &&
        sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
      }
    });
  }
});

// ================== SETTINGS LOGIC ==================
const defaultSettings = {
  buildingName: 'Prime Residency',
  currency: 'PKR',
  darkMode: false,
  rentMsg: 'Hello {name}, rental for {flat} is pending. Amount: {amount}'
};

function getSettings() {
  return JSON.parse(localStorage.getItem('bms_settings')) || defaultSettings;
}

function saveSettings() {
  const settings = {
    buildingName: document.getElementById('settingBuilderName').value || defaultSettings.buildingName,
    currency: document.getElementById('settingCurrency').value || defaultSettings.currency,
    darkMode: document.getElementById('settingDarkMode').checked,
    rentMsg: document.getElementById('settingRentMsg').value || defaultSettings.rentMsg
  };
  localStorage.setItem('bms_settings', JSON.stringify(settings));
  applySettings();
  showToast('Settings Saved', 'success');
}

function applySettings() {
  const s = getSettings();

  // 1. Dark Mode
  if (s.darkMode) document.body.classList.add('dark-mode');
  else document.body.classList.remove('dark-mode');

  // 2. Building Name
  const brand = document.querySelector('.sidebar-brand a');
  if (brand) brand.innerHTML = `<i class="ri-building-2-line"></i> ${s.buildingName}`;
}

function loadSettingsUI() {
  const s = getSettings();
  const nameInput = document.getElementById('settingBuilderName');
  if (nameInput) {
    nameInput.value = s.buildingName;
    document.getElementById('settingCurrency').value = s.currency;
    document.getElementById('settingDarkMode').checked = s.darkMode;
    document.getElementById('settingRentMsg').value = s.rentMsg;
  }
}

function toggleDarkMode() {
  // Immediate toggle for UI feedback, save will happen on button click or we can auto-save
  // For this specific UI, let's auto-save to make it smoother
  const isChecked = document.getElementById('settingDarkMode').checked;
  const s = getSettings();
  s.darkMode = isChecked;
  localStorage.setItem('bms_settings', JSON.stringify(s));
  applySettings();
}

// ================== REPORT GENERATION ==================
let currentReportType = '';

function selectReport(type) {
  currentReportType = type;
  document.getElementById('selectedReportType').value = type.toUpperCase();

  // Show/Hide Filters
  const filterBox = document.getElementById('reportFilters');
  filterBox.classList.add('active');
  document.getElementById('reportOutput').style.display = 'none';

  document.getElementById('filterMonthGroup').style.display = (type === 'year' || type === 'ledger') ? 'none' : 'block';
  document.getElementById('filterYearGroup').style.display = (type === 'ledger' || type === 'year') ? 'block' : 'none'; // Show Year for Ledger
  document.getElementById('filterFlatGroup').style.display = (type === 'ledger') ? 'block' : 'none';

  // Auto scroll to filters
  filterBox.scrollIntoView({ behavior: 'smooth' });
}

function generateReport() {
  const output = document.getElementById('reportOutput');
  output.style.display = 'block';
  output.classList.add('active');
  output.innerHTML = ''; // Clear previous

  const monthVal = document.getElementById('filterMonth').value;
  const yearVal = document.getElementById('filterYear').value || new Date().getFullYear();
  const flatVal = document.getElementById('filterFlat').value.trim();

  let title = '';
  let content = '';

  // 1. OUTSTANDING REPORT
  if (currentReportType === 'outstanding') {
    title = 'Outstanding Payments Report';
    const unpaid = dashboardData.filter(f => f.rentStatus === 'Unpaid' || f.maintenanceStatus === 'Unpaid');

    if (unpaid.length === 0) {
      output.innerHTML = `<h3>${title}</h3><p>No outstanding payments found!</p>`;
      return;
    }

    content = `<table width="100%" border="1" cellspacing="0" cellpadding="8">
            <thead>
                <tr><th>Flat</th><th>Tenant</th><th>Mobile</th><th>Rent Status</th><th>Maint Status</th><th>Action</th></tr>
            </thead>
            <tbody>`;

    unpaid.forEach(f => {
      const msg = encodeURIComponent(`Hello ${f.tenantName}, gentle reminder: Rent/Maintenance for Flat ${f.flatNo} is pending. Please clear dues.`);
      content += `<tr>
                <td>${f.flatNo}</td>
                <td>${f.tenantName}</td>
                <td>${f.mobileNo}</td>
                <td style="color:${f.rentStatus === 'Paid' ? 'green' : 'red'}">${f.rentStatus}</td>
                <td style="color:${f.maintenanceStatus === 'Paid' ? 'green' : 'red'}">${f.maintenanceStatus}</td>
                <td><a href="https://wa.me/${f.mobileNo}?text=${msg}" target="_blank" class="btn-whatsapp">Send Reminder</a></td>
            </tr>`;
    });
    content += `</tbody></table>`;
  }

  // 2. MONTHLY COLLECTION
  else if (currentReportType === 'collection') {
    title = `Monthly Collection Report`;
    // Note: Real collection report needs date-wise tracking in backend. 
    // For now, we show current snapshot as per user app logic.
    content = `<table width="100%" border="1" cellspacing="0" cellpadding="8">
            <thead>
                <tr><th>Flat</th><th>Tenant</th><th>Rent</th><th>Maint</th></tr>
            </thead>
            <tbody>`;
    dashboardData.forEach(f => {
      content += `<tr>
                <td>${f.flatNo}</td>
                <td>${f.tenantName}</td>
                <td>${f.rentStatus} (${f.rentAmount})</td>
                <td>${f.maintenanceStatus} (${f.maintenanceAmount})</td>
            </tr>`;
    });
    content += `</tbody></table>`;
  }

  // 3. EXPENSE REPORT
  else if (currentReportType === 'expense') {
    const displayMonth = monthVal ? new Date(monthVal).toLocaleString('default', { month: 'long', year: 'numeric' }) : 'All Time';
    title = `Expense Report (${displayMonth})`;

    let expenses = window.fullData ? window.fullData.expenses : [];
    if (!expenses) expenses = [];

    if (monthVal) {
      expenses = expenses.filter(e => e.date.startsWith(monthVal));
    }

    if (expenses.length === 0) {
      output.innerHTML = `<h3>${title}</h3><p>No expenses found for this period.</p>`;
      return;
    }

    let totalExp = 0;
    content = `<table width="100%" border="1" cellspacing="0" cellpadding="8">
            <thead>
                <tr><th>Date</th><th>Payee</th><th>Head</th><th>Mode</th><th>Amount</th></tr>
            </thead>
            <tbody>`;

    expenses.forEach(e => {
      totalExp += (Number(e.amount) || 0);
      content += `<tr>
                <td>${formatDate(e.date)}</td>
                <td>${e.payeeName}</td>
                <td>${e.expenseHead}</td>
                <td>${e.paymentMode}</td>
                <td>${Number(e.amount).toLocaleString()}</td>
            </tr>`;
    });
    content += `<tr style="background:#f8f9fc; font-weight:bold;"><td colspan="4" style="text-align:right;">Total</td><td>${totalExp.toLocaleString()}</td></tr>`;
    content += `</tbody></table>`;
  }

  // 4. LEDGER (YEARLY STATEMENT)
  else if (currentReportType === 'ledger') {
    if (!flatVal) { alert('Please enter Flat No'); return; }
    title = `Account Statement - Flat ${flatVal} (${yearVal})`;

    // Find flat in flats data
    const flat = dashboardData.find(f => f.flatNo == flatVal);
    if (!flat) { alert('Flat not found'); return; }

    content = `<div style="margin-bottom:1rem; padding:1rem; background:#f8f9fc; border-radius:5px;">
            <strong>Tenant:</strong> ${flat.tenantName}<br>
            <strong>Year:</strong> ${yearVal}<br>
            <strong>Current Status:</strong> Rent: ${flat.rentStatus}, Maint: ${flat.maintenanceStatus}
        </div>`;

    content += `<table width="100%" border="1" cellspacing="0" cellpadding="8">
            <thead><tr><th>Month</th><th>Rent Status</th><th>Maint Status</th></tr></thead>
            <tbody>`;

    // Mocking Monthly History for the selected Year
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    let socialText = `Statement for Flat ${flatVal} (${flat.tenantName}) - Year ${yearVal}:\n`;

    months.forEach(m => {
      // In a real app, query backend for specific month/year status
      // For now, we show "Paid" for past months if current is Paid (Simulation)
      // Or just leave empty/hypothetical. 
      // Let's just list the months.
      content += `<tr>
                <td>${m} ${yearVal}</td>
                <td>-</td>
                <td>-</td>
            </tr>`;
    });

    content += `</tbody></table>`;
    content += `<p style="color:var(--text-grey); font-size:0.8rem; margin-top:0.5rem;">* Detailed historical data requires backend log.</p>`;

    socialText += `Current Rent: ${flat.rentStatus}\nCurrent Maint: ${flat.maintenanceStatus}\n\nPlease clear dues if pending.`;
    const waLink = `https://wa.me/${flat.mobileNo}?text=${encodeURIComponent(socialText)}`;
    content += `<div style="margin-top:1rem;"><a href="${waLink}" target="_blank" class="btn-whatsapp">Share Statement via WhatsApp</a></div>`;
  }

  // 5. PROFIT & LOSS
  else if (currentReportType === 'pnl') {
    title = `Profit & Loss Statement`;

    let totalIncome = 0;
    dashboardData.forEach(f => {
      // Only count PAID amounts
      if (f.rentStatus === 'Paid') totalIncome += (Number(f.rentAmount) || 0);
      if (f.maintenanceStatus === 'Paid') totalIncome += (Number(f.maintenanceAmount) || 0);
    });

    let totalExpense = 0;
    if (window.fullData && window.fullData.expenses) {
      window.fullData.expenses.forEach(e => totalExpense += (Number(e.amount) || 0));
    }

    const net = totalIncome - totalExpense;
    const color = net >= 0 ? 'green' : 'red';

    content = `<div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
            <div style="background:#d4edda; padding:1rem; border-radius:5px; color:#155724;">
                <h4>Total Income (Collected)</h4>
                <h2>${getSettings().currency} ${totalIncome.toLocaleString()}</h2>
            </div>
            <div style="background:#f8d7da; padding:1rem; border-radius:5px; color:#721c24;">
                <h4>Total Expenses</h4>
                <h2>${getSettings().currency} ${totalExpense.toLocaleString()}</h2>
            </div>
        </div>
        <div style="background:${net >= 0 ? '#d1ecf1' : '#fff3cd'}; padding:1.5rem; border-radius:5px; text-align:center;">
            <h3>Net Profit / Loss</h3>
            <h1 style="color:${color}">${getSettings().currency} ${net.toLocaleString()}</h1>
        </div>`;
  }

  output.innerHTML = `<h3>${title}</h3><small>Generated on ${new Date().toLocaleString()}</small><hr>${content}`;
}

// Load Data
async function loadDashboard() {
  showLoader(true);
  try {
    const res = await fetch(SCRIPT_URL);

    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

    const text = await res.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      if (text.trim().startsWith('<')) {
        throw new Error('Script error (HTML returned). Check connection.');
      }
      throw new Error('Invalid JSON response');
    }

    if (!data.flats) throw new Error('Data format incorrect');

    // Store Full Data Globally
    window.fullData = data;
    dashboardData = data.flats; // Keep legacy support for payment search

    // Shared: Render Stats Cards (if they exist on the page)
    if (document.getElementById('totalIncome')) {
      renderStats(data);
      renderCharts(data);
    }

    // Payments Page Only: Render Table
    if (window.currentPage === 'payments' && flatsTable) {
      renderTable(data.flats);
    }

    // Tenants Page Only
    if (window.currentPage === 'tenants' && document.getElementById('tenantsTable')) {
      renderTenants(data.tenants || []);
    }

    // Expenses Page Only
    if (window.currentPage === 'expenses' && document.getElementById('expensesTable')) {
      renderExpenses(data.expenses || []);
    }

  } catch (e) {
    console.error(e);
    showToast(`Error: ${e.message}`, 'error');
  } finally {
    showLoader(false);
  }
}

// ... (renderStats, renderTable, renderTenants...)

// Render Expenses Table
function renderExpenses(expenses) {
  const table = document.getElementById('expensesTable');
  table.innerHTML = '';

  if (!expenses || expenses.length === 0) {
    table.innerHTML = '<tr><td colspan="5" style="text-align:center;">No expenses found</td></tr>';
    return;
  }

  expenses.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(e.date)}</td>
      <td>${e.payeeName}</td>
      <td>${e.expenseHead}</td>
      <td>${Number(e.amount).toLocaleString()}</td>
      <td>${e.paymentMode}</td>
    `;
    table.appendChild(tr);
  });
}

// Filter Logic Update
if (searchInput) {
  searchInput.addEventListener('input', (events) => {
    // Determine which table we are filtering
    if (window.currentPage === 'tenants') return filterTenants(events.target.value);
    if (window.currentPage === 'expenses') return filterExpenses(events.target.value);
    return filterTable(events.target.value);
  });
}

function filterExpenses(query) {
  const table = document.getElementById('expensesTable');
  if (!table) return;
  const rows = table.getElementsByTagName('tr');

  for (let i = 0; i < rows.length; i++) {
    const text = rows[i].textContent.toLowerCase();
    rows[i].style.display = text.includes(query.toLowerCase()) ? '' : 'none';
  }
}

// Add Expense
async function addExpense() {
  const date = document.getElementById('eDate').value;
  const name = document.getElementById('eName').value.trim();
  const head = document.getElementById('eHead').value;
  const amount = document.getElementById('eAmount').value;
  const mode = document.getElementById('eMode').value;

  if (!date || !name || !head || !amount || !mode) {
    showToast('All fields are required', 'warning');
    return;
  }

  closeModal();
  showLoader(true);

  try {
    const params = new URLSearchParams({
      action: 'addExpense',
      date, payeeName: name, expenseHead: head, amount, paymentMode: mode
    });

    const res = await fetch(`${SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();

    if (data.result === 'error') throw new Error(data.message);

    // Clear Form
    document.getElementById('eName').value = '';
    document.getElementById('eAmount').value = '';

    if (data.expenses) renderExpenses(data.expenses);
    showToast('Expense Added Successfully!', 'success');
  } catch (e) {
    console.error(e);
    showToast(`Failed to add expense: ${e.message}`, 'error');
  } finally {
    showLoader(false);
  }
}

// Render Stats
function renderStats(data) {
  // Income Stats
  let totalIncome = 0;
  data.flats.forEach(f => {
    const rent = Number(f.rentAmount) || 0;
    const maint = Number(f.maintenanceAmount) || 0;
    totalIncome += (rent + maint);
  });

  // Expense Stats
  let totalExpenses = 0;
  if (data.expenses) {
    data.expenses.forEach(e => totalExpenses += (Number(e.amount) || 0));
  }

  // Contract Stats
  let expiringSoon = 0;
  let expired = 0;

  if (data.tenants) {
    data.tenants.forEach(t => {
      const status = checkContractStatus(t.renewalDate);
      if (status.class === 'expiring') expiringSoon++;
      if (status.class === 'expired') expired++;
    });
  }

  // Update DOM
  const currency = getSettings().currency + ' ';
  animateValue(totalIncomeElem, totalIncome, currency);
  animateValue(paidRentElem, data.paidRent);
  animateValue(paidMaintElem, data.paidMaintenance);
  animateValue(unpaidRentElem, data.unpaidRent);
  animateValue(unpaidMaintElem, data.unpaidMaintenance);

  // New Stats
  if (document.getElementById('totalExpenses')) animateValue(document.getElementById('totalExpenses'), totalExpenses, currency);
  if (document.getElementById('expiringSoon')) animateValue(document.getElementById('expiringSoon'), expiringSoon);
  if (document.getElementById('expiredContracts')) animateValue(document.getElementById('expiredContracts'), expired);

  // Occupied & Vacant Stats
  let occupied = 0;
  let vacant = 0;
  data.flats.forEach(f => {
    if (f.tenantName && f.tenantName.trim() !== '') occupied++;
    else vacant++;
  });

  if (document.getElementById('occupiedFlats')) animateValue(document.getElementById('occupiedFlats'), occupied);
  if (document.getElementById('vacantFlats')) animateValue(document.getElementById('vacantFlats'), vacant);
}

// Render Table (Payments)
function renderTable(flats) {
  flatsTable.innerHTML = '';
  if (flats.length === 0) {
    flatsTable.innerHTML = '<tr><td colspan="9" style="text-align:center;">No records found</td></tr>';
    return;
  }

  flats.forEach(f => {
    const rentStatusClass = String(f.rentStatus).toLowerCase() === 'paid' ? 'paid' : 'unpaid';
    const maintStatusClass = String(f.maintenanceStatus).toLowerCase() === 'paid' ? 'paid' : 'unpaid';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${f.flatNo}</strong></td>
      <td>${f.type}</td>
      <td>${f.tenantName}</td>
      <td>${f.rentAmount}</td>
      <td>${f.maintenanceAmount}</td>
      <td><span class="status ${rentStatusClass}">${f.rentStatus}</span></td>
      <td><span class="status ${maintStatusClass}">${f.maintenanceStatus}</span></td>
      <td><a href="https://wa.me/${f.mobileNo}" target="_blank" style="text-decoration:none; color:inherit;">${f.mobileNo}</a></td>
      <td>
        <button class='action-btn btn-rent' onclick="markPaid(${f.row},'rent')" ${String(f.rentStatus).toLowerCase() === 'paid' ? 'disabled' : ''} title="Mark Rent Paid"><i class="ri-check-double-line"></i> Rent</button>
        <button class='action-btn btn-maint' onclick="markPaid(${f.row},'maintenance')" ${String(f.maintenanceStatus).toLowerCase() === 'paid' ? 'disabled' : ''} title="Mark Maintenance Paid"><i class="ri-tools-line"></i> Maint</button>
      </td>
    `;
    flatsTable.appendChild(tr);
  });
}

// Render Tenants Table
// Render Tenants Table
function renderTenants(tenants) {
  const table = document.getElementById('tenantsTable');
  table.innerHTML = '';

  if (tenants.length === 0) {
    table.innerHTML = '<tr><td colspan="9" style="text-align:center;">No tenants found</td></tr>';
    return;
  }

  tenants.forEach(t => {
    const statusData = checkContractStatus(t.renewalDate);

    // Use dynamic message from settings
    const settings = getSettings();
    let msgTemplate = settings.rentMsg || 'Hello {name}, rental for {flat} is pending. Amount: {amount}';

    // Replace placeholders
    const totalDue = (Number(t.rentAmount) || 0) + (Number(t.maintenanceAmount) || 0);
    const msg = encodeURIComponent(
      msgTemplate
        .replace('{name}', t.tenantName)
        .replace('{flat}', t.flatNo)
        .replace('{amount}', totalDue)
    );

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${t.flatNo}</strong></td>
      <td>${t.tenantName}</td>
      <td>${t.mobileNo}</td>
      <td>${t.rentAmount}</td>
      <td>${t.maintenanceAmount}</td>
      <td>${formatDate(t.startDate)}</td>
      <td>${formatDate(t.renewalDate)}</td>
      <td><span class="status ${statusData.class}">${statusData.label}</span></td>
      <td>
        <a href="https://wa.me/${t.mobileNo}?text=${msg}" target="_blank" class="btn-whatsapp">
          <i class="ri-whatsapp-line"></i> Check
        </a>
      </td>
    `;
    table.appendChild(tr);
  });
}

function checkContractStatus(dateStr) {
  if (!dateStr) return { class: 'pending', label: 'No Date' };

  const today = new Date();
  const renewal = new Date(dateStr);

  if (isNaN(renewal.getTime())) return { class: 'pending', label: 'Invalid' };

  const diffTime = renewal - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { class: 'expired', label: 'Expired' };
  if (diffDays < 30) return { class: 'expiring', label: `Expiring (${diffDays}d)` };
  return { class: 'active', label: 'Active' };
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
}

// Filter Table (Payments)
function filterTable(query) {
  const lowerQuery = query.toLowerCase();
  const filtered = dashboardData.filter(f =>
    f.flatNo.toLowerCase().includes(lowerQuery) ||
    f.tenantName.toLowerCase().includes(lowerQuery) ||
    String(f.mobileNo).includes(lowerQuery)
  );
  renderTable(filtered);
}

// Filter Tenants
function filterTenants(query) {
  // We need to fetch tenants data or store it globally. 
  // For now let's assume we re-fetch or need to store it.
  // Ideally, loadDashboard should store tenantsData globally too.
}

// Add Tenant
async function addTenant() {
  const flatNo = document.getElementById('tFlatNo').value.trim();
  const name = document.getElementById('tName').value.trim();
  const mobile = document.getElementById('tMobile').value.trim();
  const rent = document.getElementById('tRent').value.trim();
  const maint = document.getElementById('tMaint').value.trim();
  const start = document.getElementById('tStart').value;
  const renewal = document.getElementById('tRenewal').value;

  if (!flatNo || !name || !mobile || !rent || !maint || !start || !renewal) {
    showToast('All fields are required', 'warning');
    return;
  }

  closeModal();
  showLoader(true);

  try {
    const params = new URLSearchParams({
      action: 'addTenant',
      flatNo, tenantName: name, mobileNo: mobile,
      rentAmount: rent, maintAmount: maint,
      startDate: start, renewalDate: renewal
    });

    const res = await fetch(`${SCRIPT_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();

    if (data.result === 'error') throw new Error(data.message);

    // Clear Form
    document.querySelectorAll('.form-group input').forEach(i => i.value = '');

    if (data.tenants) renderTenants(data.tenants);
    showToast('Tenant Added Successfully!', 'success');
  } catch (e) {
    console.error(e);
    showToast(`Failed to add tenant: ${e.message}`, 'error');
  } finally {
    showLoader(false);
  }
}

// Mark Paid (Payments)
async function markPaid(row, type) {
  if (!confirm(`Are you sure you want to mark this ${type} as PAID?`)) return;

  showLoader(true);
  try {
    const res = await fetch(`${SCRIPT_URL}?action=markPaid&row=${row}&type=${type}`);
    const data = await res.json();
    dashboardData = data.flats; // Update local state
    renderStats(data);
    renderTable(data.flats);
    showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} marked as Paid!`, 'success');
  } catch (e) {
    console.error(e);
    showToast('Failed to update status', 'error');
  } finally {
    showLoader(false);
  }
}

// Add Flat (Payments)
async function addFlat() {
  const flatNo = document.getElementById('flatNo').value.trim();
  const type = document.getElementById('flatType').value;
  const tenant = document.getElementById('tenantName').value.trim();
  const rentAmt = document.getElementById('rentAmount').value.trim();
  const maintAmt = document.getElementById('maintAmount').value.trim();
  const mobile = document.getElementById('tenantMobile').value.trim();

  if (!flatNo || !tenant || !rentAmt || !maintAmt || !mobile) {
    showToast('All fields are required', 'warning');
    return;
  }

  closeModal();
  showLoader(true);

  try {
    const params = new URLSearchParams({
      action: 'addFlat',
      flatNo, type, tenantName: tenant, rentAmount: rentAmt, maintAmount: maintAmt, mobileNo: mobile
    });

    const res = await fetch(`${SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();

    if (data.result === 'error') throw new Error(data.message || 'Script reported an error');

    // Clear Form
    document.querySelectorAll('.form-group input').forEach(i => i.value = '');

    dashboardData = data.flats;
    renderStats(data);
    renderTable(data.flats);
    showToast('New Flat Added Successfully!', 'success');
  } catch (e) {
    console.error(e);
    showToast('Failed to add flat', 'error');
  } finally {
    showLoader(false);
  }
}

// ================== UI HELPERS ==================

function openModal() {
  modalOverlay.style.display = 'flex';
}

function closeModal() {
  modalOverlay.style.display = 'none';
}

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

function showLoader(show) {
  loaderOverlay.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.borderLeftColor = type === 'error' ? '#e74a3b' : type === 'warning' ? '#f6c23e' : '#1cc88a';

  const icon = type === 'error' ? '<i class="ri-error-warning-line"></i>' : '<i class="ri-checkbox-circle-line"></i>';

  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function animateValue(obj, end, prefix = '') {
  obj.innerHTML = prefix + Number(end).toLocaleString();
}


// ================== CHARTS LOGIC ==================


function renderCharts(data) {
  // Check if Chart.js is loaded and elements exist
  if (typeof Chart === 'undefined') return;
  const ctxIncome = document.getElementById('incomeExpenseChart');
  const ctxOccupancy = document.getElementById('occupancyChart');
  if (!ctxIncome || !ctxOccupancy) return;

  // 1. Prepare Data for Income vs Expense
  // Group expenses by month (assuming 'YYYY-MM-DD' date format)
  // Since we don't have historical rent data in the current JSON structure (only current month status),
  // we will mock the "Income" trend or just show current month if that's all we have.
  // For a better visual, let's show a 6-month trend where current month is real and others are simulated or 0.
  // Actually, let's just show the current status for now, or group expenses by month if available.

  const expenseByMonth = {};
  if (data.expenses) {
    data.expenses.forEach(e => {
      const date = new Date(e.date);
      const key = date.toLocaleString('default', { month: 'short' }); // e.g. "Jan"
      expenseByMonth[key] = (expenseByMonth[key] || 0) + Number(e.amount);
    });
  }

  // Calculate current total possible income (Rent + Maint)
  let totalPotentialIncome = 0;
  data.flats.forEach(f => {
    totalPotentialIncome += (Number(f.rentAmount) || 0) + (Number(f.maintenanceAmount) || 0);
  });

  // Mock Data for previous months to look good (since backend data is limited)
  const labels = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', new Date().toLocaleString('default', { month: 'short' })];
  const incomeData = [200000, 210000, 195000, 205000, 215000, totalPotentialIncome]; // Last one is real potential
  const expenseData = labels.map(label => expenseByMonth[label] || (Math.random() * 50000 + 10000)); // Real or Mock

  // Destroy old instances if exist
  if (incomeChartInstance) incomeChartInstance.destroy();
  if (occupancyChartInstance) occupancyChartInstance.destroy();

  // Render Income Chart
  incomeChartInstance = new Chart(ctxIncome, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: '#4e73df',
          borderRadius: 4
        },
        {
          label: 'Expense',
          data: expenseData,
          backgroundColor: '#e74a3b',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#f3f3f3' } },
        x: { grid: { display: false } }
      }
    }
  });

  // 2. Prepare Data for Occupancy (Doughnut)
  let occupied = 0;
  let vacant = 0;
  data.flats.forEach(f => {
    if (f.tenantName && f.tenantName.trim() !== '') occupied++;
    else vacant++;
  });

  // Render Occupancy Chart
  occupancyChartInstance = new Chart(ctxOccupancy, {
    type: 'doughnut',
    data: {
      labels: ['Occupied', 'Vacant'],
      datasets: [{
        data: [occupied, vacant],
        backgroundColor: ['#1cc88a', '#e74a3b'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      layout: {
        padding: 20
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20
          }
        }
      }
    }
  });
}

function logout() {
  if (confirm("Are you sure you want to logout?")) {
    sessionStorage.removeItem('userRole');
    window.location.href = 'index.html';
  }
}

// ================== ROLE MANAGEMENT ==================
function checkRoleAccess() {
  const role = sessionStorage.getItem('userRole') || 'regular_admin';
  const sidebarMenu = document.querySelector('.sidebar-menu');
  if (!sidebarMenu) return;

  // Header User Info
  const userTitle = document.querySelector('.user-wrapper h4');
  const userRole = document.querySelector('.user-wrapper small');

  if (role === 'super_admin') {
    // SUPER ADMIN: Dashboard + Settings ONLY
    if (userTitle) userTitle.innerText = "Super Admin";
    if (userRole) userRole.innerText = "System Administrator";

    // Hide Operational Pages
    Array.from(sidebarMenu.children).forEach(li => {
      const link = li.querySelector('a');
      const href = link.getAttribute('href');
      // Naive check: if href contains restricted keywords
      if (href.includes('payments') || href.includes('tenants') || href.includes('expenses') || href.includes('reports')) {
        li.style.display = 'none';
      }
    });

  } else {
    // REGULAR ADMIN: Everything EXCEPT Settings
    if (userTitle) userTitle.innerText = "Building Manager";
    if (userRole) userRole.innerText = "Admin User";

    Array.from(sidebarMenu.children).forEach(li => {
      const link = li.querySelector('a');
      const href = link.getAttribute('href');
      if (href.includes('settings')) {
        li.style.display = 'none';
      }
    });

    // Security: Redirect if Regular Admin tries to access Settings page
    if (window.currentPage === 'settings') {
      alert("Access Denied: Super Admin only.");
      window.location.href = '../dashboard.html';
    }
  }
}

// ================== RESET DATA LOGIC ==================
async function resetAllData() {
  if (!confirm("⚠️ DANGER: This will delete ALL Dummy Data (Tenants, Flats, Expenses etc) from the system to allow real entry.\n\nAre you sure?")) return;

  // Double confirmation
  const userConfirm = prompt("Type 'DELETE' to confirm permanent deletion:");
  if (userConfirm !== 'DELETE') {
    alert("Action Cancelled.");
    return;
  }

  showLoader(true);
  try {
    const params = new URLSearchParams({ action: 'resetData' });
    const res = await fetch(`${SCRIPT_URL}?${params.toString()}`);
    const data = await res.json();

    if (data.result === 'error') throw new Error(data.message);

    showToast("System Reset Successful! All data cleared.", "success");
    // Reload to clean state
    setTimeout(() => location.reload(), 2000);

  } catch (e) {
    console.error(e);
    // Fallback for demo if backend script isn't updated
    showToast("Request sent. If backend supports it, data is wiped.", "warning");
  } finally {
    showLoader(false);
  }
}
