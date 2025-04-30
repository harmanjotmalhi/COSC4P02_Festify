/**
 * @jest-environment jsdom
 */
// Mock firebase.js module
jest.mock('../firebase.js', () => {
  
    const onAuthChangedCallback = jest.fn();
    return {
        signUpUser: jest.fn(),
        signInUser: jest.fn(),
        saveUserProfile: jest.fn(),
        onUserStateChanged: jest.fn((callback) => {
          // Store the callback for testing        
          onAuthChangedCallback.mockImplementation(callback);
          // Simulate a user being logged in
          callback({ email: 'test@example.com', uid: '123' });
          
         
        }),

    };
});

import '../organizer.js';


describe('organizer.js module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up console spy
    jest.spyOn(console, 'log');
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  it('should log when user is logged in', () => {
    //Require organizer.js to call the function

    
    //Get onUserStateChanged from the mock
    const onUserStateChangedMock = require('../firebase.js').onUserStateChanged;
    

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('User logged in:'),
      'test@example.com'
    );

  });
});