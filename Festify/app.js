import { fetchEvents, updateTickets } from './firebase.js';

let currentEvent = null;
let slideIndex = 0;

// Format time from 24-hour to 12-hour format with AM/PM
function formatTime(time) {
  const [hour, minute] = time.split(':');
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minute} ${suffix}`;
}

// Create HTML for an event card
function createEventCard(event, eventId) {
  const eventData = encodeURIComponent(JSON.stringify(event));
  return `
    <div class="event-card" onclick="showEventPopup('${eventData}', '${eventId}')" style="cursor: pointer;">
      <div class="event-image-container">
        <img src="${event.imageUrl}" alt="${event.title}" class="event-image">
        <div class="event-price">${event.generalPrice ? `$${event.generalPrice}` : 'N/A'}</div>
      </div>
      <div class="event-details">
        <h3 class="event-title">${event.title}</h3>
        <div class="event-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>${event.date}</span>
        </div>
        <div class="event-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>${formatTime(event.startTime)} - ${formatTime(event.endTime)}</span>
        </div>
        <div class="event-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 10c0 6-9 13-9 13S3 16 3 10a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>${event.location}</span>
        </div>
      </div>
    </div>
  `;
}

// Show event popup with event details and initialize slider
window.showEventPopup = function(encodedEventData, eventId) {
  console.log("working");
  try {
    if (!encodedEventData) throw new Error("No event data provided");
    
    const eventData = decodeURIComponent(encodedEventData);
    const event = JSON.parse(eventData);
    console.log(event);
    
    currentEvent = event;
    
    document.getElementById("eventID").value = eventId;
    console.log(document.getElementById("eventID").value);
    const titleElem = document.getElementById('eventTitle');
    if (titleElem) titleElem.textContent = event.title || '';
    
    const descElem = document.getElementById('eventDescription');
    if (descElem) descElem.textContent = event.description || '';
    
    const dateElem = document.getElementById('eventDate');
    if (dateElem) dateElem.textContent = event.date || '';
    
    const timeElem = document.getElementById('eventTime');
    if (timeElem) timeElem.textContent = `${formatTime(event.startTime)} - ${formatTime(event.endTime)}` || '';
    
    const locationElem = document.getElementById('eventLocation');
    if (locationElem) locationElem.textContent = event.location || '';
    
    // Update ticket prices
    const generalPriceElem = document.getElementById('generalPrice');
    if (generalPriceElem) {
      generalPriceElem.textContent = event.generalPrice ? `$${event.generalPrice}` : 'N/A';
    }
    
    // Senior tickets
    const seniorTickets = document.getElementById('seniorTickets');
    if (seniorTickets) {
      if (event.seniorPrice) {
        seniorTickets.style.display = 'grid';
        const seniorPriceElem = document.getElementById('seniorPrice');
        if (seniorPriceElem) {
          seniorPriceElem.textContent = `$${event.seniorPrice}`;
        }
      } else {
        seniorTickets.style.display = 'none';
      }
    }
    
    // Child tickets
    const childTickets = document.getElementById('childTickets');
    if (childTickets) {
      if (event.childPrice) {
        childTickets.style.display = 'grid';
        const childPriceElem = document.getElementById('childPrice');
        if (childPriceElem) {
          childPriceElem.textContent = `$${event.childPrice}`;
        }
      } else {
        childTickets.style.display = 'none';
      }
    }
    
    // Reset ticket quantities
    const generalQty = document.getElementById('generalQuantity');
    if (generalQty) generalQty.value = '0';
    const seniorQty = document.getElementById('seniorQuantity');
    if (seniorQty) seniorQty.value = '0';
    const childQty = document.getElementById('childQuantity');
    if (childQty) childQty.value = '0';
    
    // Set images for slider
    const eventImage1 = document.getElementById('eventImage1');
    if (eventImage1) eventImage1.src = event.imageUrl || '';
    const eventImage2 = document.getElementById('eventImage2');
    if (eventImage2) eventImage2.src = event.imageUrl2 || '';
    const eventImage3 = document.getElementById('eventImage3');
    if (eventImage3) eventImage3.src = event.imageUrl3 || '';
    
    // Initialize slider
    slideIndex = 0;
    showSlide(slideIndex);
    
    // Show popup
    const contentElem = document.getElementById('content');
    if (contentElem) contentElem.classList.add('active');
    else console.warn("Element with id 'content' not found.");
    
    const popupElem = document.getElementById('eventPopup');
    if (popupElem) {
      popupElem.classList.remove('hidden');
    } else {
      console.error("Element with id 'eventPopup' not found.");
      return;
    }
    document.body.classList.add('popup-open');
  } catch (error) {
    console.error('Error showing event popup:', error);
  }

};

// Close event popup
window.closeEventPopup = function() {
  const contentElem = document.getElementById('content');
  if (contentElem) contentElem.classList.remove('active');
  
  const popupElem = document.getElementById('eventPopup');
  if (popupElem) popupElem.classList.add('hidden');
  
  document.body.classList.remove('popup-open');
};

// Update ticket quantities
window.updateQuantity = function(type, change) {
  const input = document.getElementById(`${type}Quantity`);
  if (!input) return;
  const currentVal = parseInt(input.value, 10) || 0;
  input.value = Math.max(0, currentVal + change);
};

// Slider functionality
function showSlide(n) {
  const slides = document.getElementsByClassName('slide');
  if (!slides || slides.length === 0) return;
  
  // Loop around if out of bounds
  if (n >= slides.length) { slideIndex = 0; }
  if (n < 0) { slideIndex = slides.length - 1; }
  
  // Hide all slides
  for (let i = 0; i < slides.length; i++) {
    slides[i].style.display = 'none';
  }
  
  // Show current slide
  slides[slideIndex].style.display = 'block';
}

window.nextSlide = function() {
  slideIndex++;
  showSlide(slideIndex);
};

window.prevSlide = function() {
  slideIndex--;
  showSlide(slideIndex);
};

// Render events in the grid
function renderEvents(events) {
  const eventsGrid = document.getElementById('eventsGrid');
  if (eventsGrid) {
    eventsGrid.innerHTML = events.map(event => createEventCard(event,event.id)).join('');
  }
}

// Fetch and render events from the database
async function renderEventsFromDB() {
  try {
    const events = await fetchEvents();
    if (!events || events.length === 0) {
      const eventsGrid = document.getElementById('eventsGrid');
      if (eventsGrid) eventsGrid.innerHTML = '<p>No events found</p>';
      return;
    }
    console.log("hello", events);
    renderEvents(events);
  } catch (error) {
    console.error("Error rendering events:", error);
    const eventsGrid = document.getElementById('eventsGrid');
    if (eventsGrid) eventsGrid.innerHTML = '<p>Error loading events</p>';
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  renderEventsFromDB();
  
  // Load footer if available
  fetch('pageFooter.html')
    .then(response => response.text())
    .then(data => { document.body.insertAdjacentHTML('beforeend', data); })
    .catch(error => console.error('Error loading footer:', error));
});

 export function checkout(){
    const generalQuantity = parseInt(document.getElementById('generalQuantity').value);
    const seniorQuantity = parseInt(document.getElementById('seniorQuantity').value);
    const childQuantity = parseInt(document.getElementById('childQuantity').value);

    if(generalQuantity === 0 && seniorQuantity === 0 && childQuantity === 0){
      alert("Please Select Ticket(s)");
      return;
    }
    const eventPopup = document.getElementById("eventPopup");
    const paymentBtn = document.getElementById("paymentBtn");
    paymentBtn.classList.add('hidden');

      if (eventPopup) {
          eventPopup.insertAdjacentHTML("beforeend", `
            <div class="payment-container">

              <h2>Payment</h2>

              <h3>Billing Information</h3>
              <div class="input-group">
              <div class="flex-container">
                <div class="input-group">
                  <label>First Name</label>
                  <input type="text" placeholder="John" required>
                </div>
                <div class="input-group">
                  <label>Last Name</label>
                  <input type="text" placeholder="Doe" required>
                </div>
              </div>
              <div class="input-group">
                <label>Email</label>
                <input type="text" placeholder="johndoe@gmail.com" required>
              </div>
              
              <h3>Pay with</h3>
              <div class="card-icons">
                <img src="https://upload.wikimedia.org/wikipedia/commons/0/04/Visa.svg" alt="Visa">
                <img src="https://upload.wikimedia.org/wikipedia/commons/b/b7/MasterCard_Logo.svg" alt="MasterCard">
              </div>
              <div class="input-group">
                <label>Card number</label>
                <input type="text" placeholder="1234 5678 9012 3456" required>
              </div>
              <div class="flex-container">
                <div class="input-group">
                  <label>Expiry date</label>
                  <input type="text" placeholder="MM/YY" required>
                </div>
                <div class="input-group">
                  <label>Security code (CVV)</label>
                  <input type="text" placeholder="123" required>
                </div>
              </div>
              <button class="pay-btn" onclick="submitPayment()">Pay</button>
            </div>
          `);
      } else {
          console.error("eventPopup element not found!");
      }
      
  }

export function submitPayment(){
    const eventID = document.getElementById("eventID").value;
    const quantity = parseInt(document.getElementById('generalQuantity').value) + parseInt(document.getElementById('seniorQuantity').value) + parseInt(document.getElementById('childQuantity').value);
    updateTickets(eventID,quantity);
  }

  window.checkout = checkout;
  window.submitPayment = submitPayment;
