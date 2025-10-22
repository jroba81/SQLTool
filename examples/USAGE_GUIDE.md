# Usage Guide

## Quick Start

### 1. Setup Database

First, set up your database with the sample data:

```bash
mysql -u root -p < examples/sample_setup.sql
```

This will create:
- A database called `sql_visualizer_demo`
- A table `sql_statements` containing sample SQL INSERT statements
- Related tables referenced in those statements

### 2. Configure Database Connection

Copy the example configuration:

```bash
cp config/database.example.json config/database.json
```

Edit `config/database.json` with your credentials:

```json
{
  "host": "localhost",
  "user": "root",
  "password": "your_password",
  "database": "sql_visualizer_demo"
}
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Server

```bash
npm start
```

The application will be available at `http://localhost:3000`

## Using the Application

### Step 1: Connect to Database

1. Enter your database credentials:
   - Host (default: localhost)
   - User
   - Password
   - Database name

2. Click "Connect"

### Step 2: Select Source Table

1. Choose the table containing SQL statements (e.g., `sql_statements`)
2. Enter the column name containing the SQL text (default: `sql_statement`)
3. Click "Fetch Statements"

### Step 3: Parse and Visualize

1. Review the fetched SQL statements
2. Click "Parse & Visualize"
3. View the interactive graph showing table relationships

### Step 4: Explore Results

The visualization shows:
- **Nodes**: Tables referenced in the SQL statements
  - Blue boxes: Primary tables
  - Green boxes: JOINed tables
- **Edges**: Relationships between tables
  - Shows JOIN conditions

Use the tabs to view:
- **Tables**: All tables with their columns
- **JOINs**: JOIN operations and conditions
- **WHERE Conditions**: Filter conditions by table
- **Errors**: Any parsing errors

### Controls

- **Reset View**: Center and fit the graph
- **Export Data**: Download parsed data as JSON
- **Click on nodes**: View detailed information (tooltip)

## Understanding the Visualization

### Node Colors

- **Purple/Blue**: Tables from INSERT or main tables
- **Green**: Tables added through JOIN operations

### Node Labels

Each node shows:
- Table name
- Columns used in the statement
- Number of WHERE conditions (if any)

### Edges (Connections)

- **Arrows**: Show JOIN direction
- **Labels**: Display JOIN type and condition
- **Green lines**: JOIN relationships

## Examples

### Example 1: Simple INSERT

```sql
INSERT INTO users (id, username, email)
VALUES (1, 'john', 'john@example.com')
```

**Visualization**: Single node for `users` table with columns listed

### Example 2: INSERT with JOIN

```sql
INSERT INTO user_orders (user_id, order_id, total_amount)
SELECT u.id, o.order_id, o.total
FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.status = 'completed'
```

**Visualization**:
- Two nodes: `users` and `orders`
- Edge showing INNER JOIN with condition `id = user_id`
- WHERE condition `status = 'completed'` on orders table

### Example 3: Complex Multiple JOINs

```sql
INSERT INTO sales_report (customer_name, product_name, quantity)
SELECT c.name, p.product_name, oi.quantity
FROM customers c
INNER JOIN orders o ON c.customer_id = o.customer_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
INNER JOIN products p ON oi.product_id = p.product_id
WHERE o.order_date >= '2024-01-01'
```

**Visualization**:
- Four nodes: `customers`, `orders`, `order_items`, `products`
- Multiple edges showing JOIN relationships
- WHERE condition on orders table

## Advanced Features

### Exporting Data

Click "Export Data" to download a JSON file containing:
- All discovered tables and their metadata
- Relationship information
- Original parsed statements
- Column mappings

### Error Handling

The "Errors" tab shows:
- Which statements failed to parse
- Error messages
- Statement previews

This helps identify:
- Invalid SQL syntax
- Unsupported SQL features
- Data quality issues

## Troubleshooting

### Connection Issues

- Verify database credentials
- Check that MySQL server is running
- Ensure database exists and is accessible

### Parsing Errors

- Check SQL statement syntax
- Verify statements are complete (not truncated)
- Some advanced SQL features may not be fully supported

### No Visualization Appears

- Check browser console for JavaScript errors
- Ensure statements were successfully parsed
- Try "Reset View" to center the graph

## Custom Data

To use with your own data:

1. Create a table with a TEXT/VARCHAR column containing SQL statements
2. Connect to your database
3. Select your table and column name
4. Parse and visualize

The application works best with:
- INSERT ... SELECT statements
- Statements with JOINs
- Statements with WHERE clauses
- Valid SQL syntax (MySQL dialect)
