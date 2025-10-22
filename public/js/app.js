// Main application logic
let currentStatements = [];
let parsedResult = null;

// DOM elements
const connectBtn = document.getElementById('connect-btn');
const fetchBtn = document.getElementById('fetch-btn');
const parseBtn = document.getElementById('parse-btn');
const resetViewBtn = document.getElementById('reset-view-btn');
const exportBtn = document.getElementById('export-btn');

const connectionStatus = document.getElementById('connection-status');
const fetchStatus = document.getElementById('fetch-status');
const parseStatus = document.getElementById('parse-status');

const tableSection = document.getElementById('table-section');
const statementsSection = document.getElementById('statements-section');
const visualizationSection = document.getElementById('visualization-section');
const detailsSection = document.getElementById('details-section');

const sourceTableSelect = document.getElementById('source-table');
const statementsDisplay = document.getElementById('statements-display');
const statementsInfo = document.getElementById('statements-info');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    Visualizer.init('network-graph');
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    connectBtn.addEventListener('click', handleConnect);
    fetchBtn.addEventListener('click', handleFetchStatements);
    parseBtn.addEventListener('click', handleParseStatements);
    resetViewBtn.addEventListener('click', () => Visualizer.resetView());
    exportBtn.addEventListener('click', () => Visualizer.exportData());

    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });
}

// Handle database connection
async function handleConnect() {
    const credentials = {
        host: document.getElementById('host').value,
        user: document.getElementById('user').value,
        password: document.getElementById('password').value,
        database: document.getElementById('database').value
    };

    if (!credentials.user || !credentials.database) {
        showStatus(connectionStatus, 'error', 'Please fill in user and database fields');
        return;
    }

    connectBtn.disabled = true;
    connectBtn.innerHTML = 'Connecting... <span class="spinner"></span>';

    const result = await API.connect(credentials);

    connectBtn.disabled = false;
    connectBtn.innerHTML = 'Connect';

    if (result.success) {
        showStatus(connectionStatus, 'success', result.message);
        await loadTables();
        tableSection.style.display = 'block';
    } else {
        showStatus(connectionStatus, 'error', `Connection failed: ${result.error}`);
    }
}

// Load available tables
async function loadTables() {
    const result = await API.getTables();

    if (result.success) {
        sourceTableSelect.innerHTML = '<option value="">-- Select a table --</option>';
        result.tables.forEach(table => {
            const option = document.createElement('option');
            option.value = table;
            option.textContent = table;
            sourceTableSelect.appendChild(option);
        });
    } else {
        showStatus(fetchStatus, 'error', `Failed to load tables: ${result.error}`);
    }
}

// Handle fetch statements
async function handleFetchStatements() {
    const tableName = sourceTableSelect.value;
    const columnName = document.getElementById('column-name').value;

    if (!tableName || !columnName) {
        showStatus(fetchStatus, 'error', 'Please select a table and specify column name');
        return;
    }

    fetchBtn.disabled = true;
    fetchBtn.innerHTML = 'Fetching... <span class="spinner"></span>';

    const result = await API.getStatements(tableName, columnName);

    fetchBtn.disabled = false;
    fetchBtn.innerHTML = 'Fetch Statements';

    if (result.success) {
        currentStatements = result.statements;
        showStatus(fetchStatus, 'success', `Found ${result.count} SQL statements`);
        displayStatements(result.statements);
        statementsSection.style.display = 'block';
    } else {
        showStatus(fetchStatus, 'error', `Failed to fetch statements: ${result.error}`);
    }
}

// Display SQL statements
function displayStatements(statements) {
    statementsInfo.innerHTML = `Found <strong>${statements.length}</strong> SQL statement(s)`;
    statementsDisplay.value = statements.join('\n\n---\n\n');
}

// Handle parse statements
async function handleParseStatements() {
    if (currentStatements.length === 0) {
        showStatus(parseStatus, 'error', 'No statements to parse');
        return;
    }

    parseBtn.disabled = true;
    parseBtn.innerHTML = 'Parsing... <span class="spinner"></span>';

    const result = await API.parseStatements(currentStatements);

    parseBtn.disabled = false;
    parseBtn.innerHTML = 'Parse & Visualize';

    if (result.success) {
        parsedResult = result;
        showStatus(
            parseStatus,
            'success',
            `Parsed ${result.totalParsed} statements successfully. ${result.totalErrors} errors.`
        );

        // Visualize
        Visualizer.visualize(result.data);
        visualizationSection.style.display = 'block';

        // Show details
        displayDetails(result);
        detailsSection.style.display = 'block';
    } else {
        showStatus(parseStatus, 'error', `Parsing failed: ${result.error}`);
    }
}

// Display parsed details
function displayDetails(result) {
    // Tables tab
    const tablesContent = document.getElementById('tab-tables');
    const tablesMap = new Map();

    result.data.forEach(statement => {
        statement.tables.forEach(table => {
            if (!tablesMap.has(table.name)) {
                tablesMap.set(table.name, {
                    name: table.name,
                    alias: table.alias,
                    columns: new Set(),
                    occurrences: 0
                });
            }
            tablesMap.get(table.name).occurrences++;

            statement.columns.forEach(col => {
                if (col.table === table.name || statement.tables.length === 1) {
                    tablesMap.get(table.name).columns.add(col.name);
                }
            });
        });
    });

    let tablesHTML = '<table class="details-table">';
    tablesHTML += '<thead><tr><th>Table Name</th><th>Columns</th><th>Occurrences</th></tr></thead>';
    tablesHTML += '<tbody>';

    tablesMap.forEach((tableData, tableName) => {
        const columns = Array.from(tableData.columns).join(', ') || 'N/A';
        tablesHTML += `
            <tr>
                <td><strong>${tableName}</strong></td>
                <td><code>${columns}</code></td>
                <td>${tableData.occurrences}</td>
            </tr>
        `;
    });

    tablesHTML += '</tbody></table>';
    tablesContent.innerHTML = tablesHTML || '<div class="no-data">No tables found</div>';

    // JOINs tab
    const joinsContent = document.getElementById('tab-joins');
    const joins = [];

    result.data.forEach((statement, index) => {
        statement.joins.forEach(join => {
            joins.push({
                index: index + 1,
                type: join.type,
                table: join.table.name,
                condition: join.condition
            });
        });
    });

    if (joins.length > 0) {
        let joinsHTML = '<table class="details-table">';
        joinsHTML += '<thead><tr><th>Statement #</th><th>JOIN Type</th><th>Table</th><th>Condition</th></tr></thead>';
        joinsHTML += '<tbody>';

        joins.forEach(join => {
            let condition = 'N/A';
            if (join.condition) {
                const left = join.condition.left?.column || JSON.stringify(join.condition.left);
                const right = join.condition.right?.column || JSON.stringify(join.condition.right);
                condition = `${left} ${join.condition.operator || '='} ${right}`;
            }

            joinsHTML += `
                <tr>
                    <td>${join.index}</td>
                    <td><strong>${join.type}</strong></td>
                    <td><code>${join.table}</code></td>
                    <td>${condition}</td>
                </tr>
            `;
        });

        joinsHTML += '</tbody></table>';
        joinsContent.innerHTML = joinsHTML;
    } else {
        joinsContent.innerHTML = '<div class="no-data">No JOINs found</div>';
    }

    // WHERE conditions tab
    const conditionsContent = document.getElementById('tab-conditions');
    const conditions = [];

    result.data.forEach((statement, index) => {
        statement.whereConditions.forEach(condition => {
            conditions.push({
                index: index + 1,
                table: statement.tables[0]?.name || 'Unknown',
                condition: condition
            });
        });
    });

    if (conditions.length > 0) {
        let conditionsHTML = '<table class="details-table">';
        conditionsHTML += '<thead><tr><th>Statement #</th><th>Table</th><th>Condition</th></tr></thead>';
        conditionsHTML += '<tbody>';

        conditions.forEach(item => {
            const left = item.condition.left?.column || JSON.stringify(item.condition.left);
            const right = item.condition.right?.value || item.condition.right?.column || JSON.stringify(item.condition.right);
            const conditionStr = `${left} ${item.condition.operator} ${right}`;

            conditionsHTML += `
                <tr>
                    <td>${item.index}</td>
                    <td><code>${item.table}</code></td>
                    <td><strong>${conditionStr}</strong></td>
                </tr>
            `;
        });

        conditionsHTML += '</tbody></table>';
        conditionsContent.innerHTML = conditionsHTML;
    } else {
        conditionsContent.innerHTML = '<div class="no-data">No WHERE conditions found</div>';
    }

    // Errors tab
    const errorsContent = document.getElementById('tab-errors');

    if (result.errors && result.errors.length > 0) {
        let errorsHTML = '<ul class="error-list">';

        result.errors.forEach(error => {
            errorsHTML += `
                <li>
                    <strong>Statement #${error.index + 1}</strong>: ${error.error}
                    <div class="error-statement">${error.statement}</div>
                </li>
            `;
        });

        errorsHTML += '</ul>';
        errorsContent.innerHTML = errorsHTML;
    } else {
        errorsContent.innerHTML = '<div class="no-data">No errors</div>';
    }
}

// Switch tabs
function switchTab(tabName) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `tab-${tabName}`) {
            pane.classList.add('active');
        }
    });
}

// Show status message
function showStatus(element, type, message) {
    element.className = `status-message ${type}`;
    element.textContent = message;
    element.style.display = 'block';

    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}
