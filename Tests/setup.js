// Mock window objects and APIs that might not be available in the test environment
if (typeof window !== 'undefined') {
  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    writable: true
  });

  // Mock sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    },
    writable: true
  });

  // Mock location
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost/',
      pathname: '/',
      search: '',
      hash: '',
      reload: jest.fn(),
      replace: jest.fn(),
      assign: jest.fn()
    },
    writable: true
  });

  // Mock alert, confirm, and prompt
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  window.prompt = jest.fn(() => '');
  
  // Mock fetch API if needed
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
    })
  );
}

// Add any other global mocks or setup needed for all tests

// Clean up after each test
afterEach(() => {
  // Reset all mocks
  jest.clearAllMocks();
  
  // Cleanup document body if needed
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '';
  }
}); 