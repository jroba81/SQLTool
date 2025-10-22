-- Sample database setup for testing the SQL INSERT Statement Visualizer
-- This creates a table to store SQL INSERT statements

-- Create database
CREATE DATABASE IF NOT EXISTS sql_visualizer_demo;
USE sql_visualizer_demo;

-- Create a table to store SQL statements
CREATE TABLE IF NOT EXISTS sql_statements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    statement_name VARCHAR(255),
    sql_statement TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample SQL INSERT statements with various complexities

-- Simple INSERT
INSERT INTO sql_statements (statement_name, sql_statement) VALUES
('Simple Insert',
'INSERT INTO users (id, username, email, created_at) VALUES (1, "john_doe", "john@example.com", NOW())');

-- INSERT with JOIN (although uncommon, showing complex SELECT in INSERT)
INSERT INTO sql_statements (statement_name, sql_statement) VALUES
('Insert from Select with Join',
'INSERT INTO user_orders (user_id, order_id, total_amount)
 SELECT u.id, o.order_id, o.total
 FROM users u
 INNER JOIN orders o ON u.id = o.user_id
 WHERE o.status = "completed" AND o.total > 100');

-- INSERT with multiple table references in SELECT
INSERT INTO sql_statements (statement_name, sql_statement) VALUES
('Complex Insert with Multiple Joins',
'INSERT INTO sales_report (customer_name, product_name, quantity, total_price)
 SELECT c.name, p.product_name, oi.quantity, oi.quantity * p.price
 FROM customers c
 INNER JOIN orders o ON c.customer_id = o.customer_id
 LEFT JOIN order_items oi ON o.order_id = oi.order_id
 INNER JOIN products p ON oi.product_id = p.product_id
 WHERE o.order_date >= "2024-01-01" AND p.category = "Electronics"');

-- INSERT with subquery
INSERT INTO sql_statements (statement_name, sql_statement) VALUES
('Insert with Subquery',
'INSERT INTO premium_customers (customer_id, total_spent)
 SELECT customer_id, SUM(amount)
 FROM transactions
 WHERE customer_id IN (SELECT id FROM customers WHERE status = "active")
 GROUP BY customer_id
 HAVING SUM(amount) > 1000');

-- INSERT with complex WHERE conditions
INSERT INTO sql_statements (statement_name, sql_statement) VALUES
('Insert with Complex Conditions',
'INSERT INTO flagged_accounts (account_id, reason, flagged_date)
 SELECT a.id, "Suspicious Activity", NOW()
 FROM accounts a
 WHERE a.balance < 0
   AND a.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
   AND a.status != "closed"');

-- INSERT with CASE statement
INSERT INTO sql_statements (statement_name, sql_statement) VALUES
('Insert with Case Statement',
'INSERT INTO employee_bonuses (employee_id, bonus_amount, bonus_type)
 SELECT e.id,
        CASE
          WHEN e.performance_score > 90 THEN e.salary * 0.15
          WHEN e.performance_score > 75 THEN e.salary * 0.10
          ELSE e.salary * 0.05
        END,
        "Annual"
 FROM employees e
 WHERE e.hire_date < "2024-01-01"');

-- Simple INSERT into different table
INSERT INTO sql_statements (statement_name, sql_statement) VALUES
('Product Insert',
'INSERT INTO products (product_id, name, price, category, stock) VALUES (101, "Laptop", 999.99, "Electronics", 50)');

-- Create the actual tables referenced in the sample statements
-- (These are just for demonstration purposes)

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    customer_id INT,
    total DECIMAL(10, 2),
    status VARCHAR(50),
    order_date DATE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    id INT,
    name VARCHAR(255),
    status VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255),
    name VARCHAR(255),
    price DECIMAL(10, 2),
    category VARCHAR(100),
    stock INT
);

CREATE TABLE IF NOT EXISTS order_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT,
    amount DECIMAL(10, 2),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    balance DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    performance_score INT,
    salary DECIMAL(10, 2),
    hire_date DATE
);

-- Display the stored statements
SELECT statement_name, LEFT(sql_statement, 100) as statement_preview
FROM sql_statements;
