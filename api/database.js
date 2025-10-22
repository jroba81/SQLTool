const express = require('express');
const mysql = require('mysql2/promise');
const { Parser } = require('node-sql-parser');

const router = express.Router();
const parser = new Parser();

// Store active connections (in production, use a proper connection pool)
let dbConnection = null;

// Test database connection
router.post('/connect', async (req, res) => {
  try {
    const { host, user, password, database } = req.body;

    // Close existing connection if any
    if (dbConnection) {
      await dbConnection.end();
    }

    // Create new connection
    dbConnection = await mysql.createConnection({
      host: host || 'localhost',
      user: user,
      password: password,
      database: database
    });

    res.json({
      success: true,
      message: 'Connected to database successfully'
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get list of tables
router.get('/tables', async (req, res) => {
  try {
    if (!dbConnection) {
      return res.status(400).json({
        success: false,
        error: 'Not connected to database'
      });
    }

    const [tables] = await dbConnection.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);

    res.json({
      success: true,
      tables: tableNames
    });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get SQL statements from a table
router.post('/statements', async (req, res) => {
  try {
    const { tableName, columnName } = req.body;

    if (!dbConnection) {
      return res.status(400).json({
        success: false,
        error: 'Not connected to database'
      });
    }

    // Query to get SQL statements
    const query = `SELECT ${columnName} FROM ${tableName}`;
    const [rows] = await dbConnection.query(query);

    // Extract SQL statements
    const sqlStatements = rows
      .map(row => row[columnName])
      .filter(sql => sql && sql.trim().length > 0);

    res.json({
      success: true,
      statements: sqlStatements,
      count: sqlStatements.length
    });
  } catch (error) {
    console.error('Error fetching statements:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Parse SQL statements and extract table relationships
router.post('/parse', async (req, res) => {
  try {
    const { statements } = req.body;

    if (!statements || !Array.isArray(statements)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid statements array'
      });
    }

    const parsedData = [];
    const errors = [];

    for (let i = 0; i < statements.length; i++) {
      try {
        const sql = statements[i];

        // Parse the SQL statement
        const ast = parser.astify(sql, { database: 'MySQL' });

        // Extract information based on statement type
        const statementInfo = extractStatementInfo(ast, sql);

        if (statementInfo) {
          parsedData.push(statementInfo);
        }
      } catch (parseError) {
        errors.push({
          index: i,
          statement: statements[i].substring(0, 100) + '...',
          error: parseError.message
        });
      }
    }

    res.json({
      success: true,
      data: parsedData,
      errors: errors,
      totalParsed: parsedData.length,
      totalErrors: errors.length
    });
  } catch (error) {
    console.error('Error parsing statements:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Helper function to extract information from parsed AST
function extractStatementInfo(ast, originalSql) {
  // Handle array of statements
  if (Array.isArray(ast)) {
    ast = ast[0];
  }

  if (!ast) return null;

  const info = {
    type: ast.type,
    originalSql: originalSql,
    tables: [],
    columns: [],
    joins: [],
    whereConditions: []
  };

  // Extract table information
  if (ast.table) {
    if (Array.isArray(ast.table)) {
      ast.table.forEach(tbl => {
        info.tables.push(extractTableInfo(tbl));
      });
    } else {
      info.tables.push(extractTableInfo(ast.table));
    }
  }

  // Extract columns for INSERT
  if (ast.type === 'insert' && ast.columns) {
    info.columns = ast.columns.map(col => ({
      name: typeof col === 'string' ? col : col.column,
      table: ast.table ? (Array.isArray(ast.table) ? ast.table[0].table : ast.table.table) : null
    }));
  }

  // Extract JOIN information
  if (ast.from && Array.isArray(ast.from)) {
    ast.from.forEach(item => {
      if (item.join) {
        info.joins.push({
          type: item.join,
          table: extractTableInfo(item),
          condition: item.on ? extractCondition(item.on) : null
        });
      }
    });
  }

  // Extract WHERE clause conditions
  if (ast.where) {
    info.whereConditions = extractWhereConditions(ast.where);
  }

  return info;
}

// Extract table information
function extractTableInfo(tableObj) {
  if (typeof tableObj === 'string') {
    return { name: tableObj, alias: null };
  }

  return {
    name: tableObj.table || tableObj.name,
    alias: tableObj.as || null,
    database: tableObj.db || null
  };
}

// Extract WHERE conditions recursively
function extractWhereConditions(whereClause) {
  if (!whereClause) return [];

  const conditions = [];

  const traverse = (node) => {
    if (!node) return;

    // Handle logical operators (AND, OR)
    if (node.type === 'binary_expr' && (node.operator === 'AND' || node.operator === 'OR')) {
      traverse(node.left);
      traverse(node.right);
      return;
    }

    // Handle comparison operators
    if (node.type === 'binary_expr') {
      const condition = {
        operator: node.operator,
        left: extractExpression(node.left),
        right: extractExpression(node.right)
      };
      conditions.push(condition);
    }

    // Handle IN, BETWEEN, etc.
    if (node.type === 'expr_list') {
      node.value.forEach(item => traverse(item));
    }
  };

  traverse(whereClause);
  return conditions;
}

// Extract expression details
function extractExpression(expr) {
  if (!expr) return null;

  if (expr.type === 'column_ref') {
    return {
      type: 'column',
      table: expr.table,
      column: expr.column
    };
  }

  if (expr.type === 'number' || expr.type === 'single_quote_string' || expr.type === 'double_quote_string') {
    return {
      type: 'value',
      value: expr.value
    };
  }

  if (expr.type === 'function') {
    return {
      type: 'function',
      name: expr.name,
      args: expr.args ? expr.args.value : []
    };
  }

  return {
    type: expr.type,
    value: expr.value || expr
  };
}

// Extract condition information
function extractCondition(condition) {
  if (!condition) return null;

  return {
    type: condition.type,
    operator: condition.operator,
    left: extractExpression(condition.left),
    right: extractExpression(condition.right)
  };
}

module.exports = router;
