// Main application logic
let currentStatements = [];
let currentStatementsWithIds = [];
let parsedResult = null;
let selectedConditions = {};

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
const rewriterSection = document.getElementById('rewriter-section');

const sourceTableSelect = document.getElementById('source-table');
const statementsDisplay = document.getElementById('statements-display');
const statementsInfo = document.getElementById('statements-info');

// Rewriter elements
const previewRewriteBtn = document.getElementById('preview-rewrite-btn');
const applyRewriteBtn = document.getElementById('apply-rewrite-btn');
const cancelRewriteBtn = document.getElementById('cancel-rewrite-btn');
const rewriteStatus = document.getElementById('rewrite-status');
const previewSection = document.getElementById('preview-section');

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

    // Rewriter event listeners
    previewRewriteBtn.addEventListener('click', handlePreviewRewrite);
    applyRewriteBtn.addEventListener('click', handleApplyRewrite);
    cancelRewriteBtn.addEventListener('click', handleCancelRewrite);

    // Database type change listener
    const dbTypeSelect = document.getElementById('db-type');
    const portInput = document.getElementById('port');
    dbTypeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'mysql') {
            portInput.value = '3306';
        } else if (e.target.value === 'mssql') {
            portInput.value = '1433';
        }
    });

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
        type: document.getElementById('db-type').value,
        host: document.getElementById('host').value,
        port: document.getElementById('port').value,
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

        // Fetch statements with IDs for rewriter
        await fetchStatementsWithIds();

        // Show rewriter section
        displayRewriterSection(result);
        rewriterSection.style.display = 'block';
    } else {
        showStatus(parseStatus, 'error', `Parsing failed: ${result.error}`);
    }
}

// Fetch statements with IDs
async function fetchStatementsWithIds() {
    const tableName = sourceTableSelect.value;
    const columnName = document.getElementById('column-name').value;

    const result = await API.getStatementsWithIds(tableName, columnName);

    if (result.success) {
        currentStatementsWithIds = result.statements;
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

// Display rewriter section
function displayRewriterSection(result) {
    const conditionSelector = document.getElementById('condition-selector');
    selectedConditions = {};

    // Group conditions by table
    const tableConditionsMap = new Map();

    result.data.forEach((statement, index) => {
        // Create alias to table name mapping for this statement
        const aliasMap = {};
        statement.tables.forEach(table => {
            if (table.alias) {
                aliasMap[table.alias] = table.name;
            }
            // Also map the table name to itself
            aliasMap[table.name] = table.name;
        });

        statement.whereConditions.forEach(condition => {
            // Determine which table this condition applies to
            const aliasOrTableName = condition.left?.table || statement.tables[0]?.name || 'unknown';

            // Map alias to actual table name
            const tableName = aliasMap[aliasOrTableName] || aliasOrTableName;

            if (!tableConditionsMap.has(tableName)) {
                tableConditionsMap.set(tableName, []);
            }

            // Format the condition
            const conditionStr = SQLRewriter.formatCondition(condition);

            // Check if this condition already exists
            const existing = tableConditionsMap.get(tableName).find(c => c.condition === conditionStr);
            if (existing) {
                existing.count++;
            } else {
                tableConditionsMap.get(tableName).push({
                    condition: conditionStr,
                    conditionObj: condition,
                    count: 1
                });
            }
        });
    });

    // Build UI
    let html = '';

    if (tableConditionsMap.size === 0) {
        html = '<div class="no-data">No WHERE conditions found in the statements</div>';
    } else {
        tableConditionsMap.forEach((conditions, tableName) => {
            html += `
                <div class="table-condition-group">
                    <h4>Table: ${tableName}</h4>
            `;

            conditions.forEach((item, index) => {
                const checkboxId = `cond-${tableName}-${index}`;
                // Escape the condition for HTML attribute storage
                const escapedCondition = item.condition.replace(/"/g, '&quot;');
                html += `
                    <div class="condition-option">
                        <input type="checkbox" id="${checkboxId}" data-table="${tableName}" data-condition="${escapedCondition}">
                        <label for="${checkboxId}">${item.condition}</label>
                        <span class="condition-count">(used in ${item.count} statement${item.count > 1 ? 's' : ''})</span>
                    </div>
                `;
            });

            html += '</div>';
        });
    }

    conditionSelector.innerHTML = html;

    // Reset preview
    previewSection.style.display = 'none';
    applyRewriteBtn.style.display = 'none';
    cancelRewriteBtn.style.display = 'none';
}

// Handle preview rewrite
function handlePreviewRewrite() {
    // Collect selected conditions
    const checkboxes = document.querySelectorAll('#condition-selector input[type="checkbox"]:checked');

    if (checkboxes.length === 0) {
        showStatus(rewriteStatus, 'error', 'Please select at least one WHERE condition to apply');
        return;
    }

    // Group selected conditions by table
    selectedConditions = {};
    checkboxes.forEach(checkbox => {
        const table = checkbox.dataset.table;
        const condition = checkbox.dataset.condition;

        if (!selectedConditions[table]) {
            selectedConditions[table] = [];
        }
        selectedConditions[table].push(condition);
    });

    // Rewrite statements
    const rewrittenStatements = currentStatementsWithIds.map((item, index) => {
        const originalSql = item.statement;

        // Get parsed data for this statement
        const parsedStatement = parsedResult.data[index];

        if (!parsedStatement) {
            // No parsed data, return unchanged
            return {
                id: item.id,
                original: originalSql,
                rewritten: originalSql
            };
        }

        // Build table mapping for this statement (table name -> alias)
        const tableAliasMap = {};
        const tableNamesInStatement = new Set();

        parsedStatement.tables.forEach(table => {
            tableNamesInStatement.add(table.name);
            tableAliasMap[table.name] = table.alias || table.name;
        });

        // Apply only conditions for tables that exist in this statement
        let newSql = originalSql;

        Object.entries(selectedConditions).forEach(([tableName, conditions]) => {
            // Only apply if this statement uses this table
            if (tableNamesInStatement.has(tableName)) {
                // Get the alias used in THIS specific statement
                const aliasInStatement = tableAliasMap[tableName];

                // Map conditions to use the correct alias for this statement
                const mappedConditions = conditions.map(condition => {
                    // The condition has format like "o.column_name = value"
                    // We need to replace the alias prefix with the one used in this statement

                    // Extract the current alias from the condition (everything before the first dot)
                    const match = condition.match(/^(\w+)\./);
                    if (match) {
                        const conditionAlias = match[1];
                        // Replace it with the alias used in this specific statement
                        return condition.replace(new RegExp(`^${conditionAlias}\\.`), `${aliasInStatement}.`);
                    }
                    return condition;
                }).filter(condition => {
                    // Filter out conditions that already exist in the statement
                    // Normalize whitespace for comparison
                    const normalizedCondition = condition.replace(/\s+/g, ' ').trim();
                    const normalizedSql = originalSql.replace(/\s+/g, ' ');

                    // Check if this exact condition already exists
                    return !normalizedSql.includes(normalizedCondition);
                });

                // Only apply if there are new conditions to add
                if (mappedConditions.length > 0) {
                    newSql = SQLRewriter.rewriteStatement(newSql, mappedConditions);
                }
            }
        });

        return {
            id: item.id,
            original: originalSql,
            rewritten: newSql
        };
    });

    // Display preview
    displayPreview(rewrittenStatements);

    // Show apply/cancel buttons
    applyRewriteBtn.style.display = 'inline-block';
    cancelRewriteBtn.style.display = 'inline-block';
    previewSection.style.display = 'block';

    showStatus(rewriteStatus, 'info', 'Preview generated. Review and click "Apply Changes" to update the database.');
}

// Display preview
function displayPreview(rewrittenStatements) {
    const beforeTextarea = document.querySelector('#preview-before textarea');
    const afterTextarea = document.querySelector('#preview-after textarea');

    const beforeText = rewrittenStatements.map((item, i) =>
        `-- Statement ${i + 1} (ID: ${item.id})\n${item.original}`
    ).join('\n\n---\n\n');

    const afterText = rewrittenStatements.map((item, i) =>
        `-- Statement ${i + 1} (ID: ${item.id})\n${item.rewritten}`
    ).join('\n\n---\n\n');

    beforeTextarea.value = beforeText;
    afterTextarea.value = afterText;

    // Store for later use
    window.rewrittenStatements = rewrittenStatements;
}

// Handle apply rewrite
async function handleApplyRewrite() {
    if (!window.rewrittenStatements) {
        showStatus(rewriteStatus, 'error', 'No rewritten statements to apply');
        return;
    }

    if (!confirm('Are you sure you want to update the SQL statements in the database? This action cannot be undone.')) {
        return;
    }

    applyRewriteBtn.disabled = true;
    applyRewriteBtn.innerHTML = 'Applying... <span class="spinner"></span>';

    const tableName = sourceTableSelect.value;
    const columnName = document.getElementById('column-name').value;

    const updates = window.rewrittenStatements.map(item => ({
        id: item.id,
        newStatement: item.rewritten
    }));

    const result = await API.updateStatements(tableName, columnName, updates);

    applyRewriteBtn.disabled = false;
    applyRewriteBtn.innerHTML = 'Apply Changes to Database';

    if (result.success) {
        showStatus(rewriteStatus, 'success', result.message);

        // Reset and hide preview
        previewSection.style.display = 'none';
        applyRewriteBtn.style.display = 'none';
        cancelRewriteBtn.style.display = 'none';

        // Refresh statements
        setTimeout(() => {
            handleFetchStatements();
        }, 1500);
    } else {
        showStatus(rewriteStatus, 'error', `Failed to update statements: ${result.error}`);
    }
}

// Handle cancel rewrite
function handleCancelRewrite() {
    previewSection.style.display = 'none';
    applyRewriteBtn.style.display = 'none';
    cancelRewriteBtn.style.display = 'none';
    window.rewrittenStatements = null;

    showStatus(rewriteStatus, 'info', 'Preview cancelled');
}
