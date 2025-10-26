-- Example Stored Procedure for SQL Visualization Tool
-- This demonstrates various SQL patterns that the tool can parse and visualize

CREATE PROCEDURE usp_ProcessCustomerOrders
    @StartDate DATE = NULL,
    @EndDate DATE = NULL,
    @MinOrderAmount DECIMAL(10,2) = 0
AS
BEGIN
    SET NOCOUNT ON;

    -- Declare variables
    DECLARE @ProcessDate DATETIME = GETDATE();

    -- Create temp table for staging data
    CREATE TABLE #tmpCustomerOrders (
        OrderID INT,
        CustomerID INT,
        CustomerName VARCHAR(100),
        OrderDate DATE,
        TotalAmount DECIMAL(10,2),
        OrderStatus VARCHAR(50),
        ProductCount INT,
        StateCode VARCHAR(2)
    );

    -- Insert active customers with recent orders
    INSERT INTO #tmpCustomerOrders (
        OrderID,
        CustomerID,
        CustomerName,
        OrderDate,
        TotalAmount,
        OrderStatus,
        ProductCount,
        StateCode
    )
    SELECT
        o.OrderID,
        c.CustomerID,
        c.FirstName + ' ' + c.LastName AS CustomerName,
        o.OrderDate,
        o.TotalAmount,
        o.Status AS OrderStatus,
        COUNT(oi.ProductID) AS ProductCount,
        c.State AS StateCode
    FROM Orders o WITH (NOLOCK)
    INNER JOIN Customers c WITH (NOLOCK)
        ON o.CustomerID = c.CustomerID
    INNER JOIN OrderItems oi WITH (NOLOCK)
        ON o.OrderID = oi.OrderID
    WHERE o.OrderDate >= COALESCE(@StartDate, DATEADD(DAY, -30, GETDATE()))
        AND o.OrderDate <= COALESCE(@EndDate, GETDATE())
        AND o.TotalAmount >= @MinOrderAmount
        AND o.Status = 'Completed'
        AND c.IsActive = 1
        AND c.State NOT IN ('AK', 'HI', 'PR')
    GROUP BY
        o.OrderID,
        c.CustomerID,
        c.FirstName,
        c.LastName,
        o.OrderDate,
        o.TotalAmount,
        o.Status,
        c.State;

    -- Insert pending orders that need review
    INSERT INTO #tmpCustomerOrders (
        OrderID,
        CustomerID,
        CustomerName,
        OrderDate,
        TotalAmount,
        OrderStatus,
        ProductCount,
        StateCode
    )
    SELECT
        o.OrderID,
        c.CustomerID,
        CONCAT(c.FirstName, ' ', c.LastName) AS CustomerName,
        o.OrderDate,
        o.TotalAmount,
        o.Status,
        (SELECT COUNT(*) FROM OrderItems oi2 WHERE oi2.OrderID = o.OrderID) AS ProductCount,
        c.State
    FROM Orders o (NOLOCK)
    LEFT JOIN Customers c (NOLOCK)
        ON o.CustomerID = c.CustomerID
    LEFT JOIN #tmpCustomerOrders tmp (NOLOCK)
        ON o.OrderID = tmp.OrderID
    WHERE o.Status IN ('Pending', 'Processing')
        AND o.TotalAmount > 100
        AND tmp.OrderID IS NULL
        AND c.Email IS NOT NULL
        AND LEN(c.Email) > 0;

    -- Insert high-value customers from loyalty program
    INSERT INTO #tmpCustomerOrders (
        OrderID,
        CustomerID,
        CustomerName,
        OrderDate,
        TotalAmount,
        OrderStatus,
        ProductCount,
        StateCode
    )
    SELECT
        o.OrderID,
        lp.CustomerID,
        UPPER(c.FirstName) + ' ' + UPPER(c.LastName) AS CustomerName,
        o.OrderDate,
        o.TotalAmount,
        o.Status,
        oi.ItemCount,
        c.State
    FROM LoyaltyProgram lp WITH (NOLOCK)
    INNER JOIN Customers c WITH (NOLOCK)
        ON lp.CustomerID = c.CustomerID
    INNER JOIN Orders o WITH (NOLOCK)
        ON c.CustomerID = o.CustomerID
    LEFT JOIN (
        SELECT OrderID, COUNT(*) AS ItemCount
        FROM OrderItems
        GROUP BY OrderID
    ) oi
        ON o.OrderID = oi.OrderID
    WHERE lp.MembershipLevel IN ('Gold', 'Platinum')
        AND lp.PointsBalance >= 1000
        AND c.State NOT IN ('AK', 'HI')
        AND o.OrderDate >= DATEADD(MONTH, -6, GETDATE())
        AND NOT EXISTS (
            SELECT 1
            FROM #tmpCustomerOrders tmp
            WHERE tmp.OrderID = o.OrderID
        );

    -- Insert international orders with special handling
    INSERT INTO #tmpCustomerOrders (
        OrderID,
        CustomerID,
        CustomerName,
        OrderDate,
        TotalAmount,
        OrderStatus,
        ProductCount,
        StateCode
    )
    SELECT
        o.OrderID,
        c.CustomerID,
        c.FirstName + ' ' + c.LastName,
        o.OrderDate,
        o.TotalAmount * er.ExchangeRate AS TotalAmount,
        o.Status,
        COUNT(DISTINCT oi.ProductID),
        c.State
    FROM Orders o WITH (NOLOCK)
    INNER JOIN Customers c WITH (NOLOCK)
        ON o.CustomerID = c.CustomerID
    INNER JOIN ExchangeRates er WITH (NOLOCK)
        ON o.CurrencyCode = er.CurrencyCode
    LEFT JOIN OrderItems oi WITH (NOLOCK)
        ON o.OrderID = oi.OrderID
    WHERE o.IsInternational = 1
        AND o.ShippingStatus <> 'Cancelled'
        AND c.Country NOT IN ('US', 'USA')
        AND er.EffectiveDate = (
            SELECT MAX(EffectiveDate)
            FROM ExchangeRates
            WHERE CurrencyCode = er.CurrencyCode
        )
    GROUP BY
        o.OrderID,
        c.CustomerID,
        c.FirstName,
        c.LastName,
        o.OrderDate,
        o.TotalAmount,
        er.ExchangeRate,
        o.Status,
        c.State
    HAVING COUNT(DISTINCT oi.ProductID) > 2;

    -- Delete cancelled orders older than 90 days
    DELETE FROM #tmpCustomerOrders
    WHERE OrderStatus = 'Cancelled'
        AND OrderDate < DATEADD(DAY, -90, GETDATE());

    -- Delete duplicate entries (keep the one with highest amount)
    DELETE t1
    FROM #tmpCustomerOrders t1
    INNER JOIN #tmpCustomerOrders t2
        ON t1.OrderID = t2.OrderID
        AND t1.TotalAmount < t2.TotalAmount;

    -- Delete orders from excluded states
    DELETE o
    FROM #tmpCustomerOrders o
    WHERE o.StateCode IN ('AK', 'HI', 'PR', 'GU', 'VI')
        OR o.StateCode IS NULL;

    -- Delete test orders
    DELETE FROM #tmpCustomerOrders
    WHERE CustomerName LIKE '%TEST%'
        OR CustomerName LIKE '%DEMO%'
        OR TotalAmount = 0;

    -- Return final results
    SELECT
        OrderID,
        CustomerID,
        CustomerName,
        OrderDate,
        TotalAmount,
        OrderStatus,
        ProductCount,
        StateCode,
        @ProcessDate AS ProcessedDate
    FROM #tmpCustomerOrders
    ORDER BY TotalAmount DESC, OrderDate DESC;

    -- Clean up
    DROP TABLE #tmpCustomerOrders;

    RETURN 0;
END;
GO

-- Example execution
-- EXEC usp_ProcessCustomerOrders @StartDate = '2025-01-01', @EndDate = '2025-12-31', @MinOrderAmount = 50.00;
