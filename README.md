# SQL INSERT Statement Visualizer

A JavaScript-based web application that connects to SQL databases, reads INSERT statements, and provides visual representations of table relationships including WHERE clauses and JOINs.

## Features

- Connect to SQL databases (MySQL/MariaDB)
- Parse SQL INSERT statements from database tables
- Visualize table relationships
- Display WHERE clause conditions
- Handle JOIN relationships
- Interactive graph visualization

## Installation

```bash
npm install
```

## Configuration

Create a `config/database.json` file with your database credentials:

```json
{
  "host": "localhost",
  "user": "your_username",
  "password": "your_password",
  "database": "your_database"
}
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Enter your database connection details or use the default configuration
4. Specify the table containing SQL INSERT statements
5. View the visualization of table relationships

## Project Structure

- `server.js` - Express backend server
- `public/` - Frontend files
  - `index.html` - Main UI
  - `js/parser.js` - SQL parsing logic
  - `js/visualizer.js` - Visualization logic
  - `css/style.css` - Styling
- `api/` - Backend API routes
  - `database.js` - Database connection handler

## Technologies Used

- **Backend**: Node.js, Express
- **Database**: MySQL2
- **SQL Parsing**: node-sql-parser
- **Visualization**: vis.js (network graphs)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3

## License

MIT
