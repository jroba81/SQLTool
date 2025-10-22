# Contributing Guide

## Overview

This project visualizes SQL INSERT statements and their table relationships. Contributions are welcome!

## Architecture

### Backend (Node.js/Express)
- `server.js` - Main Express server
- `api/database.js` - Database connection and SQL parsing API
- Uses `node-sql-parser` for parsing SQL statements
- Uses `mysql2` for database connectivity

### Frontend (Vanilla JavaScript)
- `public/index.html` - Main UI structure
- `public/css/style.css` - Styling
- `public/js/api.js` - API communication layer
- `public/js/visualizer.js` - Graph visualization (vis.js)
- `public/js/app.js` - Main application logic

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up database using `examples/sample_setup.sql`
4. Copy `config/database.example.json` to `config/database.json`
5. Update database credentials
6. Run: `npm start` or `npm run dev` (for auto-reload)

## Adding Features

### Adding Support for New SQL Statement Types

Currently supports INSERT statements. To add support for other types:

1. Update `extractStatementInfo()` in `api/database.js`
2. Add new extraction logic for the statement type
3. Update frontend to display new data

### Enhancing Visualization

To add new visualization features:

1. Modify `Visualizer.visualize()` in `public/js/visualizer.js`
2. Update vis.js network options
3. Add new node/edge types or colors

### Adding New Database Support

Currently supports MySQL. To add PostgreSQL, SQLite, etc.:

1. Install appropriate driver (e.g., `pg`, `sqlite3`)
2. Update `api/database.js` to handle different connection types
3. Update parser options for different SQL dialects

## Code Style

- Use ES6+ features
- Follow existing formatting
- Add comments for complex logic
- Keep functions focused and small

## Testing

Before submitting:

1. Test database connection with various credentials
2. Test with different SQL statement patterns
3. Verify visualization renders correctly
4. Check for console errors
5. Test error handling

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Commit with clear messages
6. Push to your fork
7. Submit a pull request

## Ideas for Contributions

- Support for UPDATE, DELETE, and other SQL statements
- PostgreSQL/SQLite support
- Export to different formats (PNG, SVG, PDF)
- Better error messages and validation
- Performance improvements for large datasets
- Additional visualization options
- Dark mode
- Save/load visualizations
- Share visualizations via URL
- SQL statement editor with syntax highlighting

## Questions?

Open an issue for discussion before starting major changes.
