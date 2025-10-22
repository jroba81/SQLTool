// API communication module
const API = {
    baseUrl: '/api/database',

    // Connect to database
    async connect(credentials) {
        try {
            const response = await fetch(`${this.baseUrl}/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Connection error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // Get list of tables
    async getTables() {
        try {
            const response = await fetch(`${this.baseUrl}/tables`);
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching tables:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // Get SQL statements from table
    async getStatements(tableName, columnName) {
        try {
            const response = await fetch(`${this.baseUrl}/statements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tableName, columnName })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching statements:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // Parse SQL statements
    async parseStatements(statements) {
        try {
            const response = await fetch(`${this.baseUrl}/parse`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ statements })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error parsing statements:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // Get SQL statements with IDs
    async getStatementsWithIds(tableName, columnName) {
        try {
            console.log('[API.getStatementsWithIds] Starting fetch...');
            console.log('[API.getStatementsWithIds] URL:', `${this.baseUrl}/statements-with-ids`);
            console.log('[API.getStatementsWithIds] Body:', { tableName, columnName });

            const response = await fetch(`${this.baseUrl}/statements-with-ids`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tableName, columnName })
            });

            console.log('[API.getStatementsWithIds] Response status:', response.status);
            console.log('[API.getStatementsWithIds] Response ok:', response.ok);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[API.getStatementsWithIds] Response not OK:', errorText);
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${errorText}`
                };
            }

            const data = await response.json();
            console.log('[API.getStatementsWithIds] Parsed response data:', data);
            return data;
        } catch (error) {
            console.error('[API.getStatementsWithIds] Exception:', error);
            console.error('[API.getStatementsWithIds] Error stack:', error.stack);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // Update SQL statements
    async updateStatements(tableName, columnName, updates, idColumn) {
        try {
            const response = await fetch(`${this.baseUrl}/update-statements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ tableName, columnName, updates, idColumn })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error updating statements:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};
