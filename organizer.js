// organizer.js
import { signUpUser, signInUser, saveUserProfile, onUserStateChanged } from './firebase.js';

// Listen for auth state changes (optional)
onUserStateChanged(user => {
  if (user) {
    console.log("User logged in:", user.email);
  }
});



