-- SQL Script to create a table with sample INSERT FROM SELECT statements
-- This creates realistic scenarios with JOINs, WHERE clauses, and complex queries

-- Drop and create the database
DROP DATABASE IF EXISTS sql_demo;
CREATE DATABASE sql_demo;
USE sql_demo;

-- Create the table that will store our SQL INSERT statements
CREATE TABLE sql_queries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    query_name VARCHAR(255) NOT NULL,
    sql_statement TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

-- Insert 5 random INSERT FROM SELECT statements with various complexities

-- 1. Simple INSERT with INNER JOIN
INSERT INTO sql_queries (query_name, sql_statement, description) VALUES (
    'Customer Order Summary',
    'INSERT INTO customer_order_summary (customer_id, customer_name, total_orders, total_spent)
SELECT c.customer_id, c.full_name, COUNT(o.order_id), SUM(o.order_total)
FROM customers c
INNER JOIN orders o ON c.customer_id = o.customer_id
WHERE o.order_status = "completed"
  AND o.order_date >= "2024-01-01"
GROUP BY c.customer_id, c.full_name
HAVING SUM(o.order_total) > 500',
    'Aggregates completed orders by customer with minimum spend threshold'
);

-- 2. INSERT with multiple JOINs and complex WHERE
INSERT INTO sql_queries (query_name, sql_statement, description) VALUES (
    'Product Sales Report',
    'INSERT INTO monthly_sales_report (product_id, product_name, category, units_sold, revenue, profit_margin)
SELECT p.product_id, p.product_name, cat.category_name, SUM(oi.quantity), SUM(oi.quantity * oi.unit_price), AVG(p.profit_margin)
FROM products p
INNER JOIN categories cat ON p.category_id = cat.category_id
INNER JOIN order_items oi ON p.product_id = oi.product_id
INNER JOIN orders o ON oi.order_id = o.order_id
WHERE o.order_date BETWEEN "2024-10-01" AND "2024-10-31"
  AND o.order_status IN ("completed", "shipped")
  AND cat.category_name != "Discontinued"
GROUP BY p.product_id, p.product_name, cat.category_name',
    'Monthly product sales with category filtering and multiple table joins'
);

-- 3. INSERT with LEFT JOIN and CASE statement
INSERT INTO sql_queries (query_name, sql_statement, description) VALUES (
    'Employee Performance Review',
    'INSERT INTO performance_reviews (employee_id, employee_name, department, total_sales, performance_tier, bonus_eligible)
SELECT e.employee_id, CONCAT(e.first_name, " ", e.last_name), d.department_name, COALESCE(SUM(s.sale_amount), 0),
CASE
    WHEN COALESCE(SUM(s.sale_amount), 0) >= 100000 THEN "Excellent"
    WHEN COALESCE(SUM(s.sale_amount), 0) >= 50000 THEN "Good"
    WHEN COALESCE(SUM(s.sale_amount), 0) >= 25000 THEN "Average"
    ELSE "Below Average"
END,
CASE
    WHEN COALESCE(SUM(s.sale_amount), 0) >= 50000 THEN 1
    ELSE 0
END
FROM employees e
INNER JOIN departments d ON e.department_id = d.department_id
LEFT JOIN sales s ON e.employee_id = s.employee_id AND s.sale_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
WHERE e.employment_status = "active"
  AND e.hire_date <= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)
GROUP BY e.employee_id, e.first_name, e.last_name, d.department_name',
    'Evaluates employee performance with sales tiers and bonus eligibility'
);

-- 4. INSERT with subquery in JOIN
INSERT INTO sql_queries (query_name, sql_statement, description) VALUES (
    'High Value Customer Targeting',
    'INSERT INTO marketing_targets (customer_id, email, total_lifetime_value, last_purchase_date, days_since_purchase, segment)
SELECT c.customer_id, c.email, tv.lifetime_value, tv.last_order_date, DATEDIFF(CURDATE(), tv.last_order_date),
CASE
    WHEN DATEDIFF(CURDATE(), tv.last_order_date) <= 30 THEN "Active"
    WHEN DATEDIFF(CURDATE(), tv.last_order_date) <= 90 THEN "At Risk"
    ELSE "Dormant"
END
FROM customers c
INNER JOIN (
    SELECT customer_id, SUM(order_total) as lifetime_value, MAX(order_date) as last_order_date
    FROM orders
    WHERE order_status = "completed"
    GROUP BY customer_id
) tv ON c.customer_id = tv.customer_id
WHERE tv.lifetime_value > 1000
  AND c.email_opt_in = 1
  AND c.account_status = "active"
ORDER BY tv.lifetime_value DESC',
    'Identifies high-value customers for targeted marketing campaigns'
);

-- 5. INSERT with multiple JOINs, HAVING, and aggregations
INSERT INTO sql_queries (query_name, sql_statement, description) VALUES (
    'Inventory Reorder Alert',
    'INSERT INTO reorder_alerts (product_id, product_name, supplier_id, supplier_name, current_stock, avg_monthly_sales, reorder_quantity, priority_level)
SELECT p.product_id, p.product_name, s.supplier_id, s.supplier_name, inv.stock_quantity, AVG(sales_data.monthly_quantity),
GREATEST(AVG(sales_data.monthly_quantity) * 3 - inv.stock_quantity, 0),
CASE
    WHEN inv.stock_quantity <= AVG(sales_data.monthly_quantity) * 0.5 THEN "Critical"
    WHEN inv.stock_quantity <= AVG(sales_data.monthly_quantity) * 1 THEN "High"
    WHEN inv.stock_quantity <= AVG(sales_data.monthly_quantity) * 2 THEN "Medium"
    ELSE "Low"
END
FROM products p
INNER JOIN inventory inv ON p.product_id = inv.product_id
INNER JOIN suppliers s ON p.supplier_id = s.supplier_id
INNER JOIN (
    SELECT oi.product_id, DATE_FORMAT(o.order_date, "%Y-%m") as month, SUM(oi.quantity) as monthly_quantity
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.order_id
    WHERE o.order_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY oi.product_id, DATE_FORMAT(o.order_date, "%Y-%m")
) sales_data ON p.product_id = sales_data.product_id
WHERE p.is_active = 1
  AND inv.stock_quantity < AVG(sales_data.monthly_quantity) * 2
GROUP BY p.product_id, p.product_name, s.supplier_id, s.supplier_name, inv.stock_quantity
HAVING AVG(sales_data.monthly_quantity) > 10
ORDER BY priority_level, avg_monthly_sales DESC',
    'Generates reorder alerts based on inventory levels and sales velocity'
);

-- Create the reference tables mentioned in the queries
-- (These don't need actual data, just structure for demonstration)

CREATE TABLE customers (
    customer_id INT PRIMARY KEY,
    full_name VARCHAR(255),
    email VARCHAR(255),
    email_opt_in TINYINT(1),
    account_status VARCHAR(50)
);

CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    customer_id INT,
    order_total DECIMAL(10,2),
    order_status VARCHAR(50),
    order_date DATE,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

CREATE TABLE products (
    product_id INT PRIMARY KEY,
    product_name VARCHAR(255),
    category_id INT,
    supplier_id INT,
    profit_margin DECIMAL(5,2),
    is_active TINYINT(1)
);

CREATE TABLE categories (
    category_id INT PRIMARY KEY,
    category_name VARCHAR(100)
);

CREATE TABLE order_items (
    item_id INT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT,
    unit_price DECIMAL(10,2),
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE TABLE employees (
    employee_id INT PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    department_id INT,
    employment_status VARCHAR(50),
    hire_date DATE
);

CREATE TABLE departments (
    department_id INT PRIMARY KEY,
    department_name VARCHAR(100)
);

CREATE TABLE sales (
    sale_id INT PRIMARY KEY,
    employee_id INT,
    sale_amount DECIMAL(10,2),
    sale_date DATE,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

CREATE TABLE suppliers (
    supplier_id INT PRIMARY KEY,
    supplier_name VARCHAR(255)
);

CREATE TABLE inventory (
    inventory_id INT PRIMARY KEY,
    product_id INT,
    stock_quantity INT,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Display the inserted queries
SELECT
    id,
    query_name,
    description,
    LEFT(sql_statement, 150) as statement_preview
FROM sql_queries
ORDER BY id;

-- Show total count
SELECT COUNT(*) as total_queries FROM sql_queries;

-- Instructions for use
SELECT '
=======================================================
SQL QUERIES TABLE CREATED SUCCESSFULLY
=======================================================

To use with the SQL Visualizer:

1. Connect to database: sql_demo
2. Select table: sql_queries
3. Use column: sql_statement
4. Click "Fetch Statements" then "Parse & Visualize"

This will show you:
- Table relationships from the INSERT statements
- JOIN conditions between tables
- WHERE clause conditions
- Complex aggregations and subqueries
=======================================================
' as instructions;
