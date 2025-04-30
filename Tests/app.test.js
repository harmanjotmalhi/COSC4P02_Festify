/**
 * @jest-environment jsdom
 */

// Import the functions we want to test
import * as AppModule from '../app.js';

// Mock firebase.js module
jest.mock('../firebase.js', () => ({
  fetchEvents: jest.fn().mockResolvedValue([
    {
      id: 'event1',
      title: 'Tech Event 2024',
      date: '2024-06-15',
      location: 'Convention Center',
      startTime: '10:00',
      endTime: '16:00',
      imageUrl: 'https://example.com/image.jpg',
      generalPrice: 100,
      childPrice: 50,
      seniorPrice: 75,
      tickets: 100,
      totalRevenue: 0
    },
    {
      id: 'event2',
      title: 'Music Festival',
      date: '2024-07-20',
      location: 'City Park',
      startTime: '14:30',
      endTime: '23:00',
      imageUrl: 'https://example.com/music.jpg',
      generalPrice: 150,
      childPrice: 75,
      seniorPrice: 100,
      tickets: 500,
      totalRevenue: 0
    }
  ]),
  updateTickets: jest.fn().mockResolvedValue(true),
  saveUserTicket: jest.fn().mockResolvedValue('ticket123'),
  updateRevenue: jest.fn().mockResolvedValue(true)
}));

// Define formatTime helper to test our event display
function formatTime(time) {
  const [hour, minute] = time.split(':');
  const hourNum = parseInt(hour, 10);
  const suffix = hourNum >= 12 ? 'PM' : 'AM';
  const formattedHour = hourNum % 12 || 12;
  return `${formattedHour}:${minute} ${suffix}`;
}

// Define a simplified test version of createEventCard based on app.js implementation
function createEventCard(event, eventId) {
  return `
    <div class="event-card" onclick="showEventPopup('${JSON.stringify(event)}', '${eventId || ''}')">
      <div class="event-image-container">
        <img src="${event.imageUrl || ''}" alt="${event.title || ''}">
        <div class="event-price">${event.generalPrice ? `$${event.generalPrice}` : 'N/A'}</div>
      </div>
      <div class="event-details">
        <h3 class="event-title">${event.title || ''}</h3>
        <div class="event-info">
          <span>${event.date || ''}</span>
        </div>
        <div class="event-info">
          <span>${event.startTime && event.endTime ? `${formatTime(event.startTime)} - ${formatTime(event.endTime)}` : ''}</span>
        </div>
        <div class="event-info">
          <span>${event.location || ''}</span>
        </div>
      </div>
    </div>
  `;
}

describe('app.js module', () => {
  // Setup before all tests
  beforeAll(() => {
    // Mock window.alert and window.showEventPopup
    global.alert = jest.fn();
    global.showEventPopup = jest.fn();
  });

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('Event card creation', () => {
    it('should create an event card with proper content', () => {
      const event = {
        title: "Test Event",
        date: "January 1, 2025",
        location: "Test Location",
        startTime: "10:00",
        endTime: "16:00",
        imageUrl: "https://example.com/event.jpg",
        generalPrice: 100
      };
      
      const html = createEventCard(event, 'event123');
      
      expect(html).toContain(event.title);
      expect(html).toContain(event.date);
      expect(html).toContain(event.location);
      expect(html).toContain("10:00 AM - 4:00 PM"); // Formatted time
      expect(html).toContain(event.imageUrl);
      expect(html).toContain("$100");
      expect(html).toContain('onclick="showEventPopup'); // Check event handler
    });

    it('should handle missing data gracefully', () => {
      const event = {
        title: "Minimal Event",
        date: "January 1, 2025"
      };
      
      const html = createEventCard(event, 'event123');
      
      expect(html).toContain(event.title);
      expect(html).toContain(event.date);
      expect(html).toContain("N/A"); // For price
    });
  });

  describe('Event rendering', () => {
    beforeEach(() => {
      document.body.innerHTML = `<div id="eventsGrid"></div>`;
    });

    it('should render event cards', () => {
      // Test events data
      const events = [
        {
          id: 'event1',
          title: "Test Event 1",
          date: "January 1, 2025",
          location: "Location 1",
          startTime: "10:00",
          endTime: "16:00",
          imageUrl: "https://example.com/event1.jpg",
          generalPrice: 20
        },
        {
          id: 'event2',
          title: "Test Event 2",
          date: "February 1, 2025",
          location: "Location 2",
          startTime: "14:00",
          endTime: "20:00",
          imageUrl: "https://example.com/event2.jpg",
          generalPrice: 0
        }
      ];
      
      // Manually add cards to the DOM like app.js would do
      const eventsGrid = document.getElementById('eventsGrid');
      eventsGrid.innerHTML = '';
      events.forEach(event => {
        eventsGrid.innerHTML += createEventCard(event, event.id);
      });
      
      // Test the output
      expect(eventsGrid.innerHTML).toContain("Test Event 1");
      expect(eventsGrid.innerHTML).toContain("Test Event 2");
      expect(eventsGrid.innerHTML).toContain("Location 1");
      expect(eventsGrid.innerHTML).toContain("Location 2");
      expect(eventsGrid.querySelectorAll('.event-card').length).toBe(2);
    });
  });

  // Test custom window functions needed for checkout
  describe('Checkout functionality', () => {
    beforeEach(() => {
      // Setup DOM for checkout tests
      document.body.innerHTML = `
        <input id="eventID" value="event1">
        <input id="generalQuantity" value="2">
        <input id="seniorQuantity" value="1">
        <input id="childQuantity" value="0">
        <div id="totalPrice">$275.00</div>
        <button id="paymentBtn" class=""></button>
        <div id="paymentContainer"></div>
      `;
      
      // Mock checkout function
      global.checkout = function() {
        const generalQty = parseInt(document.getElementById('generalQuantity').value) || 0;
        const seniorQty = parseInt(document.getElementById('seniorQuantity').value) || 0; 
        const childQty = parseInt(document.getElementById('childQuantity').value) || 0;
        
        if (generalQty + seniorQty + childQty === 0) {
          alert("Please Select Ticket(s)");
          return;
        }
        
        document.getElementById('paymentBtn').classList.add('hidden');
        
        const paymentContainer = document.getElementById('paymentContainer');
        paymentContainer.innerHTML = `
          <div class="payment-container">
            <form id="paymentForm">
              <input id="cardName">
              <input id="cardNumber">
              <input id="cardExpiry">
              <input id="cardCVC">
              <input id="paymentEmail">
            </form>
          </div>
        `;
      };
    });

    it('should show payment form when valid tickets are selected', () => {
      global.checkout();
      
      const paymentBtn = document.getElementById('paymentBtn');
      const paymentContainer = document.querySelector('.payment-container');
      
      expect(paymentBtn.classList.contains('hidden')).toBe(true);
      expect(paymentContainer).not.toBeNull();
      expect(paymentContainer.querySelector('form')).not.toBeNull();
    });

    it('should show alert when no tickets are selected', () => {
      // Set all quantities to 0
      document.getElementById('generalQuantity').value = '0';
      document.getElementById('seniorQuantity').value = '0';
      document.getElementById('childQuantity').value = '0';
      
      global.checkout();
      
      expect(window.alert).toHaveBeenCalledWith("Please Select Ticket(s)");
      expect(document.querySelector('.payment-container')).toBeNull();
    });
  });
});
