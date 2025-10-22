// Visualization module using vis.js
const Visualizer = {
    network: null,
    nodes: null,
    edges: null,
    parsedData: null,

    // Initialize visualization
    init(containerId) {
        this.container = document.getElementById(containerId);
        this.nodes = new vis.DataSet([]);
        this.edges = new vis.DataSet([]);
    },

    // Create visualization from parsed data
    visualize(parsedData) {
        this.parsedData = parsedData;
        this.nodes.clear();
        this.edges.clear();

        const tableMap = new Map();
        const edgeSet = new Set();

        // Process each parsed statement
        parsedData.forEach((statement, index) => {
            // Add tables as nodes
            statement.tables.forEach(table => {
                const tableName = table.name;
                if (!tableMap.has(tableName)) {
                    tableMap.set(tableName, {
                        id: tableName,
                        label: tableName,
                        shape: 'box',
                        color: {
                            background: '#667eea',
                            border: '#764ba2',
                            highlight: {
                                background: '#764ba2',
                                border: '#667eea'
                            }
                        },
                        font: {
                            color: 'white',
                            size: 16,
                            face: 'arial'
                        },
                        columns: new Set(),
                        whereConditions: []
                    });
                }

                // Add columns to table
                statement.columns.forEach(col => {
                    if (col.table === tableName || statement.tables.length === 1) {
                        tableMap.get(tableName).columns.add(col.name);
                    }
                });
            });

            // Add WHERE conditions to tables
            statement.whereConditions.forEach(condition => {
                if (condition.left && condition.left.type === 'column') {
                    const tableName = condition.left.table || statement.tables[0]?.name;
                    if (tableName && tableMap.has(tableName)) {
                        tableMap.get(tableName).whereConditions.push(condition);
                    }
                }
            });

            // Process JOINs
            statement.joins.forEach(join => {
                const joinTable = join.table.name;
                const mainTable = statement.tables[0]?.name;

                // Add join table if not exists
                if (!tableMap.has(joinTable)) {
                    tableMap.set(joinTable, {
                        id: joinTable,
                        label: joinTable,
                        shape: 'box',
                        color: {
                            background: '#28a745',
                            border: '#218838',
                            highlight: {
                                background: '#218838',
                                border: '#28a745'
                            }
                        },
                        font: {
                            color: 'white',
                            size: 16
                        },
                        columns: new Set(),
                        whereConditions: []
                    });
                }

                // Create edge for JOIN
                if (mainTable && joinTable) {
                    const edgeId = `${mainTable}-${joinTable}`;
                    if (!edgeSet.has(edgeId)) {
                        edgeSet.add(edgeId);

                        let label = join.type || 'JOIN';
                        if (join.condition) {
                            const leftCol = join.condition.left?.column || '';
                            const rightCol = join.condition.right?.column || '';
                            if (leftCol && rightCol) {
                                label += `\n${leftCol} = ${rightCol}`;
                            }
                        }

                        this.edges.add({
                            from: mainTable,
                            to: joinTable,
                            label: label,
                            arrows: 'to',
                            color: {
                                color: '#28a745',
                                highlight: '#218838'
                            },
                            font: {
                                size: 12,
                                align: 'middle'
                            },
                            smooth: {
                                type: 'curvedCW',
                                roundness: 0.2
                            }
                        });
                    }
                }
            });
        });

        // Add all nodes with enhanced labels
        tableMap.forEach((tableData, tableName) => {
            let label = tableName;

            // Add columns to label
            if (tableData.columns.size > 0) {
                label += '\n---';
                const columns = Array.from(tableData.columns).slice(0, 5);
                columns.forEach(col => {
                    label += `\n${col}`;
                });
                if (tableData.columns.size > 5) {
                    label += `\n... +${tableData.columns.size - 5} more`;
                }
            }

            // Add WHERE conditions indicator
            if (tableData.whereConditions.length > 0) {
                label += `\n---\nWHERE: ${tableData.whereConditions.length} condition(s)`;
            }

            this.nodes.add({
                ...tableData,
                label: label,
                title: this.createTooltip(tableData)
            });
        });

        // Create network
        const data = {
            nodes: this.nodes,
            edges: this.edges
        };

        const options = {
            nodes: {
                shape: 'box',
                margin: 10,
                widthConstraint: {
                    minimum: 150,
                    maximum: 300
                }
            },
            edges: {
                smooth: {
                    type: 'cubicBezier',
                    forceDirection: 'horizontal',
                    roundness: 0.4
                },
                width: 2
            },
            physics: {
                enabled: true,
                barnesHut: {
                    gravitationalConstant: -2000,
                    centralGravity: 0.3,
                    springLength: 200,
                    springConstant: 0.04
                }
            },
            interaction: {
                hover: true,
                tooltipDelay: 100
            },
            layout: {
                hierarchical: {
                    enabled: false
                }
            }
        };

        if (this.network) {
            this.network.destroy();
        }

        this.network = new vis.Network(this.container, data, options);

        // Add click event
        this.network.on('click', (params) => {
            if (params.nodes.length > 0) {
                this.onNodeClick(params.nodes[0]);
            }
        });
    },

    // Create tooltip for table
    createTooltip(tableData) {
        let tooltip = `<b>${tableData.id}</b><br>`;

        if (tableData.columns.size > 0) {
            tooltip += `<br><b>Columns:</b><br>`;
            Array.from(tableData.columns).forEach(col => {
                tooltip += `- ${col}<br>`;
            });
        }

        if (tableData.whereConditions.length > 0) {
            tooltip += `<br><b>WHERE Conditions:</b><br>`;
            tableData.whereConditions.forEach(cond => {
                const left = cond.left?.column || JSON.stringify(cond.left);
                const right = cond.right?.value || cond.right?.column || JSON.stringify(cond.right);
                tooltip += `- ${left} ${cond.operator} ${right}<br>`;
            });
        }

        return tooltip;
    },

    // Handle node click
    onNodeClick(nodeId) {
        const node = this.nodes.get(nodeId);
        console.log('Node clicked:', node);
        // You can add custom behavior here
    },

    // Reset view
    resetView() {
        if (this.network) {
            this.network.fit({
                animation: {
                    duration: 1000,
                    easingFunction: 'easeInOutQuad'
                }
            });
        }
    },

    // Export data
    exportData() {
        if (!this.parsedData) {
            alert('No data to export');
            return;
        }

        const exportData = {
            tables: Array.from(this.nodes.get()),
            relationships: Array.from(this.edges.get()),
            parsedStatements: this.parsedData
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'sql-visualization-export.json';
        link.click();

        URL.revokeObjectURL(url);
    }
};
