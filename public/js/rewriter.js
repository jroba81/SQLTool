// SQL Statement Rewriter Module
const SQLRewriter = {
    // Rewrite INSERT...SELECT with new WHERE conditions
    rewriteStatement(sqlStatement, tableConditions) {
        try {
            // Simple regex-based rewriting for INSERT...SELECT statements
            // This looks for WHERE clause and adds/modifies conditions

            // Check if this is an INSERT...SELECT statement
            if (!sqlStatement.trim().toUpperCase().startsWith('INSERT')) {
                return sqlStatement;
            }

            // Find the WHERE clause position
            const whereMatch = sqlStatement.match(/\bWHERE\b/i);

            if (!whereMatch) {
                // No WHERE clause exists, add one before GROUP BY, HAVING, ORDER BY, or LIMIT
                return this.addWhereClause(sqlStatement, tableConditions);
            } else {
                // WHERE clause exists, modify it
                return this.modifyWhereClause(sqlStatement, tableConditions);
            }

        } catch (error) {
            console.error('Error rewriting statement:', error);
            return sqlStatement; // Return original on error
        }
    },

    // Add WHERE clause to statement without one
    addWhereClause(sqlStatement, tableConditions) {
        if (tableConditions.length === 0) {
            return sqlStatement;
        }

        // Build WHERE clause from conditions
        const whereClause = '\nWHERE ' + tableConditions.join('\n  AND ');

        // Find insertion point (before GROUP BY, HAVING, ORDER BY, LIMIT, or end)
        const insertionPoints = [
            { regex: /\bGROUP\s+BY\b/i, name: 'GROUP BY' },
            { regex: /\bHAVING\b/i, name: 'HAVING' },
            { regex: /\bORDER\s+BY\b/i, name: 'ORDER BY' },
            { regex: /\bLIMIT\b/i, name: 'LIMIT' }
        ];

        for (const point of insertionPoints) {
            const match = sqlStatement.match(point.regex);
            if (match) {
                const position = match.index;
                return sqlStatement.slice(0, position) + whereClause + '\n' + sqlStatement.slice(position);
            }
        }

        // No special clauses found, add at end
        return sqlStatement.trimEnd() + whereClause;
    },

    // Modify existing WHERE clause
    modifyWhereClause(sqlStatement, tableConditions) {
        if (tableConditions.length === 0) {
            return sqlStatement;
        }

        // Find WHERE clause
        const whereMatch = sqlStatement.match(/\bWHERE\b/i);
        if (!whereMatch) {
            return sqlStatement;
        }

        const whereStart = whereMatch.index + whereMatch[0].length;

        // Find end of WHERE clause (before GROUP BY, HAVING, ORDER BY, LIMIT)
        const endPoints = [
            /\bGROUP\s+BY\b/i,
            /\bHAVING\b/i,
            /\bORDER\s+BY\b/i,
            /\bLIMIT\b/i
        ];

        let whereEnd = sqlStatement.length;
        for (const regex of endPoints) {
            const match = sqlStatement.slice(whereStart).match(regex);
            if (match) {
                whereEnd = whereStart + match.index;
                break;
            }
        }

        // Extract existing WHERE conditions
        const existingWhere = sqlStatement.slice(whereStart, whereEnd).trim();

        // Build new WHERE clause combining existing and new conditions
        const newConditions = tableConditions.join('\n  AND ');
        const combinedWhere = `\n  ${existingWhere}\n  AND ${newConditions}`;

        // Reconstruct statement
        return sqlStatement.slice(0, whereStart) + combinedWhere + '\n' + sqlStatement.slice(whereEnd);
    },

    // Format condition for SQL
    formatCondition(condition) {
        const left = condition.left?.column || JSON.stringify(condition.left);
        const right = condition.right?.value !== undefined
            ? this.formatValue(condition.right.value, condition.right.type)
            : (condition.right?.column || JSON.stringify(condition.right));

        const table = condition.left?.table || '';
        const tablePrefix = table ? `${table}.` : '';

        return `${tablePrefix}${left} ${condition.operator} ${right}`;
    },

    // Format value with proper quoting
    formatValue(value, type) {
        if (type === 'single_quote_string' || type === 'double_quote_string') {
            return `"${value}"`;
        }
        if (type === 'number') {
            return value;
        }
        // Default to quoted string
        return `"${value}"`;
    },

    // Extract table alias from FROM clause
    extractTableAlias(sqlStatement, tableName) {
        const fromMatch = sqlStatement.match(/\bFROM\b[\s\S]*?(?=\bWHERE\b|\bGROUP\b|\bORDER\b|\bLIMIT\b|$)/i);
        if (!fromMatch) return null;

        const fromClause = fromMatch[0];

        // Look for table with alias
        const aliasRegex = new RegExp(`\\b${tableName}\\s+(?:AS\\s+)?(\\w+)`, 'i');
        const aliasMatch = fromClause.match(aliasRegex);

        return aliasMatch ? aliasMatch[1] : null;
    }
};
