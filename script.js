// script.js
import {
  createNewEvent,
  fetchUserEvents,
  onUserStateChanged,
  getUserProfile,
  saveUserProfile,
  uploadEventImage,
  updateEvent,
  getEventById,
  deleteEvent,
  getEventAttendees,
  getEventFeedback
} from './firebase.js';
import { generateEventPoster } from './dalle-api.js';

let currentUser = null;

// Listen for auth state changes and load profile data
onUserStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    
    // Load user's profile from Firestore and populate profile form fields
    const profileData = await getUserProfile(user.uid);
    
    // Check if the user is a basic user (not PRO) and redirect if needed
    if (!profileData || profileData.subscriptionStatus !== 'PRO') {
      console.log('Basic user detected in organization dashboard - redirecting to basic dashboard');
      window.location.href = 'basic-org-dash.html';
      return;
    }
    
    if (profileData) {
      document.getElementById('orgName').value = profileData.orgName || '';
      document.getElementById('phone').value = profileData.phone || '';
      document.getElementById('email').value = profileData.email || '';
      document.getElementById('address').value = profileData.address || '';
      document.getElementById('website').value = profileData.website || '';
    }
    
    // Render events for the logged-in organizer
    renderEventsFromDB();
  } else {
    currentUser = null;
    // Redirect if user is not logged in
    window.location.href = 'list-your-event.html';
  }
});

// Helper: Format date
export function formatDate(dateString) {
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  return new Date(dateString).toLocaleDateString('en-US', options);
}

// Helper: Format currency
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount);
}

// Render events from Firestore for the current user
async function renderEventsFromDB() {
  if (!currentUser) return;
  try {
    const events = await fetchUserEvents(currentUser.uid);
    let organizerRevenue = 0;
    let attendees = 0;
    events.forEach((event) => {
      organizerRevenue += event.totalRevenue;
      attendees += event.totalTickets-event.tickets;
    });
    document.getElementById("totalRevenue").textContent = organizerRevenue.toFixed(2);
    document.getElementById("attendees").textContent = attendees;
    const eventsGrid = document.getElementById('eventsGrid');
    if (eventsGrid) {
      const eventCount = events.length;
      document.getElementById("totalEvents").textContent = eventCount;
      eventsGrid.innerHTML = events.map((event, index) => `
        <div class="event-card" style="animation-delay: ${index * 0.1}s" data-event-id="${event.id}">
          <div class="event-card-content">
            <div class="event-header">
              <div>
                <h3 class="event-title">${event.title}</h3>
                <p class="event-date">
                  <i class="fas fa-calendar"></i>
                  ${event.date ? formatDate(event.date) : ''}
                </p>
              </div>
              <span class="event-status ${event.status === 'upcoming' ? 'status-upcoming' : 'status-past'}">
                ${event.status || ''}
              </span>
            </div>
            ${event.imageUrl ? `<img src="${event.imageUrl}" alt="${event.title}" class="event-image" />` : ''}
            <div class="event-stats">
              <div>
                <p class="stat-label">
                  <i class="fas fa-users"></i>
                  Attendees
                </p>
                <p class="stat-value">${event.totalTickets-event.tickets || 0}</p>
              </div>
              <div>
                <p class="stat-label">
                  <i class="fas fa-money-bill-wave"></i>
                  Prices
                </p>
                <div class="price-list">
                  <p class="price-item">General: ${formatCurrency(event.generalPrice)}</p>
                  <p class="price-item">Below 13: ${formatCurrency(event.childPrice)}</p>
                  <p class="price-item">Above 55: ${formatCurrency(event.seniorPrice)}</p>
                </div>
              </div>
            </div>
            <div class="event-actions">
              <button class="btn attendee-details-btn" data-event-id="${event.id}" style="margin-bottom: 10px;">
                <i class="fas fa-users"></i> Attendee Details
              </button>
              <button class="btn feedback-analytics-btn" data-event-id="${event.id}">
                <i class="fas fa-chart-bar"></i> Feedback Analytics
              </button>
            </div>
          </div>
        </div>
      `).join('');

      // Add click event listeners to all event cards
      const eventCards = eventsGrid.querySelectorAll('.event-card');
      eventCards.forEach(card => {
        card.addEventListener('click', (e) => {
          // Skip if clicking on the attendee details button
          if (e.target.closest('.attendee-details-btn')) {
            return;
          }
          
          const eventId = card.getAttribute('data-event-id');
          const event = events.find(e => e.id === eventId);
          if (event) {
            populateEditForm(event);
            showEditForm();
          }
        });
      });

      // Add event listeners for attendee details buttons
      const attendeeButtons = eventsGrid.querySelectorAll('.attendee-details-btn');
      attendeeButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
          e.stopPropagation(); // Prevent event card click
          const eventId = button.getAttribute('data-event-id');
          await showAttendeeDetails(eventId);
        });
      });

      // Add event listeners for feedback analytics buttons
      const feedbackButtons = eventsGrid.querySelectorAll('.feedback-analytics-btn');
      feedbackButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
          e.stopPropagation(); // Prevent event card click
          const eventId = button.getAttribute('data-event-id');
          await showFeedbackAnalytics(eventId);
        });
      });
    }
  } catch (error) {
    console.error("Error rendering events:", error);
  }
}

// Function to show attendee details popup
async function showAttendeeDetails(eventId) {
  try {
    // Get the current event
    const event = await getEventById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Fetch attendees for this event
    const attendees = await getEventAttendees(eventId);
    
    // Create HTML for attendee list
    let attendeeListHTML = '';
    if (attendees.length === 0) {
      attendeeListHTML = '<p>No attendees have purchased tickets yet.</p>';
    } else {
      attendeeListHTML = `
        <table class="attendee-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Tickets Purchased</th>
              <th>Total Paid</th>
              <th>Purchase Date</th>
            </tr>
          </thead>
          <tbody>
            ${attendees.map(attendee => {
              // Format ticket details
              const ticketDetails = attendee.tickets.map(ticket => 
                `${ticket.quantity} ${ticket.ticketType}${ticket.quantity > 1 ? 's' : ''}`
              ).join(', ');
              
              // Format purchase date
              const purchaseDate = attendee.purchasedAt
                ? (attendee.purchasedAt.toDate 
                  ? attendee.purchasedAt.toDate().toLocaleString()
                  : new Date(attendee.purchasedAt).toLocaleString())
                : 'N/A';
              
              return `
                <tr>
                  <td>${attendee.name || 'N/A'}</td>
                  <td>${attendee.email || 'N/A'}</td>
                  <td>${ticketDetails}</td>
                  <td>${formatCurrency(attendee.totalPaid)}</td>
                  <td>${purchaseDate}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    // Show SweetAlert with attendee details
    Swal.fire({
      title: `Attendees for ${event.title}`,
      html: `
        <div class="attendee-details-container">
          ${attendeeListHTML}
        </div>
      `,
      width: '80%',
      confirmButtonText: 'Close',
      customClass: {
        htmlContainer: 'attendee-details-popup'
      }
    });
  } catch (error) {
    console.error('Error showing attendee details:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to load attendee details. Please try again.'
    });
  }
}

// Function to show feedback analytics popup
async function showFeedbackAnalytics(eventId) {
  try {
    // Get the current event
    const event = await getEventById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Fetch feedback data for this event
    const feedbackData = await getEventFeedback(eventId);
    
    // Create HTML for feedback analytics
    let feedbackHTML = '';
    if (!feedbackData || feedbackData.length === 0) {
      feedbackHTML = '<p>No feedback data available for this event yet.</p>';
    } else {
      // Calculate percentages for Yes/No questions
      const calculateResponses = (question) => {
        const total = feedbackData.length;
        const yesCount = feedbackData.filter(f => f[question] === "Yes").length;
        const noCount = total - yesCount;
        return { yes: yesCount, no: noCount };
      };

      // Calculate rating distribution
      const ratings = feedbackData.map(f => parseInt(f.rating));
      const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      
      // Count ratings
      const ratingDistribution = ratings.reduce((acc, rating) => {
        acc[rating] = (acc[rating] || 0) + 1;
        return acc;
      }, {});

      // Create rating distribution data
      const distributionData = [5,4,3,2,1].map(rating => ratingDistribution[rating] || 0);

      feedbackHTML = `
        <div class="feedback-analytics-modern">
          <div class="analytics-header">
            <div class="rating-summary">
              <div class="average-rating">
                <span class="rating-number">${avgRating.toFixed(1)}</span>
                <div class="rating-details">
                  <div class="rating-stars">${'★'.repeat(Math.round(avgRating))}${'☆'.repeat(5-Math.round(avgRating))}</div>
                  <span class="rating-count">${feedbackData.length} ratings</span>
                </div>
              </div>
            </div>
            <div class="rating-distribution">
              <canvas id="ratingChart" style="max-width: 300px; margin: 0 auto;"></canvas>
            </div>
          </div>

          <div class="analytics-charts" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 20px;">
            <div class="chart-container" style="position: relative; height: 200px; padding: 10px;">
              <h3>Organization</h3>
              <canvas id="organizedChart"></canvas>
            </div>
            <div class="chart-container" style="position: relative; height: 200px; padding: 10px;">
              <h3>Venue Comfort</h3>
              <canvas id="venueChart"></canvas>
            </div>
            <div class="chart-container" style="position: relative; height: 200px; padding: 10px;">
              <h3>Schedule Adherence</h3>
              <canvas id="scheduleChart"></canvas>
            </div>
            <div class="chart-container" style="position: relative; height: 200px; padding: 10px;">
              <h3>Would Attend Again</h3>
              <canvas id="attendChart"></canvas>
            </div>
          </div>
        </div>
      `;

      // Show SweetAlert with feedback analytics
      Swal.fire({
        title: `Feedback Analytics for ${event.title}`,
        html: feedbackHTML,
        width: '90%',
        confirmButtonText: 'Close',
        customClass: {
          popup: 'feedback-analytics-popup'
        },
        background: '#1a2942',
        color: '#ffffff',
        didRender: () => {
          // Create rating distribution chart
          new Chart(document.getElementById('ratingChart'), {
            type: 'bar',
            data: {
              labels: ['5 ★', '4 ★', '3 ★', '2 ★', '1 ★'],
              datasets: [{
                data: distributionData,
                backgroundColor: '#ffc107',
                borderRadius: 6,
                barThickness: 12
              }]
            },
            options: {
              indexAxis: 'y',
              maintainAspectRatio: false,
              responsive: true,
              plugins: {
                legend: { display: false }
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { 
                    precision: 0,
                    font: {
                      size: 11,
                      color: '#ffffff'
                    }
                  }
                },
                y: {
                  grid: { display: false },
                  ticks: {
                    font: {
                      size: 11,
                      color: '#ffffff'
                    }
                  }
                }
              }
            }
          });

          // Function to create pie charts
          const createPieChart = (canvasId, data, labels) => {
            new Chart(document.getElementById(canvasId), {
              type: 'doughnut',
              data: {
                labels: labels,
                datasets: [{
                  data: data,
                  backgroundColor: ['#4CAF50', '#ff4444'],
                  borderWidth: 0
                }]
              },
              options: {
                maintainAspectRatio: false,
                responsive: true,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: {
                      boxWidth: 12,
                      padding: 8,
                      font: {
                        size: 11,
                        color: '#ffffff'
                      }
                    }
                  }
                },
                cutout: '65%',
                layout: {
                  padding: 5
                }
              }
            });
          };

          // Create pie charts for each metric
          const organized = calculateResponses('organized');
          createPieChart('organizedChart', [organized.yes, organized.no], ['Well Organized', 'Needs Improvement']);

          const venue = calculateResponses('venue');
          createPieChart('venueChart', [venue.yes, venue.no], ['Comfortable', 'Not Comfortable']);

          const schedule = calculateResponses('schedule');
          createPieChart('scheduleChart', [schedule.yes, schedule.no], ['On Schedule', 'Delayed']);

          const attend = calculateResponses('attendAgain');
          createPieChart('attendChart', [attend.yes, attend.no], ['Would Attend', 'Would Not Attend']);
        }
      });
    }
  } catch (error) {
    console.error('Error showing feedback analytics:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to load feedback analytics. Please try again.'
    });
  }
}

// Helper function to analyze feedback themes
function analyzeFeedbackThemes(feedbackData) {
  // Simple theme analysis based on common words in comments
  const commonWords = feedbackData
    .flatMap(feedback => feedback.comment.toLowerCase().split(/\s+/))
    .filter(word => word.length > 3) // Filter out short words
    .reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});

  // Get top themes (words that appear multiple times)
  return Object.entries(commonWords)
    .filter(([_, count]) => count > 1)
    .sort(([_, a], [__, b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}

// Toggling form functions
function showEventForm() {
  document.getElementById('eventFormSection').style.display = 'block';
  document.getElementById('profileFormSection').style.display = 'none';
  document.querySelector('.metrics-section').style.display = 'none';
  document.querySelector('.events-section').style.display = 'none';
}

function hideEventForm() {
  document.getElementById('eventFormSection').style.display = 'none';
  document.getElementById('profileFormSection').style.display = 'none';
  document.querySelector('.metrics-section').style.display = 'block';
  document.querySelector('.events-section').style.display = 'block';
}

function showProfileForm() {
  document.getElementById('profileFormSection').style.display = 'block';
  document.querySelector('.metrics-section').style.display = 'none';
  document.querySelector('.events-section').style.display = 'none';
  document.getElementById('eventFormSection').style.display = 'none';
}

function hideProfileForm() {
  document.getElementById('profileFormSection').style.display = 'none';
  document.querySelector('.metrics-section').style.display = 'block';
  document.querySelector('.events-section').style.display = 'block';
}

function resetDashboard() {
  hideEventForm();
  hideProfileForm();
  renderEventsFromDB();
}

// Function to preview images
const previewImages = (event, previewId) => {
  const imageFiles = event.target.files;
  const imageFilesLength = imageFiles.length;

  if (imageFilesLength > 0) {
    const imageFile = imageFiles[0];
    const imageURL = URL.createObjectURL(imageFile);
    const filePreview = document.getElementById(previewId);
    filePreview.src = imageURL;
    filePreview.style.display = 'block';
  }
};

// Function to show edit form
function showEditForm() {
  document.getElementById('editEventFormSection').style.display = 'block';
  document.getElementById('eventFormSection').style.display = 'none';
  document.getElementById('profileFormSection').style.display = 'none';
  document.querySelector('.metrics-section').style.display = 'none';
  document.querySelector('.events-section').style.display = 'none';
}

// Function to hide edit form
function hideEditForm() {
  document.getElementById('editEventFormSection').style.display = 'none';
  document.querySelector('.metrics-section').style.display = 'block';
  document.querySelector('.events-section').style.display = 'block';
}

// Function to populate edit form with event data
function populateEditForm(event) {
  const editEventForm = document.getElementById('editEventForm');
  editEventForm.dataset.eventId = event.id;

  document.getElementById('editTitle').value = event.title || '';
  document.getElementById('editDescription').value = event.description || '';
  document.getElementById('editDate').value = event.date || '';
  document.getElementById('editStartTime').value = event.startTime || '';
  document.getElementById('editEndTime').value = event.endTime || '';
  document.getElementById('editLocation').value = event.location || '';
  document.getElementById('editTicketInput').value = event.tickets || 0;
  document.getElementById('editGeneralPrice').value = event.generalPrice;

  // Handle child price
  if (event.prices?.child) {
    document.getElementById('editEnableChildPrice').checked = true;
    document.getElementById('editChildPrice').disabled = false;
    document.getElementById('editChildPrice').value = event.prices.child;
  } else {
    document.getElementById('editEnableChildPrice').checked = false;
    document.getElementById('editChildPrice').disabled = true;
    document.getElementById('editChildPrice').value = '';
  }

  // Handle senior price
  if (event.prices?.senior) {
    document.getElementById('editEnableSeniorPrice').checked = true;
    document.getElementById('editSeniorPrice').disabled = false;
    document.getElementById('editSeniorPrice').value = event.prices.senior;
  } else {
    document.getElementById('editEnableSeniorPrice').checked = false;
    document.getElementById('editSeniorPrice').disabled = true;
    document.getElementById('editSeniorPrice').value = '';
  }

  // Handle existing images
  if (event.imageUrl) {
    document.getElementById('editPreview-selected-image1').src = event.imageUrl;
    document.getElementById('editPreview-selected-image1').style.display = 'block';
  } else {
    document.getElementById('editPreview-selected-image1').style.display = 'none';
  }

  if (event.imageUrl2) {
    document.getElementById('editPreview-selected-image2').src = event.imageUrl2;
    document.getElementById('editPreview-selected-image2').style.display = 'block';
  } else {
    document.getElementById('editPreview-selected-image2').style.display = 'none';
  }

  if (event.imageUrl3) {
    document.getElementById('editPreview-selected-image3').src = event.imageUrl3;
    document.getElementById('editPreview-selected-image3').style.display = 'block';
  } else {
    document.getElementById('editPreview-selected-image3').style.display = 'none';
  }
}

// Wait for DOM to be fully loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Create Event form submission handler
  const eventForm = document.getElementById('eventForm');
  if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      try {
        // Get the image file or use generated poster URL
        const generatedPosterUrl = document.getElementById('upload-box1').dataset.generatedPosterUrl;
        const imageFile1 = document.getElementById('fileInput1').files[0];
        const imageFile2 = document.getElementById('fileInput2').files[0];
        const imageFile3 = document.getElementById('fileInput3').files[0];
        let imageUrl = null;
        let imageUrl2 = null;
        let imageUrl3 = null;
        
        if (generatedPosterUrl) {
          // Use the generated poster URL directly
          imageUrl = generatedPosterUrl;
        } else if (imageFile1) {
          // Upload the selected image file
          imageUrl = await uploadEventImage(imageFile1);
        }
        
        if (imageFile2) {
          imageUrl2 = await uploadEventImage(imageFile2);
        }
        if (imageFile3) {
          imageUrl3 = await uploadEventImage(imageFile3);
        }

        // Get other form data
        const eventData = {
          title: document.getElementById('title').value,
          description: document.getElementById('description').value,
          date: document.getElementById('date').value,
          startTime: document.getElementById('start-time').value,
          endTime: document.getElementById('end-time').value,
          location: document.getElementById('location').value,
          totalRevenue: parseInt(0),
          totalTickets: parseInt(document.getElementById('ticketInput').value),
          tickets: parseInt(document.getElementById('ticketInput').value),
          generalPrice: parseFloat(document.getElementById('generalPrice').value),
          childPrice: document.getElementById('enableChildPrice').checked ? parseFloat(document.getElementById('childPrice').value) : null,
          seniorPrice: document.getElementById('enableSeniorPrice').checked ? parseFloat(document.getElementById('seniorPrice').value) : null,
          imageUrl: imageUrl, // Add the image URL to event data
          imageUrl2: imageUrl2,
          imageUrl3: imageUrl3,
          organizerId: currentUser ? currentUser.uid : null
        };

        await createNewEvent(eventData);
        // Sweet alert for success
        Swal.fire({
          icon: 'success',
          title: 'Event Created!',
          text: 'Your event has been created successfully.'
        });

        // Reset form and hide it
        e.target.reset();
        document.getElementById('preview-selected-image1').style.display = 'none';
        document.getElementById('preview-selected-image2').style.display = 'none';
        document.getElementById('preview-selected-image3').style.display = 'none';
        document.getElementById('upload-box1').removeAttribute('data-generated-poster-url');
        document.getElementById('generatedPosterPreview').style.display = 'none';
        
        // Refresh events display if needed
        renderEventsFromDB();
        hideEventForm();
        
      } catch (error) {
        console.error("Error creating event:", error);
        // SweetAlert for error
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to create event. Please try again.',
    });
      }
    });
  }

  // Edit Event form submission handler
  const editEventForm = document.getElementById('editEventForm');
  if (editEventForm) {
    editEventForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const eventId = editEventForm.dataset.eventId;
      if (!eventId) {
        alert('Error: No event ID found');
        return;
      }

      try {
        // Handle image uploads first
        const imageFile1 = document.getElementById('editFileInput1').files[0];
        const imageFile2 = document.getElementById('editFileInput2').files[0];
        const imageFile3 = document.getElementById('editFileInput3').files[0];
        
        let imageUrl = null;
        let imageUrl2 = null;
        let imageUrl3 = null;

        if (imageFile1) {
          imageUrl = await uploadEventImage(imageFile1);
        }
        if (imageFile2) {
          imageUrl2 = await uploadEventImage(imageFile2);
        }
        if (imageFile3) {
          imageUrl3 = await uploadEventImage(imageFile3);
        }

        // Get updated event data from form
        const updatedEventData = {
          title: document.getElementById('editTitle').value,
          description: document.getElementById('editDescription').value,
          date: document.getElementById('editDate').value,
          startTime: document.getElementById('editStartTime').value,
          endTime: document.getElementById('editEndTime').value,
          location: document.getElementById('editLocation').value,
          tickets: parseInt(document.getElementById('editTicketInput').value),
          generalPrice: parseFloat(document.getElementById('editGeneralPrice').value),
          childPrice: document.getElementById('editEnableChildPrice').checked ? parseFloat(document.getElementById('editChildPrice').value) : null,
          seniorPrice: document.getElementById('editEnableSeniorPrice').checked ? parseFloat(document.getElementById('editSeniorPrice').value) : null,
        };

        // Only include new image URLs if files were uploaded
        if (imageUrl) updatedEventData.imageUrl = imageUrl;
        if (imageUrl2) updatedEventData.imageUrl2 = imageUrl2;
        if (imageUrl3) updatedEventData.imageUrl3 = imageUrl3;

        // Update the event in Firebase
        await updateEvent(eventId, updatedEventData);
        // SweetAlert for success
    Swal.fire({
      icon: 'success',
      title: 'Event Updated!',
      text: 'Your event has been updated successfully.',
    });
        hideEditForm();
        renderEventsFromDB(); // Refresh the events list
      } catch (error) {
        console.error('Error updating event:', error);
        // SweetAlert for error
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to update event. Error: ' + error.message,
    });
      }
    });
  }

  // Create New Event button
  const createNewEventBtn = document.getElementById('createNewEventBtn');
  if (createNewEventBtn) {
    createNewEventBtn.addEventListener('click', showEventForm);
  }

  // Logo click handler
  const logo = document.querySelector('.logo');
  if (logo) {
    logo.addEventListener('click', (e) => {
      e.preventDefault();
      resetDashboard();
    });
  }

  // Edit Profile button
  const editProfileBtn = document.querySelector('.btn.btn-outline');
  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', showProfileForm);
  }

  // Cancel Edit button
  const cancelEditBtn = document.getElementById('cancel_Edit_Event');
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', hideEditForm);
  }

  // Edit form price checkbox handlers
  const editEnableChildPrice = document.getElementById('editEnableChildPrice');
  if (editEnableChildPrice) {
    editEnableChildPrice.addEventListener('change', function() {
      const childPriceInput = document.getElementById('editChildPrice');
      childPriceInput.disabled = !this.checked;
      if (!this.checked) childPriceInput.value = '';
    });
  }

  const editEnableSeniorPrice = document.getElementById('editEnableSeniorPrice');
  if (editEnableSeniorPrice) {
    editEnableSeniorPrice.addEventListener('change', function() {
      const seniorPriceInput = document.getElementById('editSeniorPrice');
      seniorPriceInput.disabled = !this.checked;
      if (!this.checked) seniorPriceInput.value = '';
    });
  }

  // Edit form image upload handlers
  const editUploadBox1 = document.getElementById('editUpload-box1');
  if (editUploadBox1) {
    editUploadBox1.addEventListener('click', () => {
      document.getElementById('editFileInput1').click();
    });
  }

  const editUploadBox2 = document.getElementById('editUpload-box2');
  if (editUploadBox2) {
    editUploadBox2.addEventListener('click', () => {
      document.getElementById('editFileInput2').click();
    });
  }

  const editUploadBox3 = document.getElementById('editUpload-box3');
  if (editUploadBox3) {
    editUploadBox3.addEventListener('click', () => {
      document.getElementById('editFileInput3').click();
    });
  }

  // Edit form file input change handlers
  const editFileInput1 = document.getElementById('editFileInput1');
  if (editFileInput1) {
    editFileInput1.addEventListener('change', (event) => 
      previewImages(event, 'editPreview-selected-image1'));
  }

  const editFileInput2 = document.getElementById('editFileInput2');
  if (editFileInput2) {
    editFileInput2.addEventListener('change', (event) => 
      previewImages(event, 'editPreview-selected-image2'));
  }

  const editFileInput3 = document.getElementById('editFileInput3');
  if (editFileInput3) {
    editFileInput3.addEventListener('change', (event) => 
      previewImages(event, 'editPreview-selected-image3'));
  }

  // File upload helper (if needed)
  function triggerFileInput() {
    consol
    document.getElementById('fileInput').click();
  }

  // Profile form submission handler
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No user is logged in. Please log in again.',
        });
        return;
      }
      const orgName = document.getElementById('orgName').value;
      const phone = document.getElementById('phone').value;
      const email = document.getElementById('email').value;
      const address = document.getElementById('address').value;
      const website = document.getElementById('website').value;
      try {
        await saveUserProfile(currentUser.uid, {
          orgName,
          phone,
          email,
          address,
          website
        });
        // SweetAlert for success
    Swal.fire({
      icon: 'success',
      title: 'Profile Updated!',
      text: 'Your profile has been updated successfully.',
    });
        hideProfileForm();
      } catch (error) {
        // SweetAlert for error
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to update profile. Error: ' + error.message,
    });
      }
    });
  }

  document.getElementById("cancel_Profile").addEventListener("click", hideProfileForm);
  document.getElementById("cancel_Create_Event").addEventListener("click", hideEventForm);

  // Handle enabling/disabling price inputs based on checkboxes
  document.getElementById('enableChildPrice').addEventListener('change', function() {
    const childPriceInput = document.getElementById('childPrice');
    childPriceInput.disabled = !this.checked;
    if (!this.checked) childPriceInput.value = '';
  });

  document.getElementById('enableSeniorPrice').addEventListener('change', function() {
    const seniorPriceInput = document.getElementById('seniorPrice');
    seniorPriceInput.disabled = !this.checked;
    if (!this.checked) seniorPriceInput.value = '';
  });

  function setupImagePreview(uploadBoxId, fileInputId, imgPreviewId) {
    const uploadBox = document.getElementById(uploadBoxId);
    const fileInput = document.getElementById(fileInputId);
    const imgPreview = document.getElementById(imgPreviewId);

    uploadBox.addEventListener("click", function () {
        fileInput.click();
    });

    fileInput.addEventListener("change", function () {
        const file = fileInput.files[0];
        if (file && file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = function (e) {
                imgPreview.src = e.target.result;
                imgPreview.style.display = "block";
            };
            reader.readAsDataURL(file);
        }
    });
}

setupImagePreview("upload-box1", "fileInput1", "preview-selected-image1");
setupImagePreview("upload-box2", "fileInput2", "preview-selected-image2");
setupImagePreview("upload-box3", "fileInput3", "preview-selected-image3");

  // Delete Event button functionality
  const deleteEventBtn = document.getElementById("delete_Event");
  if (deleteEventBtn) {
    deleteEventBtn.addEventListener("click", async () => {
      try {
        const editEventForm = document.getElementById('editEventForm');
        if (!editEventForm) {
          throw new Error('Edit form not found');
        }

        const eventId = editEventForm.dataset.eventId;
        if (!eventId) {
          throw new Error('Could not find event ID');
        }
// SweetAlert confirmation dialog
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!',
    });
                
        if (result) {
          const success = await deleteEvent(eventId);
          if (success) {
            // SweetAlert for success
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Your event has been deleted.'
        });
            hideEditForm();
            await renderEventsFromDB();
          } else {
            throw new Error('Delete operation failed');
          }
        }
      } catch (error) {
        console.error("Error deleting event:", error);
        // SweetAlert for error
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to delete event. Error: ' + error.message,
    });
      }
    });
  }

  // Poster Generation Functionality
  const generatePosterBtn = document.getElementById('generatePosterBtn');
  const posterGenerationStatus = document.getElementById('posterGenerationStatus');
  const generatedPosterPreview = document.getElementById('generatedPosterPreview');
  const generatedPosterImage = document.getElementById('generatedPosterImage');
  const useGeneratedPosterBtn = document.getElementById('useGeneratedPoster');
  const regeneratePosterBtn = document.getElementById('regeneratePoster');

  if (generatePosterBtn) {
    generatePosterBtn.addEventListener('click', async () => {
      const eventTitle = document.getElementById('title').value;
      const eventDescription = document.getElementById('description').value;

      if (!eventTitle || !eventDescription) {
        alert('Please fill in both the event title and description before generating a poster.');
        return;
      }

      try {
        // Show loading state
        posterGenerationStatus.style.display = 'flex';
        generatedPosterPreview.style.display = 'none';

        // Generate poster
        const posterUrl = await generateEventPoster(eventTitle, eventDescription);

        // Display the generated poster
        generatedPosterImage.src = posterUrl;
        generatedPosterPreview.style.display = 'block';
        posterGenerationStatus.style.display = 'none';
      } catch (error) {
        console.error('Error generating poster:', error);
        alert('Failed to generate poster. Please try again.');
        posterGenerationStatus.style.display = 'none';
      }
    });
  }

  if (useGeneratedPosterBtn) {
    useGeneratedPosterBtn.addEventListener('click', () => {
      // Update the preview directly
      const preview = document.getElementById('preview-selected-image1');
      preview.src = generatedPosterImage.src;
      preview.style.display = 'block';
      
      // Store the image URL to be used when creating the event
      // We'll use this URL directly instead of creating a file
      document.getElementById('upload-box1').dataset.generatedPosterUrl = generatedPosterImage.src;
      
      // Hide the generation preview
      generatedPosterPreview.style.display = 'none';
      
      // Show success message
      alert('Poster set as your event image!');
    });
  }

  if (regeneratePosterBtn) {
    regeneratePosterBtn.addEventListener('click', () => {
      generatePosterBtn.click();
    });
  }

  // Add event listener for boost event button
  const boostEventBtn = document.getElementById('boostEventBtn');
  if (boostEventBtn) {
    boostEventBtn.addEventListener('click', async () => {
      try {
        // Get all events for the current user
        const events = await fetchUserEvents(currentUser.uid);
        
        if (!events || events.length === 0) {
          Swal.fire({
            icon: 'error',
            title: 'No Events Found',
            text: 'You need to create an event first before you can boost it.',
          });
          return;
        }

        // Check if any event already has a boost
        const hasBoostedEvent = events.some(event => event.boost === 'boost');
        if (hasBoostedEvent) {
          Swal.fire({
            icon: 'error',
            title: 'Boost Already Applied',
            text: 'You already have a boosted event. The current boost must expire or be deleted before you can boost another event.',
            confirmButtonText: 'OK'
          });
          return;
        }

        // Create options for the select dropdown
        const eventOptions = events.map(event => ({
          value: event.id,
          text: event.title
        }));

        // Show SweetAlert2 popup with event selection
        const { value: selectedEventId } = await Swal.fire({
          title: 'Select Event to Boost',
          input: 'select',
          inputOptions: eventOptions.reduce((acc, option) => {
            acc[option.value] = option.text;
            return acc;
          }, {}),
          inputPlaceholder: 'Select an event',
          showCancelButton: true,
          confirmButtonText: 'Boost Event',
          cancelButtonText: 'Cancel',
          inputValidator: (value) => {
            if (!value) {
              return 'You need to select an event!';
            }
          },
          customClass: {
            popup: 'boost-event-popup',
            select: 'boost-event-select'
          },
          didOpen: () => {
            // Add custom styles after popup is opened
            const style = document.createElement('style');
            style.id = 'boost-event-style';
            style.textContent = `
              .boost-event-popup {
                min-width: 340px;
                max-width: 400px;
                padding: 1.5em 1.5em 2em 1.5em;
                border-radius: 22px;
                background: linear-gradient(135deg, rgba(23,34,64,0.92), rgba(36,52,99,0.92));
                box-shadow: 0 8px 32px 0 rgba(20, 30, 60, 0.25);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border: 2px solid #233a63;
                font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
                color: #e3e8f7;
              }
              .boost-event-select, .swal2-select {
                width: 90% !important;
                padding: 0.7em !important;
                margin: 1.2em auto 1.5em auto !important;
                border: 2px solid #334e7b !important;
                border-radius: 10px !important;
                font-size: 1.08em !important;
                display: block !important;
                background: rgba(30,41,59,0.95) !important;
                color: #e3e8f7 !important;
                box-shadow: 0 2px 8px rgba(36,52,99,0.10);
                transition: border 0.2s, box-shadow 0.2s;
              }
              .boost-event-select:hover, .swal2-select:hover, .boost-event-select:focus, .swal2-select:focus {
                border: 2px solid #3b82f6 !important;
                box-shadow: 0 4px 16px rgba(59,130,246,0.10);
                outline: none;
              }
              .swal2-title {
                font-size: 1.5em !important;
                margin-bottom: 1em !important;
                text-align: center !important;
                font-weight: 700 !important;
                color: #e3e8f7 !important;
                letter-spacing: 0.01em;
                text-shadow: 0 2px 8px rgba(36,52,99,0.10);
              }
              .swal2-html-container {
                margin: 1em 0 !important;
                font-size: 1em !important;
                text-align: center !important;
                color: #cbd5e1 !important;
              }
              .swal2-actions {
                margin-top: 1.2em !important;
                justify-content: center !important;
                gap: 1em !important;
              }
              .swal2-confirm, .swal2-cancel {
                font-size: 1em !important;
                padding: 0.6em 2em !important;
                margin: 0 0.3em !important;
                border-radius: 999px !important;
                font-weight: 600 !important;
                box-shadow: 0 2px 8px rgba(36,52,99,0.10);
                border: none !important;
                transition: background 0.2s, color 0.2s, box-shadow 0.2s, transform 0.2s;
              }
              .swal2-confirm {
                background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%) !important;
                color: #fff !important;
                border: none !important;
              }
              .swal2-confirm:hover {
                background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%) !important;
                color: #fff !important;
                box-shadow: 0 6px 18px rgba(59,130,246,0.18);
                transform: scale(1.05);
              }
              .swal2-cancel {
                background: #1e293b !important;
                color: #60a5fa !important;
                border: 2px solid #334e7b !important;
              }
              .swal2-cancel:hover {
                background: #233a63 !important;
                color: #fff !important;
                border: 2px solid #3b82f6 !important;
                box-shadow: 0 4px 16px rgba(59,130,246,0.10);
              }
            `;
            document.head.appendChild(style);
          }
        });

        if (selectedEventId) {
          await updateEvent(selectedEventId, { boost: 'boost' });
          Swal.close();
          const boostStyle = document.getElementById('boost-event-style');
          if (boostStyle) boostStyle.remove();
          setTimeout(() => {
            Swal.fire({
              icon: 'success',
              title: 'Event Boosted!',
              text: 'Your event has been successfully boosted.'
            });
          }, 50);
          await renderEventsFromDB();
        }
      } catch (error) {
        console.error('Error boosting event:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to boost event. Please try again.',
        });
      }
    });
  }
});