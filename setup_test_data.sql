-- Setup script for SQL Visualization Tool Testing
-- This creates a table to store SQL statements and populates it with examples

-- Create the test database table
CREATE TABLE SQL_Statements (
    StatementID INT IDENTITY(1,1) PRIMARY KEY,
    StatementName VARCHAR(200),
    StatementText VARCHAR(MAX),
    CreatedDate DATETIME DEFAULT GETDATE(),
    Category VARCHAR(50)
);
GO

-- Insert example INSERT statements with various patterns

-- Example 1: Simple INSERT with INNER JOIN
INSERT INTO SQL_Statements (StatementName, StatementText, Category)
VALUES (
    'Customer Orders - Completed',
    'INSERT INTO #tmpCustomerOrders (OrderID, CustomerID, CustomerName, OrderDate, TotalAmount, OrderStatus, StateCode)
SELECT o.OrderID, c.CustomerID, c.FirstName + '' '' + c.LastName AS CustomerName, o.OrderDate, o.TotalAmount, o.Status AS OrderStatus, c.State AS StateCode
FROM Orders o WITH (NOLOCK)
INNER JOIN Customers c WITH (NOLOCK) ON o.CustomerID = c.CustomerID
WHERE o.Status = ''Completed''
AND o.TotalAmount >= 100
AND c.State NOT IN (''AK'', ''HI'', ''PR'')
AND c.IsActive = 1;',
    'Orders'
);

-- Example 2: INSERT with LEFT JOIN and NOT EXISTS
INSERT INTO SQL_Statements (StatementName, StatementText, Category)
VALUES (
    'Pending Orders',
    'INSERT INTO #tmpCustomerOrders (OrderID, CustomerID, CustomerName, OrderDate, TotalAmount, OrderStatus, StateCode)
SELECT o.OrderID, c.CustomerID, CONCAT(c.FirstName, '' '', c.LastName) AS CustomerName, o.OrderDate, o.TotalAmount, o.Status, c.State
FROM Orders o (NOLOCK)
LEFT JOIN Customers c (NOLOCK) ON o.CustomerID = c.CustomerID
LEFT JOIN #tmpCustomerOrders tmp (NOLOCK) ON o.OrderID = tmp.OrderID
WHERE o.Status IN (''Pending'', ''Processing'')
AND o.TotalAmount > 100
AND tmp.OrderID IS NULL
AND c.Email IS NOT NULL;',
    'Orders'
);

-- Example 3: INSERT with multiple JOINs and GROUP BY
INSERT INTO SQL_Statements (StatementName, StatementText, Category)
VALUES (
    'Loyalty Program Orders',
    'INSERT INTO #tmpCustomerOrders (OrderID, CustomerID, CustomerName, OrderDate, TotalAmount, OrderStatus, ProductCount, StateCode)
SELECT o.OrderID, lp.CustomerID, UPPER(c.FirstName) + '' '' + UPPER(c.LastName) AS CustomerName, o.OrderDate, o.TotalAmount, o.Status, COUNT(oi.ProductID) AS ProductCount, c.State AS StateCode
FROM LoyaltyProgram lp WITH (NOLOCK)
INNER JOIN Customers c WITH (NOLOCK) ON lp.CustomerID = c.CustomerID
INNER JOIN Orders o WITH (NOLOCK) ON c.CustomerID = o.CustomerID
INNER JOIN OrderItems oi WITH (NOLOCK) ON o.OrderID = oi.OrderID
WHERE lp.MembershipLevel IN (''Gold'', ''Platinum'')
AND lp.PointsBalance >= 1000
AND c.State NOT IN (''AK'', ''HI'')
AND o.OrderDate >= DATEADD(MONTH, -6, GETDATE())
GROUP BY o.OrderID, lp.CustomerID, c.FirstName, c.LastName, o.OrderDate, o.TotalAmount, o.Status, c.State;',
    'Loyalty'
);

-- Example 4: INSERT with subquery in SELECT
INSERT INTO SQL_Statements (StatementName, StatementText, Category)
VALUES (
    'High Value Orders',
    'INSERT INTO #tmpCustomerOrders (OrderID, CustomerID, CustomerName, TotalAmount, ProductCount, StateCode)
SELECT o.OrderID, c.CustomerID, c.FirstName + '' '' + c.LastName, o.TotalAmount, (SELECT COUNT(*) FROM OrderItems oi WHERE oi.OrderID = o.OrderID) AS ProductCount, c.State
FROM Orders o WITH (NOLOCK)
INNER JOIN Customers c WITH (NOLOCK) ON o.CustomerID = c.CustomerID
WHERE o.TotalAmount > 500
AND c.State NOT IN (''AK'', ''HI'', ''PR'', ''GU'')
AND o.OrderDate >= ''2025-01-01'';',
    'Orders'
);

-- Example 5: INSERT with HAVING clause
INSERT INTO SQL_Statements (StatementName, StatementText, Category)
VALUES (
    'Frequent Customers',
    'INSERT INTO #tmpCustomerStats (CustomerID, CustomerName, OrderCount, TotalSpent, StateCode)
SELECT c.CustomerID, c.FirstName + '' '' + c.LastName AS CustomerName, COUNT(o.OrderID) AS OrderCount, SUM(o.TotalAmount) AS TotalSpent, c.State
FROM Customers c WITH (NOLOCK)
INNER JOIN Orders o WITH (NOLOCK) ON c.CustomerID = o.CustomerID
WHERE o.OrderDate >= DATEADD(YEAR, -1, GETDATE())
AND c.State NOT IN (''AK'', ''HI'')
AND o.Status = ''Completed''
GROUP BY c.CustomerID, c.FirstName, c.LastName, c.State
HAVING COUNT(o.OrderID) >= 5;',
    'Analytics'
);

-- Example 6: INSERT with multiple conditions and complex WHERE
INSERT INTO SQL_Statements (StatementName, StatementText, Category)
VALUES (
    'International Orders',
    'INSERT INTO #tmpInternationalOrders (OrderID, CustomerID, CustomerName, OrderDate, TotalAmount, CurrencyCode, StateCode)
SELECT o.OrderID, c.CustomerID, c.FirstName + '' '' + c.LastName, o.OrderDate, o.TotalAmount * er.ExchangeRate AS TotalAmount, o.CurrencyCode, c.State
FROM Orders o WITH (NOLOCK)
INNER JOIN Customers c WITH (NOLOCK) ON o.CustomerID = c.CustomerID
INNER JOIN ExchangeRates er WITH (NOLOCK) ON o.CurrencyCode = er.CurrencyCode
WHERE o.IsInternational = 1
AND o.ShippingStatus <> ''Cancelled''
AND c.Country NOT IN (''US'', ''USA'')
AND er.EffectiveDate = (SELECT MAX(EffectiveDate) FROM ExchangeRates WHERE CurrencyCode = er.CurrencyCode)
AND o.TotalAmount > 100
AND LEN(c.Email) > 0;',
    'International'
);

-- Example 7: INSERT with three-part names (database.schema.table)
INSERT INTO SQL_Statements (StatementName, StatementText, Category)
VALUES (
    'Product Sales Analysis',
    'INSERT INTO ReportingDB.dbo.ProductSales (ProductID, ProductName, TotalSales, OrderCount, StateCode)
SELECT p.ProductID, p.ProductName, SUM(oi.Quantity * oi.UnitPrice) AS TotalSales, COUNT(DISTINCT oi.OrderID) AS OrderCount, c.State
FROM SalesDB.dbo.Products p WITH (NOLOCK)
INNER JOIN SalesDB.dbo.OrderItems oi WITH (NOLOCK) ON p.ProductID = oi.ProductID
INNER JOIN SalesDB.dbo.Orders o WITH (NOLOCK) ON oi.OrderID = o.OrderID
INNER JOIN CustomerDB.dbo.Customers c WITH (NOLOCK) ON o.CustomerID = c.CustomerID
WHERE o.OrderDate >= DATEADD(MONTH, -3, GETDATE())
AND c.State NOT IN (''AK'', ''HI'', ''PR'')
AND p.IsActive = 1
GROUP BY p.ProductID, p.ProductName, c.State;',
    'Reporting'
);

-- Example 8: INSERT with bracketed identifiers
INSERT INTO SQL_Statements (StatementName, StatementText, Category)
VALUES (
    'Customer Address Verification',
    'INSERT INTO #tmpAddressCheck ([Customer ID], [Full Name], [Street Address], [City], [State Code], [Zip Code])
SELECT c.[CustomerID], c.[First Name] + '' '' + c.[Last Name], a.[Address Line 1], a.[City Name], a.[State], a.[Postal Code]
FROM [Customer Database].dbo.[Customer Master] c WITH (NOLOCK)
INNER JOIN [Customer Database].dbo.[Address Records] a WITH (NOLOCK) ON c.[CustomerID] = a.[Customer ID]
WHERE a.[Address Type] = ''Primary''
AND a.[Is Validated] = 1
AND a.[State] NOT IN (''AK'', ''HI'')
AND c.[Account Status] = ''Active'';',
    'Validation'
);

-- Example 9: INSERT with CASE statements
INSERT INTO SQL_Statements (StatementName, StatementText, Category)
VALUES (
    'Order Priority Assignment',
    'INSERT INTO #tmpOrderPriority (OrderID, CustomerID, Priority, StateCode, TotalAmount)
SELECT o.OrderID, o.CustomerID, CASE WHEN o.TotalAmount > 1000 THEN ''High'' WHEN o.TotalAmount > 500 THEN ''Medium'' ELSE ''Low'' END AS Priority, c.State, o.TotalAmount
FROM Orders o WITH (NOLOCK)
INNER JOIN Customers c WITH (NOLOCK) ON o.CustomerID = c.CustomerID
WHERE o.Status IN (''Pending'', ''Processing'')
AND c.State NOT IN (''AK'', ''HI'', ''PR'')
AND o.OrderDate >= DATEADD(DAY, -7, GETDATE());',
    'Operations'
);

-- Example 10: INSERT with CAST/CONVERT
INSERT INTO SQL_Statements (StatementName, StatementText, Category)
VALUES (
    'Customer Demographics',
    'INSERT INTO #tmpDemographics (CustomerID, Name, Age, JoinDate, StateCode, ZipCode)
SELECT c.CustomerID, c.FirstName + '' '' + c.LastName, DATEDIFF(YEAR, c.BirthDate, GETDATE()) AS Age, CAST(c.CreatedDate AS DATE) AS JoinDate, c.State, CAST(LEFT(c.ZipCode, 5) AS INT) AS ZipCode
FROM Customers c WITH (NOLOCK)
WHERE c.BirthDate IS NOT NULL
AND c.State NOT IN (''AK'', ''HI'')
AND CAST(c.CreatedDate AS DATE) >= ''2024-01-01''
AND LEN(c.ZipCode) >= 5;',
    'Demographics'
);

GO

-- Query to view all statements
SELECT
    StatementID,
    StatementName,
    Category,
    LEFT(StatementText, 100) + '...' AS Preview,
    CreatedDate
FROM SQL_Statements
ORDER BY Category, StatementName;
GO

-- Instructions for using with the SQL Visualization Tool:
-- 1. Execute this script to create and populate SQL_Statements table
-- 2. In the visualization tool:
--    - Connect to your database
--    - Select "SQL_Statements" as the table
--    - Enter "StatementText" as the column name
--    - Click "Fetch Statements"
--    - Click "Parse & Visualize"
-- 3. You should see:
--    - Visual graph showing table relationships
--    - List of all tables used across statements
--    - All JOINs with their conditions
--    - All WHERE conditions organized by table
-- 4. Use the WHERE Condition Rewriter to:
--    - Select conditions to apply across statements
--    - Preview changes before applying
--    - Update statements in the database
