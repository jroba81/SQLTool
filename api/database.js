const express = require('express');
const mysql = require('mysql2/promise');
const mssql = require('mssql');
const { Parser } = require('node-sql-parser');

const router = express.Router();
const parser = new Parser();

// Store active connections and type
let dbConnection = null;
let dbType = null;
let mssqlPool = null;

// Test database connection
router.post('/connect', async (req, res) => {
  try {
    const { type, host, port, user, password, database } = req.body;

    // Close existing connection if any
    if (dbConnection && dbType === 'mysql') {
      await dbConnection.end();
      dbConnection = null;
    }
    if (mssqlPool && dbType === 'mssql') {
      await mssqlPool.close();
      mssqlPool = null;
    }

    dbType = type || 'mysql';

    if (dbType === 'mysql') {
      // Create MySQL connection
      dbConnection = await mysql.createConnection({
        host: host || 'localhost',
        port: port || 3306,
        user: user,
        password: password,
        database: database
      });

      res.json({
        success: true,
        message: 'Connected to MySQL database successfully'
      });
    } else if (dbType === 'mssql') {
      // Create SQL Server connection
      const config = {
        user: user,
        password: password,
        server: host || 'localhost',
        port: parseInt(port) || 1433,
        database: database,
        options: {
          encrypt: false, // Use true for Azure
          trustServerCertificate: true,
          enableArithAbort: true
        }
      };

      mssqlPool = await mssql.connect(config);
      dbConnection = mssqlPool; // For compatibility with existing code

      res.json({
        success: true,
        message: 'Connected to SQL Server database successfully'
      });
    } else {
      throw new Error('Unsupported database type');
    }

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

    let tableNames = [];

    if (dbType === 'mysql') {
      const [tables] = await dbConnection.query('SHOW TABLES');
      tableNames = tables.map(row => Object.values(row)[0]);
    } else if (dbType === 'mssql') {
      const result = await mssqlPool.request().query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'"
      );
      tableNames = result.recordset.map(row => row.TABLE_NAME);
    }

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
    let rows;

    if (dbType === 'mysql') {
      [rows] = await dbConnection.query(query);
    } else if (dbType === 'mssql') {
      const result = await mssqlPool.request().query(query);
      rows = result.recordset;
    }

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
        // Note: Use MySQL parser for both as INSERT syntax is similar and MSSQL not fully supported
        const ast = parser.astify(sql, { database: 'MySQL' });

        // Extract information based on statement type
        const statementInfo = extractStatementInfo(ast, sql);

        if (statementInfo) {
          parsedData.push(statementInfo);
        }
      } catch (parseError) {
        // If parsing fails, try basic regex extraction for SQL Server statements
        try {
          const basicInfo = extractBasicInfo(statements[i]);
          if (basicInfo) {
            parsedData.push(basicInfo);
          }
        } catch (regexError) {
          // Both parsing methods failed
          errors.push({
            index: i,
            statement: statements[i].substring(0, 100) + '...',
            error: parseError.message
          });
        }
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

// Fallback: Extract basic info using regex when parser fails (for SQL Server specific syntax)
function extractBasicInfo(sql) {
  const info = {
    type: 'insert',
    originalSql: sql,
    tables: [],
    columns: [],
    joins: [],
    whereConditions: []
  };

  // Extract INSERT INTO table name (handles temp tables like #tmpTable and brackets)
  const insertMatch = sql.match(/INSERT\s+INTO\s+([#@]?\w+|\[[^\]]+\])/i);
  if (insertMatch) {
    const tableName = insertMatch[1].replace(/[\[\]]/g, '');
    info.tables.push({ name: tableName, alias: null });
  }

  // Extract FROM clause tables (handles database.schema.table format and table hints)
  const fromMatches = sql.matchAll(/FROM\s+([\w\.]+|\[[^\]]+\])\s*(\w+)?\s*(?:\(NOLOCK\))?/gi);
  for (const match of fromMatches) {
    let tableName = match[1];
    // Handle three-part names (database.schema.table) - take just the table name
    if (tableName.includes('.')) {
      const parts = tableName.split('.');
      tableName = parts[parts.length - 1];
    }
    tableName = tableName.replace(/[\[\]]/g, '');
    const alias = match[2] || null;

    // Avoid duplicates
    if (!info.tables.some(t => t.name === tableName)) {
      info.tables.push({ name: tableName, alias: alias });
    }
  }

  // Extract JOIN tables
  const joinMatches = sql.matchAll(/(INNER|LEFT|RIGHT|FULL|CROSS)?\s*JOIN\s+([\w\.]+|\[[^\]]+\])\s*(\w+)?/gi);
  for (const match of joinMatches) {
    const joinType = match[1] ? `${match[1].toUpperCase()} JOIN` : 'JOIN';
    let tableName = match[2];

    // Handle three-part names
    if (tableName.includes('.')) {
      const parts = tableName.split('.');
      tableName = parts[parts.length - 1];
    }
    tableName = tableName.replace(/[\[\]]/g, '');
    const alias = match[3] || null;

    info.joins.push({
      type: joinType,
      table: { name: tableName, alias: alias },
      condition: null // Can't easily extract with regex
    });

    // Add to tables list if not already there
    if (!info.tables.some(t => t.name === tableName)) {
      info.tables.push({ name: tableName, alias: alias });
    }
  }

  // Extract WHERE conditions with actual values
  const whereMatch = sql.match(/WHERE\s+(.*?)(?:GROUP BY|ORDER BY|HAVING|$)/is);
  if (whereMatch) {
    const whereClause = whereMatch[1];

    // Pattern to match conditions like: table.column operator value
    // Handles: =, <>, !=, <, >, <=, >=, IN, NOT IN
    const conditionPattern = /(\w+)\.(\w+|\[[^\]]+\])\s*(=|<>|!=|<=|>=|<|>|IN|NOT IN)\s*(?:\(([^)]+)\)|'([^']*)'|"([^"]*)"|(\d+))/gi;

    let condMatch;
    while ((condMatch = conditionPattern.exec(whereClause)) !== null) {
      const table = condMatch[1];
      const column = condMatch[2].replace(/[\[\]]/g, '');
      const operator = condMatch[3].toUpperCase();

      // Get the value from whichever group matched
      let value = condMatch[4] || condMatch[5] || condMatch[6] || condMatch[7];

      if (value) {
        // Clean up the value
        value = value.trim();

        info.whereConditions.push({
          operator: operator,
          left: { type: 'column', table: table, column: column },
          right: { type: 'value', value: value }
        });
      }
    }
  }

  return info;
}

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

  // Extract table information from INSERT target
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

  // For INSERT ... SELECT statements, extract from the SELECT portion
  let selectAst = null;
  if (ast.type === 'insert' && ast.values) {
    // Check if values is a SELECT statement (object) or contains one (array)
    if (ast.values.type === 'select') {
      selectAst = ast.values;
    } else if (Array.isArray(ast.values) && ast.values[0] && ast.values[0].type === 'select') {
      selectAst = ast.values[0];
    }
  }

  // If we have a SELECT statement (either standalone or from INSERT...SELECT)
  const astToProcess = selectAst || ast;

  // Extract tables from FROM clause
  if (astToProcess.from && Array.isArray(astToProcess.from)) {
    astToProcess.from.forEach(item => {
      // Add the main table from FROM clause
      const tableInfo = extractTableInfo(item);
      // Only add if not already in the list (avoid duplicates)
      if (!info.tables.some(t => t.name === tableInfo.name)) {
        info.tables.push(tableInfo);
      }

      // Extract JOIN information
      if (item.join) {
        info.joins.push({
          type: item.join,
          table: extractTableInfo(item),
          condition: item.on ? extractCondition(item.on) : null
        });
      }
    });
  }

  // Extract columns from SELECT clause if present
  if (selectAst && selectAst.columns && selectAst.columns !== '*') {
    if (Array.isArray(selectAst.columns)) {
      selectAst.columns.forEach(col => {
        if (col.expr && col.expr.type === 'column_ref') {
          info.columns.push({
            name: col.expr.column,
            table: col.expr.table,
            alias: col.as || null
          });
        }
      });
    }
  }

  // Extract WHERE clause conditions
  if (astToProcess.where) {
    info.whereConditions = extractWhereConditions(astToProcess.where);
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

// Update SQL statements in database
router.post('/update-statements', async (req, res) => {
  try {
    const { tableName, columnName, updates, idColumn } = req.body;

    if (!dbConnection) {
      return res.status(400).json({
        success: false,
        error: 'Not connected to database'
      });
    }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid updates array'
      });
    }

    // Use provided idColumn or default to 'id'
    const idCol = idColumn || 'id';

    // Update each statement
    let updateCount = 0;
    const errors = [];

    for (const update of updates) {
      try {
        const { id, newStatement } = update;

        if (dbType === 'mysql') {
          // Build update query with parameterized values for security
          const query = `UPDATE ${tableName} SET ${columnName} = ? WHERE ${idCol} = ?`;
          await dbConnection.execute(query, [newStatement, id]);
        } else if (dbType === 'mssql') {
          // SQL Server uses @param syntax
          const query = `UPDATE ${tableName} SET ${columnName} = @newStatement WHERE ${idCol} = @id`;
          await mssqlPool.request()
            .input('newStatement', mssql.NVarChar, newStatement)
            .input('id', mssql.Int, id)
            .query(query);
        }

        updateCount++;
      } catch (updateError) {
        errors.push({
          id: update.id,
          error: updateError.message
        });
      }
    }

    res.json({
      success: true,
      updated: updateCount,
      errors: errors,
      message: `Successfully updated ${updateCount} of ${updates.length} statements`
    });

  } catch (error) {
    console.error('Error updating statements:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get statements with IDs for updating
router.post('/statements-with-ids', async (req, res) => {
  try {
    console.log('statements-with-ids endpoint called');
    console.log('Request body:', req.body);
    const { tableName, columnName } = req.body;

    if (!tableName || !columnName) {
      console.log('Missing tableName or columnName');
      return res.status(400).json({
        success: false,
        error: 'tableName and columnName are required'
      });
    }

    if (!dbConnection) {
      console.log('No database connection');
      return res.status(400).json({
        success: false,
        error: 'Not connected to database'
      });
    }

    console.log(`Fetching statements from ${tableName}.${columnName} (db type: ${dbType})`);

    let rows;
    let idColumn = 'id';

    if (dbType === 'mysql') {
      // Try to find primary key column for MySQL
      try {
        const [pkResult] = await dbConnection.query(
          `SHOW KEYS FROM ${tableName} WHERE Key_name = 'PRIMARY'`
        );
        if (pkResult.length > 0) {
          idColumn = pkResult[0].Column_name;
        }
      } catch (err) {
        console.log('Could not detect primary key, using default column');
      }

      const query = `SELECT ${idColumn}, ${columnName} FROM ${tableName}`;
      [rows] = await dbConnection.query(query);

    } else if (dbType === 'mssql') {
      // Try to find primary key column for SQL Server
      let hasPrimaryKey = false;
      try {
        const pkResult = await mssqlPool.request().query(`
          SELECT COLUMN_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
          AND TABLE_NAME = '${tableName}'
        `);
        if (pkResult.recordset.length > 0) {
          idColumn = pkResult.recordset[0].COLUMN_NAME;
          hasPrimaryKey = true;
          console.log(`Detected primary key column: ${idColumn}`);
        } else {
          console.log('No primary key found, will use ROW_NUMBER');
        }
      } catch (err) {
        console.log('Error detecting primary key:', err.message);
      }

      // If we have a primary key, use it. Otherwise use ROW_NUMBER
      if (hasPrimaryKey) {
        const query = `SELECT ${idColumn}, ${columnName} FROM ${tableName}`;
        const result = await mssqlPool.request().query(query);
        rows = result.recordset;
      } else {
        // Use ROW_NUMBER as fallback if no primary key
        idColumn = 'row_id';
        const query = `SELECT ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS row_id, ${columnName} FROM ${tableName}`;
        console.log('Using ROW_NUMBER query:', query);
        const result = await mssqlPool.request().query(query);
        rows = result.recordset;
      }
    }

    // Extract SQL statements with IDs
    const statements = rows
      .filter(row => row[columnName] && row[columnName].trim().length > 0)
      .map(row => ({
        id: row[idColumn],
        idColumn: idColumn,
        statement: row[columnName]
      }));

    console.log(`Successfully fetched ${statements.length} statements with ID column: ${idColumn}`);

    const response = {
      success: true,
      statements: statements,
      count: statements.length,
      idColumn: idColumn
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching statements with IDs:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
