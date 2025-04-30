// email.js - Email sending functionality
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { config } from "./config.js";
import { getApiKey } from "./firebase.js";

/**
 * Generate QR code as a data URL
 * @param {Object} ticketData - The ticket data to encode in the QR code
 * @returns {Promise<string>} - Promise resolving to data URL of the QR code
 */
export async function generateQRCode(ticketData) {
  try {
    // Create a JSON string with essential ticket details
    const ticketInfo = JSON.stringify({
      ticketId: ticketData.id,
      eventId: ticketData.eventId,
      event: ticketData.eventDetails.title,
      date: ticketData.eventDetails.date,
      attendee: ticketData.name,
      tickets: ticketData.tickets,
      totalQuantity: ticketData.totalQuantity
    });

    // Generate QR code as data URL using the QRCode library loaded in the HTML
    return new Promise((resolve, reject) => {
      window.QRCode.toDataURL(ticketInfo, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }, (err, url) => {
        if (err) reject(err);
        else resolve(url);
      });
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    // Return placeholder image if QR generation fails
    return 'https://via.placeholder.com/300?text=Ticket';
  }
}

/**
 * Send a welcome email to a newly registered user
 * @param {string} userEmail - The email address of the new user
 * @param {string} userName - The name of the new user (optional)
 * @returns {Promise} - Promise resolving when email is sent
 */
export async function sendWelcomeEmail(userEmail, userName = '') {
  try {
    // Get EmailJS service ID from Firebase
    const serviceID = await getApiKey('EMAIL_SERVICE_ID');
    const templateID = 'template_ojujtlo';

    // Template parameters
    const templateParams = {
      email: userEmail,
      to_name: userName || userEmail.split('@')[0],
      subject: 'Welcome to Festify!',
      message: `Welcome to Festify! We're excited to have you on board. Start exploring amazing events or create your own.`,
    };

    // Send the email using EmailJS - use window.emailjs to access the global object
    const response = await window.emailjs.send(serviceID, templateID, templateParams);
    console.log('Welcome email sent successfully:', response.status, response.text);
    return response;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw the error to prevent disrupting the signup process
    return null;
  }
}

/**
 * Send a ticket confirmation email
 * @param {Object} ticketData - The ticket data
 * @returns {Promise} - Promise resolving when email is sent
 */
export async function sendTicketConfirmationEmail(ticketData) {
  try {
    // Get EmailJS service ID from Firebase
    const serviceID = await getApiKey('EMAIL_SERVICE_ID');
    const templateID = 'template_ntl7hvp';

    // Extract ticket information for the template
    const hasGeneralTickets = ticketData.tickets.general > 0;
    const hasSeniorTickets = ticketData.tickets.senior > 0;
    const hasChildTickets = ticketData.tickets.child > 0;

    // Format event time from startTime and endTime
    const eventTime = ticketData.eventDetails.startTime && ticketData.eventDetails.endTime
      ? `${ticketData.eventDetails.startTime} - ${ticketData.eventDetails.endTime}`
      : ticketData.eventDetails.time || 'N/A';

    // Calculate individual ticket prices
    const generalPrice = hasGeneralTickets ? (ticketData.eventDetails.generalPrice || 0) : 0;
    const seniorPrice = hasSeniorTickets ? (ticketData.eventDetails.seniorPrice || 0) : 0;
    const childPrice = hasChildTickets ? (ticketData.eventDetails.childPrice || 0) : 0;

    // Calculate subtotals for each ticket type
    const generalSubtotal = generalPrice * (ticketData.tickets.general || 0);
    const seniorSubtotal = seniorPrice * (ticketData.tickets.senior || 0);
    const childSubtotal = childPrice * (ticketData.tickets.child || 0);

    // Calculate total price before any discounts
    const subtotal = generalSubtotal + seniorSubtotal + childSubtotal;

    // Use the provided total price if available, otherwise use calculated subtotal
    const finalTotalPrice = ticketData.totalPrice !== undefined ? ticketData.totalPrice : subtotal;

    // Get order ID for the subject line
    const orderId = ticketData.id || 'UNKNOWN';

    // Template parameters matched to the email template
    const templateParams = {
      email: ticketData.email,
      to_name: ticketData.name,
      subject: `Order Confirmed #${orderId}!`,
      order_id: orderId,
      event_title: ticketData.eventDetails.title,
      event_date: ticketData.eventDetails.date,
      event_time: eventTime,
      event_location: ticketData.eventDetails.location,

      // Ticket quantities
      general_qty: ticketData.tickets.general || 0,
      senior_qty: ticketData.tickets.senior || 0,
      child_qty: ticketData.tickets.child || 0,

      // Ticket prices - ensure these are numbers
      general_price: generalPrice,
      senior_price: seniorPrice,
      child_price: childPrice,

      // Show/hide flags for the template
      has_general: hasGeneralTickets,
      has_senior: hasSeniorTickets,
      has_child: hasChildTickets,

      // Totals
      total_tickets: ticketData.totalQuantity || 0,
      total_price: finalTotalPrice
    };

    // Log template parameters for debugging
    console.log('Sending email with params:', {
      general_price: generalPrice,
      senior_price: seniorPrice,
      child_price: childPrice,
      order_id: orderId
    });

    // Send the email using EmailJS
    const response = await window.emailjs.send(serviceID, templateID, templateParams);
    console.log('Ticket confirmation email sent successfully:', response.status, response.text);
    return response;
  } catch (error) {
    console.error('Error sending ticket confirmation email:', error);
    return null;
  }
}

/**
 * Send a ticket confirmation email (alias for sendTicketConfirmationEmail for backward compatibility)
 * @param {Object} ticketData - The ticket data
 * @returns {Promise} - Promise resolving when email is sent
 */
export async function sendTicketConfirmationEmailNoQR(ticketData) {
  return sendTicketConfirmationEmail(ticketData);
}