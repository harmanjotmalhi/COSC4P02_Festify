import { fetchEvents, updateTickets, saveUserTicket, updateRevenue } from './firebase.js';
import { sendTicketConfirmationEmailNoQR } from './email.js';

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
  const isBoosted = event.boost === "boost";
  return `
    <div class="event-card ${isBoosted ? 'boosted' : ''}" onclick="showEventPopup('${eventData}', '${eventId}')" style="cursor: pointer;">
      ${isBoosted ? '<div class="boost-badge">🔥 Featured</div>' : ''}

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
    
    // Reset ticket quantities and total price
    const generalQty = document.getElementById('generalQuantity');
    if (generalQty) generalQty.value = '0';
    const seniorQty = document.getElementById('seniorQuantity');
    if (seniorQty) seniorQty.value = '0';
    const childQty = document.getElementById('childQuantity');
    if (childQty) childQty.value = '0';
    
    // Reset total price display
    const totalPriceElement = document.getElementById('totalPrice');
    if (totalPriceElement) {
      totalPriceElement.textContent = '$0.00';
    }
    
    // Remove any existing payment container
    const existingPaymentContainer = document.querySelector('.payment-container');
    if (existingPaymentContainer) {
      existingPaymentContainer.remove();
    }
    
    // Show the payment button
    const paymentBtn = document.getElementById('paymentBtn');
    if (paymentBtn) {
      paymentBtn.classList.remove('hidden');
    }
    
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
  
  // Reset total price display
  const totalPriceElement = document.getElementById('totalPrice');
  if (totalPriceElement) {
    totalPriceElement.textContent = '$0.00';
  }
  
  // Reset payment section visibility
  const paymentContainer = document.querySelector('.payment-container');
  if (paymentContainer) {
    paymentContainer.remove();
  }
  
  // Show the payment button again
  const paymentBtn = document.getElementById('paymentBtn');
  if (paymentBtn) {
    paymentBtn.classList.remove('hidden');
  }
  
  document.body.classList.remove('popup-open');
};

// Update ticket quantities
window.updateQuantity = function(type, change) {
  const input = document.getElementById(`${type}Quantity`);
  if (!input) return;
  const currentVal = parseInt(input.value, 10) || 0;
  input.value = Math.max(0, currentVal + change);
  
  // Calculate and update total price after quantity change
  updateTotalPrice();
};

// Calculate and display total price
function updateTotalPrice() {
  if (!currentEvent) return;
  
  // Get quantities
  const generalQty = parseInt(document.getElementById('generalQuantity').value) || 0;
  const seniorQty = parseInt(document.getElementById('seniorQuantity').value) || 0;
  const childQty = parseInt(document.getElementById('childQuantity').value) || 0;
  
  // Calculate total
  let total = 0;
  total += generalQty * (currentEvent.generalPrice || 0);
  total += seniorQty * (currentEvent.seniorPrice || 0);
  total += childQty * (currentEvent.childPrice || 0);
  
  // Update total price display
  const totalPriceElement = document.getElementById('totalPrice');
  if (totalPriceElement) {
    totalPriceElement.textContent = `$${total.toFixed(2)}`;
  }
}

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
    // Sort events to put boosted ones first
    const sortedEvents = [...events].sort((a, b) => {
      if (a.boost === "boost" && b.boost !== "boost") return -1;
      if (a.boost !== "boost" && b.boost === "boost") return 1;
      return 0;
    });
    eventsGrid.innerHTML = sortedEvents.map(event => createEventCard(event, event.id)).join('');
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

export function checkout() {
  const generalQuantity = parseInt(document.getElementById('generalQuantity').value);
  const seniorQuantity = parseInt(document.getElementById('seniorQuantity').value);
  const childQuantity = parseInt(document.getElementById('childQuantity').value);

  if (generalQuantity === 0 && seniorQuantity === 0 && childQuantity === 0) {
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
            </div>
            <div class="input-group">
              <label>Email <span>*</span></label>
              <input type="email" id="email" placeholder="johndoe@gmail.com" required>
            </div>
            
            <h3>Promo Code</h3>
            <div class="promo-code-group">
              <input type="text" id="promoCode" placeholder="Enter promo code">
              <button class="apply-promo-btn" onclick="applyPromoCode()">Apply</button>
            </div>
            <div id="promoMessage" class="promo-message"></div>
            
            <h3>Pay with</h3>
            <div class="card-icons">
              <img src="https://upload.wikimedia.org/wikipedia/commons/0/04/Visa.svg" alt="Visa">
              <img src="https://upload.wikimedia.org/wikipedia/commons/b/b7/MasterCard_Logo.svg" alt="MasterCard">
            </div>
            <div class="input-group">
              <label>Card number <span>*</span></label>
              <input type="text" id="cardNumber" placeholder="1234 5678 9012 3456" required maxlength="16" oninput="this.value = this.value.replace(/[^0-9]/g, '')">
            </div>
            <div class="flex-container">
              <div class="input-group">
                <label>Expiry date <span>*</span></label>
                <input type="text" id="expiryDate" placeholder="MM/YY" required maxlength="4" oninput="this.value = this.value.replace(/[^0-9]/g, '')">
              </div>
              <div class="input-group">
                <label>Security code (CVV) <span>*</span></label>
                <input type="text" id="cvv" placeholder="123" required maxlength="3" oninput="this.value = this.value.replace(/[^0-9]/g, '')" pattern="[0-9]{3}">
              </div>
            </div>
            <div id="errorMessage" class="error-message">Please fill in all payment details</div>
            <button class="pay-btn" onclick="submitPayment()">Pay</button>
          </div>
      `);

      // Add the CSS for validation styling
      const styleElement = document.createElement('style');
      styleElement.textContent = `
          .error-message {
              color: red;
              margin-top: 10px;
              display: none;
              text-align: center;
              font-weight: bold;
          }
          
          input.error {
              border: 1px solid red;
          }

          label span {
              color: red;
          }
      `;
      document.head.appendChild(styleElement);
  } else {
      console.error("eventPopup element not found!");
  }
}

// Add promo code validation function
window.applyPromoCode = function() {
  const promoCode = document.getElementById('promoCode').value.toUpperCase();
  const promoMessage = document.getElementById('promoMessage');
  const totalPriceElement = document.getElementById('totalPrice');
  
  // Get the current total price from the event details
  const generalQuantity = parseInt(document.getElementById('generalQuantity').value) || 0;
  const seniorQuantity = parseInt(document.getElementById('seniorQuantity').value) || 0;
  const childQuantity = parseInt(document.getElementById('childQuantity').value) || 0;
  
  // Calculate total price based on ticket quantities and prices
  let totalPrice = 0;
  if (currentEvent) {
    totalPrice += generalQuantity * (currentEvent.generalPrice || 0);
    totalPrice += seniorQuantity * (currentEvent.seniorPrice || 0);
    totalPrice += childQuantity * (currentEvent.childPrice || 0);
  }

  // Valid promo codes and their discount percentages
  const validPromoCodes = {
    'WELCOME20': 0.20, // 20% off
    'FESTIVAL15': 0.15 // 15% off
  };

  if (promoCode in validPromoCodes) {
    const discount = totalPrice * validPromoCodes[promoCode];
    const discountedPrice = totalPrice - discount;
    
    promoMessage.innerHTML = `
      <div class="promo-success">
        <i class="fas fa-check-circle"></i>
        Promo code applied! You saved $${discount.toFixed(2)}
      </div>
    `;
    
    // Update the total price display
    totalPriceElement.textContent = `$${discountedPrice.toFixed(2)}`;
    
    // Store the discounted price for payment processing
    currentEvent.discountedPrice = discountedPrice;
  } else {
    promoMessage.innerHTML = `
      <div class="promo-error">
        <i class="fas fa-times-circle"></i>
        Invalid promo code
      </div>
    `;
    
    // Reset to original price if invalid code
    totalPriceElement.textContent = `$${totalPrice.toFixed(2)}`;
    currentEvent.discountedPrice = totalPrice;
  }
}

export function submitPayment() {
  // Validate form fields first
  const firstName = document.getElementById('firstName');
  const lastName = document.getElementById('lastName');
  const email = document.getElementById('email');
  const cardNumber = document.getElementById('cardNumber');
  const expiryDate = document.getElementById('expiryDate');
  const cvv = document.getElementById('cvv');
  
  // Reset previous error states
  const inputs = [firstName, lastName, email, cardNumber, expiryDate, cvv];
  const errorMessage = document.getElementById('errorMessage');
  errorMessage.style.display = 'none';
  
  inputs.forEach(input => {
      input.classList.remove('error');
  });
  
  // Check if any field is empty
  let hasError = false;

  // Validate first name
  if (!firstName.value.trim()) {
      firstName.classList.add('error');
      closeEventPopup();  // Close payment popup first
      Swal.fire({
          icon: 'warning',
          title: 'Profile Incomplete',
          text: 'Please complete profile information before purchasing tickets'
      }).then(() => {
          showSection('editProfile');
      });
      hasError = true;
      return;
  }

  // Validate last name
  if (!lastName.value.trim()) {
      lastName.classList.add('error');
      closeEventPopup();  // Close payment popup first
      Swal.fire({
          icon: 'warning',
          title: 'Profile Incomplete',
          text: 'Please complete profile information before purchasing tickets'
      }).then(() => {
          showSection('editProfile');
      });
      hasError = true;
      return;
  }

  inputs.forEach(input => {
      if (!input.value.trim(  )) {
          input.classList.add('error');
          hasError = true;
      }
  });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email.value.trim() && !emailRegex.test(email.value.trim())) {
      email.classList.add('error');
      errorMessage.textContent = "Please enter a valid email address";
      errorMessage.style.display = 'block';
      hasError = true;
  }
  
  // Validate card number length (15-16 digits)
  const cardNumberValue = cardNumber.value.replace(/\s/g, '');
  if (cardNumberValue.length < 15 || cardNumberValue.length > 16) {
      cardNumber.classList.add('error');
      errorMessage.textContent = cardNumberValue.length === 0 ? 
          "Please fill in all payment details" : 
          "Card number must be 15 or 16 digits";
      errorMessage.style.display = 'block';
      hasError = true;
  }

  // Validate expiry date format and validity
  const expiryDateValue = expiryDate.value.replace(/\s/g, '');
  if (expiryDateValue.length < 4 || expiryDateValue.length > 4) {
      expiryDate.classList.add('error');
      errorMessage.textContent = expiryDateValue.length === 0 ? 
          "Please fill in all payment details" : 
          "Expiry date must be 4 digits";
  }

  const cvvValue = cvv.value.replace(/\s/g, '');
  if (cvvValue.length !== 3) {
      cvv.classList.add('error');
      errorMessage.textContent = cvvValue.length === 0 ? 
          "Please fill in all payment details" : 
          "CVV must be 3 digits";
      errorMessage.style.display = 'block';
      hasError = true;
  }
  
  // If any validation error, show message and prevent submission
  if (hasError) {
      if (errorMessage.textContent === "Please fill in all payment details") {
          errorMessage.style.display = 'block';
      }
      return;
  }
  
  // Continue with the original payment processing if validation passes
  const eventID = document.getElementById("eventID").value;
  const generalQuantity = parseInt(document.getElementById('generalQuantity').value);
  const seniorQuantity = parseInt(document.getElementById('seniorQuantity').value);
  const childQuantity = parseInt(document.getElementById('childQuantity').value);
  const totalQuantity = generalQuantity + seniorQuantity + childQuantity;
  
  // Calculate total price
  let totalPrice = 0;
  if (currentEvent) {
      totalPrice += generalQuantity * (currentEvent.generalPrice || 0);
      totalPrice += seniorQuantity * (currentEvent.seniorPrice || 0);
      totalPrice += childQuantity * (currentEvent.childPrice || 0);
  }

  // Get the final price (either discounted or original)
  const finalPrice = currentEvent.discountedPrice || totalPrice;
  
  // Import Firebase auth
  import('https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js').then((module) => {
      const auth = module.getAuth();
      const user = auth.currentUser;
      
      if (!user) {
          alert('You need to be logged in to purchase tickets');
          return;
      }
      
      // Save ticket information
      const ticketData = {
          eventId: eventID,
          eventDetails: {
              title: currentEvent.title,
              date: currentEvent.date,
              time: `${formatTime(currentEvent.startTime)} - ${formatTime(currentEvent.endTime)}`,
              location: currentEvent.location,
              imageUrl: currentEvent.imageUrl,
              generalPrice: currentEvent.generalPrice || 0,
              seniorPrice: currentEvent.seniorPrice || 0,
              childPrice: currentEvent.childPrice || 0
          },
          tickets: {
              general: generalQuantity,
              senior: seniorQuantity,
              child: childQuantity
          },
          totalQuantity: totalQuantity,
          originalPrice: totalPrice.toFixed(2),
          finalPrice: finalPrice.toFixed(2),
          discountApplied: finalPrice < totalPrice,
          discountAmount: (totalPrice - finalPrice).toFixed(2),
          // Add user's name and email to ticket data
          name: `${firstName.value.trim()} ${lastName.value.trim()}`,
          email: email.value.trim()
      };
      
      // Save ticket to user's account
      saveUserTicket(user.uid, ticketData)
          .then((ticketId) => {
              // Add the ticket ID to the ticket data
              ticketData.id = ticketId;
              
              // Update available tickets for the event
              updateTickets(eventID, totalQuantity);
              
              // Send confirmation email WITHOUT QR code
              sendTicketConfirmationEmailNoQR(ticketData)
                .then(emailResult => {
                  const emailSent = emailResult !== null;
                  console.log('Email notification status:', emailSent ? 'Sent' : 'Failed');
                  
                  // Sweet alert for success with email status
                  Swal.fire({
                    icon: 'success',
                    title: 'Tickets purchased',
                    html: `
                      <p>Tickets purchased successfully! View them in your tickets tab.</p>
                      ${emailSent ? '<p>A confirmation email has been sent to your email.</p>' : ''}
                    `,
                  });
                })
                .catch(error => {
                  console.error('Error sending confirmation email:', error);
                  // Still show success for purchase
                  Swal.fire({
                    icon: 'success',
                    title: 'Tickets purchased',
                    text: 'Tickets purchased successfully! View them in your tickets tab.',
                  });
                })
                .finally(() => {
                  closeEventPopup();
                });
          })
          .catch(error => {
              console.error('Error saving ticket:', error);
              // Sweet alert for ticket failure
              Swal.fire({
                  icon: 'error',
                  title: 'Payment failed',
                  text: 'Payment failure alert, try again',
              });
          });
  });

  updateRevenue(eventID, finalPrice);
}

window.checkout = checkout;
window.submitPayment = submitPayment;
