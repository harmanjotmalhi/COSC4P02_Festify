import {config} from './config.js';
// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-analytics.js";
import {
  getAuth as getFirebaseAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  updateDoc,
  deleteDoc,
  increment
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-storage.js";
import { sendWelcomeEmail } from "./email.js";

// TODO: Replace with your Firebase project configuration
const firebaseConfig = {
  apiKey: config.FIREBASE_API_KEY,
  authDomain: "fir-festify.firebaseapp.com",
  projectId: "fir-festify",
  storageBucket: "fir-festify.firebasestorage.app",
  messagingSenderId: "827425396836",
  appId: "1:827425396836:web:f3e9a41e9515e3f2b3a771",
  measurementId: "G-TNBDKZEDH1"
};

const app = initializeApp(firebaseConfig);

const analytics = getAnalytics(app);

const auth = getFirebaseAuth(app);

const db = getFirestore(app);

const storage = getStorage(app);

// Store API Keys securely in Firebase
export async function storeApiKeys(customApiKeys = null) {
  try {
    // Create a reference to the apiKeys document in the "config" collection
    const apiKeysRef = doc(db, "config", "apiKeys");
    
    // Define the API keys - use custom keys if provided, otherwise use defaults
    const apiKeys = customApiKeys || {
      FIREBASE_API_KEY: config.FIREBASE_API_KEY,
      EMAIL_SERVICE_ID: config.EMAIL_SERVICE_ID,
      OPENAI_API_KEY: config.OPENAI_API_KEY,
      EMAIL_PUBLIC_KEY: config.EMAIL_PUBLIC_KEY,
      GOOGLE_MAPS_API_KEY: config.GOOGLE_MAPS_API_KEY,
    };
    
    // Add timestamp
    apiKeys.updatedAt = new Date();
    
    // Set the API keys in the document
    await setDoc(apiKeysRef, apiKeys);
    console.log("API keys stored successfully in Firebase.");
    return true;
  } catch (error) {
    console.error("Error storing API keys:", error);
    return false;
  }
}

// Fetch API Keys from Firebase
export async function fetchApiKeys() {
  try {
    // Create a reference to the apiKeys document in the "config" collection
    const apiKeysRef = doc(db, "config", "apiKeys");
    
    // Get the document
    const docSnap = await getDoc(apiKeysRef);
    
    if (docSnap.exists()) {
      const apiKeys = docSnap.data();
      
      // Store keys in localStorage for faster access (but be careful with sensitive keys)
      localStorage.setItem('festify_email_public_key', apiKeys.EMAIL_PUBLIC_KEY);
      localStorage.setItem('festify_email_service_id', apiKeys.EMAIL_SERVICE_ID);
      localStorage.setItem('festify_google_maps_api_key', apiKeys.GOOGLE_MAPS_API_KEY);
      
      // Return the API keys
      return apiKeys;
    } else {
      console.log("No API keys found in Firebase, attempting to store defaults");
      await storeApiKeys();
      return await fetchApiKeys();
    }
  } catch (error) {
    console.error("Error fetching API keys:", error);
    // Fall back to config.js keys
    return config;
  }
}

// Get a specific API key
export async function getApiKey(keyName) {
  try {
    // Check localStorage first for non-sensitive keys
    if (['EMAIL_PUBLIC_KEY', 'EMAIL_SERVICE_ID', 'GOOGLE_MAPS_API_KEY'].includes(keyName)) {
      const localKey = localStorage.getItem(`festify_${keyName.toLowerCase()}`);
      if (localKey) return localKey;
    }
    
    // If not in localStorage, fetch from Firebase
    const apiKeys = await fetchApiKeys();
    return apiKeys[keyName];
  } catch (error) {
    console.error(`Error getting API key ${keyName}:`, error);
    return null;
  }
}

/* ------------------------------
   Authentication Functions
------------------------------ */
export async function signUpUser(email, password) {
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  
  // Create a basic profile for the user
  await saveUserProfile(userCred.user.uid, {
    email: email,
    createdAt: new Date(),
    // Add any additional default fields you want for new users
  });
  
  // Send welcome email to the user
  await sendWelcomeEmail(email);
  
  return userCred;
}

export async function signInUser(email, password) {
  const userCred = await signInWithEmailAndPassword(auth, email, password);
  return userCred;
}

export function signOutUser() {
  return signOut(auth);
}

export function onUserStateChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true, message: "Password reset email sent successfully." };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return { 
      success: false, 
      message: error.message || "Failed to send password reset email." 
    };
  }
}

// Define an asynchronous function to save or update the user's profile data
export async function saveUserProfile(uid, profileData) {
  // Get the reference to the user document in the "users" collection by the provided uid
  const docRef = doc(db, "users", uid);

  // Set the profile data in the document, merging it with the existing data if any
  await setDoc(docRef, profileData, { merge: true });
}

// Function to save a ticket purchase to a user's account
export async function saveUserTicket(userId, ticketData) {
  try {
    // Create a reference to the tickets subcollection for this user
    const ticketsCollectionRef = collection(db, "users", userId, "tickets");
    
    // Add the ticket data with a timestamp
    const ticketWithTimestamp = {
      ...ticketData,
      purchasedAt: new Date(),
    };
    
    // Add the document to the tickets subcollection
    const docRef = await addDoc(ticketsCollectionRef, ticketWithTimestamp);
    console.log("Ticket saved with ID:", docRef.id);
    
    // Explicitly preserve name and email fields when saving to global tickets collection
    await saveTicketPurchase({
      ...ticketWithTimestamp,
      userId: userId,
      // Ensure these fields are explicitly included
      name: ticketData.name || 'Anonymous',
      email: ticketData.email || 'No email provided'
    });
    
    return docRef.id;
  } catch (error) {
    console.error("Error saving ticket:", error);
    throw error;
  }
}

// Function to save ticket purchase to global tickets collection
export async function saveTicketPurchase(ticketData) {
  try {
    // Create a reference to the global tickets collection
    const ticketsCollectionRef = collection(db, "tickets");
    
    // Log the incoming ticket data to verify name and email are present
    console.log("Saving ticket with user info:", {
      name: ticketData.name,
      email: ticketData.email
    });
    
    // Ensure all relevant ticket details are included, removing phone field
    const enhancedTicketData = {
      ...ticketData,
      // Make sure these fields exist (with defaults if not provided)
      // Prioritize the existing name and email
      name: ticketData.name || 'Anonymous',
      email: ticketData.email || 'No email provided',
      // Remove phone field as requested
      eventId: ticketData.eventId || '',
      tickets: ticketData.tickets || { general: 0, child: 0, senior: 0 },
      totalPrice: ticketData.totalPrice || '0.00',
      totalQuantity: ticketData.totalQuantity || 0,
      ticketType: ticketData.ticketType || 'General',
      quantity: ticketData.quantity || 1,
      pricePaid: ticketData.pricePaid || 0,
      eventDetails: ticketData.eventDetails || {},
      purchasedAt: ticketData.purchasedAt || new Date()
    };
    
    // Add the ticket data to the global tickets collection
    const docRef = await addDoc(ticketsCollectionRef, enhancedTicketData);
    console.log("Ticket purchase saved to global collection with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error saving ticket to global collection:", error);
    throw error;
  }
}

// Function to fetch all tickets for a user
export async function getUserTickets(userId) {
  try {
    // Get reference to the user's tickets subcollection
    const ticketsCollectionRef = collection(db, "users", userId, "tickets");
    
    // Get all documents in the subcollection
    const querySnapshot = await getDocs(ticketsCollectionRef);
    
    // Map the documents to an array of ticket objects with their IDs
    const tickets = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return tickets;
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    return [];
  }
}

// Define an asynchronous function to get the profile of a user by their unique ID (uid)
export async function getUserProfile(uid) {
  // Get the reference to the user document in the "users" collection by the provided uid
  const docRef = doc(db, "users", uid);

  // Fetch the document snapshot from the database
  const snapshot = await getDoc(docRef);

  // Check if the document exists and return the data, otherwise return null
  return snapshot.exists() ? snapshot.data() : null;
}


// Define an asynchronous function to fetch all events
export async function fetchEvents() {
  try {
    console.log('Attempting to fetch events from Firestore...');
    // Get the reference to the "events" collection in the database
    const eventsCol = collection(db, "events");
    console.log('Events collection reference created');

    // Execute the query to get the events snapshot
    console.log('Executing getDocs query...');
    const eventsSnapshot = await getDocs(eventsCol);
    console.log('Query executed, snapshot received');

    // Map through the snapshot documents to create an array of event objects with their id and data
    const eventsList = eventsSnapshot.docs.map(doc => {
      const data = doc.data();
      console.log('Event data:', data);
      return { id: doc.id, ...data };
    });

    console.log('Total events fetched:', eventsList.length);
    // Return the list of events
    return eventsList;
  } catch (error) {
    // Log any errors that occur during the fetch operation
    console.error("Error fetching events:", error);
    console.error("Error details:", error.message);
    console.error("Error stack:", error.stack);

    // Return an empty array in case of an error
    return [];
  }
}


// Define an asynchronous function to fetch events for a specific user
export async function fetchUserEvents(userId) {
  try {
    // Get the reference to the "events" collection in the database
    const eventsCol = collection(db, "events");

    // Create a query to filter events where the organizerId matches the provided userId
    const q = query(eventsCol, where("organizerId", "==", userId));

    // Execute the query to get the events snapshot
    const eventsSnapshot = await getDocs(q);

    // Map through the snapshot documents to create an array of event objects with their id and data
    const eventsList = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Return the list of events
    return eventsList;
  } catch (error) {
    // Log any errors that occur during the fetch operation
    console.error("Error fetching user events:", error);

    // Return an empty array in case of an error
    return [];
  }
}

// Define an asynchronous function to create a new event with the provided event data
export async function createNewEvent(eventData) {
  try {
    const docRef = await addDoc(collection(db, "events"), eventData);
    console.log("Event created with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error creating event:", error);
    throw error;
  }
}

// Define an asynchronous function to get event by ID
export async function getEventById(eventId) {
  try {
    const eventDoc = await getDoc(doc(db, "events", eventId));
    if (eventDoc.exists()) {
      return { id: eventDoc.id, ...eventDoc.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting event:", error);
    throw error;
  }
}
// Add this new function to handle image upload
export async function uploadEventImage(file) {
  try {
    const storageRef = ref(storage, 'event-images/' + Date.now() + '_' + file.name);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
}

export async function updateTickets(eventId, amount) {
  try {
    const eventRef = doc(db, "events", eventId);
    await updateDoc(eventRef, { tickets: increment(-amount) });
    console.log(`Tickets decremented by ${amount} for event: ${eventId}`);
  } catch (error) {
    console.error(`Error decrementing tickets for event ${eventId}:`, error);
  }
}

export async function updateRevenue(eventId, payment){
  try {
    const docRef = doc(db, "events", eventId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const currentRevenue = docSnap.data().totalRevenue || 0; // Get existing revenue, default to 0
      const newRevenue = currentRevenue + payment; // Add new payment

      await updateDoc(docRef, {
        totalRevenue: newRevenue
      });
    }
  } catch (error) {
    console.error("Error updating revenue:", error);
  }
}

// Define an asynchronous function to update an event
export async function updateEvent(eventId, eventData) {
  try {
    const eventRef = doc(db, "events", eventId);
    await updateDoc(eventRef, eventData);
    console.log("Event updated successfully");
    return true;
  } catch (error) {
    console.error("Error updating event:", error);
    throw error;
  }
}

export async function deleteEvent(eventId) {
  try {
    const eventRef = doc(db, "events", eventId);
    await deleteDoc(eventRef);
    return true;
  } catch (error) {
    console.error("Error deleting event:", error);
    throw error;
  }
}

// Function to save feedback to the 'feedback' collection
export async function saveFeedback(feedbackData) {
  try {
    // Create a reference to the 'feedback' collection
    const feedbackCollectionRef = collection(db, "feedback");
    
    // Add the feedback data with a timestamp
    const feedbackWithTimestamp = {
      ...feedbackData,
      createdAt: new Date(),
    };
    
    // Add the document to the 'feedback' collection
    const docRef = await addDoc(feedbackCollectionRef, feedbackWithTimestamp);
    console.log("Feedback saved with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error saving feedback:", error);
    throw error;
  }
}

// Function to get all attendees for a specific event
export async function getEventAttendees(eventId) {
  try {
    // Reference to the "tickets" collection
    const ticketsCollectionRef = collection(db, "tickets");
    
    // Create a query to get tickets for this specific event
    const q = query(ticketsCollectionRef, where("eventId", "==", eventId));
    
    // Execute the query
    const querySnapshot = await getDocs(q);
    
    // First, get all ticket purchases
    const allTickets = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Log the raw tickets data to debug
    console.log("Retrieved tickets for event:", eventId, allTickets);
    
    // Group tickets by email to consolidate purchases by the same person
    const attendeesByEmail = {};
    
    allTickets.forEach(ticket => {
      const email = ticket.email || 'No email provided';
      
      // If this is the first ticket for this email, initialize the entry
      if (!attendeesByEmail[email]) {
        attendeesByEmail[email] = {
          // Ensure we're using the name from the ticket data
          name: ticket.name || 'Anonymous',
          email: email,
          tickets: [],
          totalPaid: 0,
          purchasedAt: ticket.purchasedAt
        };
        
        // Log the name we're using
        console.log(`Setting attendee name for ${email}: "${ticket.name}"`);
      }
      
      // Handle different ticket structures
      if (ticket.tickets && typeof ticket.tickets === 'object') {
        // New structure with general, child, senior counts
        const { general, child, senior } = ticket.tickets;
        
        if (general && general > 0) {
          attendeesByEmail[email].tickets.push({
            ticketType: 'General',
            quantity: general,
            pricePaid: parseFloat(ticket.totalPrice) || 0
          });
        }
        
        if (child && child > 0) {
          attendeesByEmail[email].tickets.push({
            ticketType: 'Child',
            quantity: child,
            pricePaid: 0 // Price is included in totalPrice
          });
        }
        
        if (senior && senior > 0) {
          attendeesByEmail[email].tickets.push({
            ticketType: 'Senior',
            quantity: senior,
            pricePaid: 0 // Price is included in totalPrice
          });
        }
        
        // Update total paid using the ticket's totalPrice
        attendeesByEmail[email].totalPaid += parseFloat(ticket.totalPrice || 0);
      } else {
        // Legacy structure with ticketType and quantity
        attendeesByEmail[email].tickets.push({
          ticketType: ticket.ticketType || 'General',
          quantity: ticket.quantity || 1,
          pricePaid: ticket.pricePaid || 0
        });
        
        // Update total paid
        attendeesByEmail[email].totalPaid += (ticket.pricePaid || 0);
      }
      
      // Keep the earliest purchase date
      if (ticket.purchasedAt && attendeesByEmail[email].purchasedAt) {
        const currentDate = ticket.purchasedAt.toDate ? ticket.purchasedAt.toDate() : new Date(ticket.purchasedAt);
        const existingDate = attendeesByEmail[email].purchasedAt.toDate 
          ? attendeesByEmail[email].purchasedAt.toDate() 
          : new Date(attendeesByEmail[email].purchasedAt);
          
        if (currentDate < existingDate) {
          attendeesByEmail[email].purchasedAt = ticket.purchasedAt;
        }
      }
    });
    
    // Convert the attendees object to an array
    const attendees = Object.values(attendeesByEmail);
    
    // Log the final attendees data
    console.log("Final processed attendees:", attendees);
    
    return attendees;
  } catch (error) {
    console.error("Error fetching event attendees:", error);
    return [];
  }
}

// Function to get feedback for a specific event
export async function getEventFeedback(eventId) {
  try {
    // Reference to the "feedback" collection
    const feedbackCollectionRef = collection(db, "feedback");
    
    // Create a query to get feedback for this specific event
    const q = query(feedbackCollectionRef, where("eventId", "==", eventId));
    
    // Execute the query
    const querySnapshot = await getDocs(q);
    
    // Map the feedback data
    const feedbackData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return feedbackData;
  } catch (error) {
    console.error("Error fetching event feedback:", error);
    throw error;
  }
}

// Function to update user's subscription status
export async function updateUserSubscription(userId, status) {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      subscriptionStatus: status,
      subscriptionUpdatedAt: new Date()
    });
    console.log(`User ${userId} subscription updated to ${status}`);
    return true;
  } catch (error) {
    console.error("Error updating subscription status:", error);
    throw error;
  }
}

// Function to check if user has already submitted feedback for an event
export async function hasUserSubmittedFeedback(userId, eventId) {
  try {
    const feedbackCollectionRef = collection(db, "feedback");
    const q = query(
      feedbackCollectionRef,
      where("userId", "==", userId),
      where("eventId", "==", eventId)
    );
    
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error checking existing feedback:", error);
    throw error;
  }
}

// Export auth functions
export function getAuth() {
  return auth;
}