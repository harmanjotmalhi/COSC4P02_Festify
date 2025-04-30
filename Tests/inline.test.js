/**
 * @jest-environment jsdom
 */

// Import the functions we want to test from our new module
import { toggle, closePopup, handleSignIn, handleSignUp } from '../inline.js';

describe('Inline JS functions from index.html', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="content" class="active"></div>
      <div id="popup" class="hidden"></div>
      <form id="authForm">
        <input type="email" id="loginEmail" value="test@example.com">
        <input type="password" id="loginPassword" value="password">
        <button id="signInBtn">Sign In</button>
        <button id="signUpBtn">Sign Up</button>
      </form>
    `;
    
    // Attach functions to window for compatibility if needed
    window.toggle = toggle;
    window.closePopup = closePopup;
  });

  test('toggle() should remove "active" and "hidden" classes when toggled', () => {
    const content = document.getElementById('content');
    const popup = document.getElementById('popup');

    // Initially, content has "active" and popup has "hidden"
    expect(content.classList.contains('active')).toBe(true);
    expect(popup.classList.contains('hidden')).toBe(true);

    // After toggle, classes should be removed
    toggle();
    expect(content.classList.contains('active')).toBe(false);
    expect(popup.classList.contains('hidden')).toBe(false);

    // Toggling again re-adds the classes
    toggle();
    expect(content.classList.contains('active')).toBe(true);
    expect(popup.classList.contains('hidden')).toBe(true);
  });

  test('closePopup() should remove "active" from content and add "hidden" to popup', () => {
    // Simulate open state
    const content = document.getElementById('content');
    const popup = document.getElementById('popup');
    content.classList.add('active');
    popup.classList.remove('hidden');

    closePopup();
    expect(content.classList.contains('active')).toBe(false);
    expect(popup.classList.contains('hidden')).toBe(true);
  });

  // Optionally, test login event handlers by mocking firebase functions:
  test('Login form sign in and sign up click handlers should call respective functions', async () => {
    // Set up dummy implementations for signInUser and signUpUser
    const signInUser = jest.fn().mockResolvedValue();
    const signUpUser = jest.fn().mockResolvedValue();

    // Attach event listeners using our imported handlers
    const signInBtn = document.getElementById('signInBtn');
    const signUpBtn = document.getElementById('signUpBtn');

    signInBtn.addEventListener('click', (e) => handleSignIn(e, signInUser));
    signUpBtn.addEventListener('click', (e) => handleSignUp(e, signUpUser));

    // Simulate clicking the sign in button
    const signInEvent = new MouseEvent('click', { bubbles: true });
    signInBtn.dispatchEvent(signInEvent);
    await Promise.resolve(); // wait for async handlers
    expect(signInUser).toHaveBeenCalledWith('test@example.com', 'password');

    // Reset window.location.href
    delete window.location;
    window.location = { href: '' };

    // Simulate clicking the sign up button
    const signUpEvent = new MouseEvent('click', { bubbles: true });
    signUpBtn.dispatchEvent(signUpEvent);
    await Promise.resolve();
    expect(signUpUser).toHaveBeenCalledWith('test@example.com', 'password');
  });
});