// Хранилище ссылок на экземпляры Chart для корректного уничтожения перед пересозданием
const chartInstances = {
    consumption: null,
    movements: null,
    stock: null
};

export function initCharts(consumptionData, movementTypesData, stockByCategoryData) {
    // Уничтожаем старые экземпляры, если они есть — Chart.js не позволяет рисовать на занятом canvas
    if (chartInstances.consumption) chartInstances.consumption.destroy();
    if (chartInstances.movements) chartInstances.movements.destroy();
    if (chartInstances.stock) chartInstances.stock.destroy();

    const ctxConsumption = document.getElementById('chart-consumption');
    if (ctxConsumption) {
        chartInstances.consumption = new Chart(ctxConsumption, {
            type: 'line',
            data: {
                labels: consumptionData.labels,
                datasets: [{
                    label: 'Расход сырья (кг)',
                    data: consumptionData.values,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.3,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    const ctxMovements = document.getElementById('chart-movements');
    if (ctxMovements) {
        chartInstances.movements = new Chart(ctxMovements, {
            type: 'doughnut',
            data: {
                labels: movementTypesData.labels,
                datasets: [{
                    data: movementTypesData.values,
                    backgroundColor: ['rgb(54, 162, 235)', 'rgb(255, 99, 132)', 'rgb(255, 205, 86)']
                }]
            },
            options: { responsive: true }
        });
    }

    const ctxStock = document.getElementById('chart-stock');
    if (ctxStock) {
        chartInstances.stock = new Chart(ctxStock, {
            type: 'bar',
            data: {
                labels: stockByCategoryData.labels,
                datasets: [{
                    label: 'Текущий остаток (ед.)',
                    data: stockByCategoryData.values,
                    backgroundColor: 'rgba(153, 102, 255, 0.7)'
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        });
    }
}