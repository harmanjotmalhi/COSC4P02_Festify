# Festify Testing

This directory contains the automated tests for the Festify project.

## Running Tests

### Using NPM Script
```bash
npm test
```

### Using Batch File (Windows)
```bash
./run-tests.bat
```

### Using PowerShell (Windows)
```bash
./run-tests.ps1
```

## Test Coverage

Test coverage reports are generated automatically when running tests. You can view the HTML coverage report at:
```
coverage/lcov-report/index.html
```

## Test Structure

- `app.test.js` - Tests for app.js (event rendering and filtering)
- `firebase.test.js` - Tests for firebase.js (database operations)
- `inline.test.js` - Tests for inline.js (utility functions)
- `organizer.test.js` - Tests for organizer.js (organizer-specific functions)
- `script.test.js` - Tests for script.js (general utility functions)

## Mock Files

Mocks for external dependencies are located in the `__mocks__` directory:

- Firebase SDK mocks
- Style mocks
- File mocks

## Configuration

Jest is configured in `jest.config.js` with the following settings:

- Uses jsdom test environment
- Collects coverage information
- Ignores node_modules and other non-source directories
- Transforms JS files using Babel
- Provides mocks for CSS and static files

## Adding Tests

When adding tests for new features:

1. Create or update test files in the `Tests` directory
2. Run tests to verify coverage
3. Update mocks as needed for new external dependencies 