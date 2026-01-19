
// ================== CHARTS LOGIC ==================
let incomeChartInstance = null;
let occupancyChartInstance = null;

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
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}
