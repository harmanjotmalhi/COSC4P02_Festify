/**
 * @jest-environment jsdom
 */
/* istanbul ignore next */
jest.mock('../firebase.js');

import {
    signUpUser,
    signInUser,
    signOutUser,
    onUserStateChanged,
    saveUserProfile,
    getUserProfile,
    fetchUserEvents,
    createNewEvent,
    uploadEventImage,
    updateEvent,
    getEventById,
    deleteEvent
} from '../firebase.js';
  
describe('firebase.js module', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock implementations for each imported function
    signUpUser.mockResolvedValue({ user: { uid: '123' } });
    signInUser.mockResolvedValue({ user: { uid: '456' } });
    signOutUser.mockResolvedValue(undefined);
    onUserStateChanged.mockImplementation(callback => callback({ uid: 'testuser123' }));
    saveUserProfile.mockResolvedValue(undefined);
    getUserProfile.mockImplementation(uid => {
      return Promise.resolve(uid ? { firstName: 'Test' } : null);
    });
    fetchUserEvents.mockResolvedValue([
      {
        id: 'event1',
        title: 'Event 1',
        date: '2024-06-15'
      },
      {
        id: 'event2',
        title: 'Event 2',
        date: '2024-07-20'
      }
    ]);
    createNewEvent.mockResolvedValue('newEvent123');
    uploadEventImage.mockResolvedValue('https://storage.example.com/events/test-image.jpg');
    updateEvent.mockResolvedValue(undefined);
    getEventById.mockImplementation(id => {
      return Promise.resolve(id ? {
        id,
        title: 'Test Event',
        date: '2024-09-15',
        description: 'A test event'
      } : null);
    });
    deleteEvent.mockResolvedValue(undefined);
  });

  it('signUpUser should call Firebase authentication', async () => {
    const result = await signUpUser('test@example.com', 'password');
    expect(signUpUser).toHaveBeenCalledWith('test@example.com', 'password');
    expect(result.user.uid).toBe('123');
  });

  it('signInUser should call Firebase authentication', async () => {
    const result = await signInUser('test@example.com', 'password');
    expect(signInUser).toHaveBeenCalledWith('test@example.com', 'password');
    expect(result.user.uid).toBe('456');
  });

  it('signOutUser should sign out the user', async () => {
    await signOutUser();
    expect(signOutUser).toHaveBeenCalled();
  });

  it('onUserStateChanged should register the callback', () => {
    const callback = jest.fn();
    onUserStateChanged(callback);
    expect(onUserStateChanged).toHaveBeenCalledWith(callback);
    expect(callback).toHaveBeenCalledWith({ uid: 'testuser123' });
  });

  it('saveUserProfile should save profile data', async () => {
    const profileData = { firstName: 'Test' };
    await saveUserProfile('uid123', profileData);
    expect(saveUserProfile).toHaveBeenCalledWith('uid123', profileData);
  });

  it('getUserProfile should return profile data if exists', async () => {
    const result = await getUserProfile('uid123');
    expect(getUserProfile).toHaveBeenCalledWith('uid123');
    expect(result).toEqual({ firstName: 'Test' });
  });

  it('getUserProfile should return null if profile does not exist', async () => {
    getUserProfile.mockResolvedValueOnce(null);
    const result = await getUserProfile('');
    expect(result).toBeNull();
  });
  
  it('fetchUserEvents should query firestore and return event data', async () => {
    const results = await fetchUserEvents('user123');
    
    expect(fetchUserEvents).toHaveBeenCalledWith('user123');
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('event1');
    expect(results[0].title).toBe('Event 1');
    expect(results[1].id).toBe('event2');
    expect(results[1].title).toBe('Event 2');
  });
  
  it('createNewEvent should add a document to firestore', async () => {
    const eventData = {
      title: 'New Test Event',
      date: '2024-08-30',
    };
    
    const result = await createNewEvent('user123', eventData);
    
    expect(createNewEvent).toHaveBeenCalledWith('user123', eventData);
    expect(result).toBe('newEvent123');
  });
  
  it('uploadEventImage should upload to storage and return URL', async () => {
    const mockFile = new File(['dummy content'], 'test-image.jpg', { type: 'image/jpeg' });
    
    const result = await uploadEventImage(mockFile, 'event123');
    
    expect(uploadEventImage).toHaveBeenCalledWith(mockFile, 'event123');
    expect(result).toBe('https://storage.example.com/events/test-image.jpg');
  });
  
  it('updateEvent should update an existing event', async () => {
    const eventId = 'event123';
    const updatedData = {
      title: 'Updated Event Title',
      description: 'Updated description'
    };
    
    await updateEvent(eventId, updatedData);
    
    expect(updateEvent).toHaveBeenCalledWith(eventId, updatedData);
  });
  
  it('getEventById should fetch a single event', async () => {
    const result = await getEventById('event123');
    
    expect(getEventById).toHaveBeenCalledWith('event123');
    expect(result).toEqual({
      id: 'event123',
      title: 'Test Event',
      date: '2024-09-15',
      description: 'A test event'
    });
  });
  
  it('getEventById should return null if event does not exist', async () => {
    getEventById.mockResolvedValueOnce(null);
    const result = await getEventById('');
    
    expect(result).toBeNull();
  });
  
  it('deleteEvent should delete an event document', async () => {
    await deleteEvent('event123');
    
    expect(deleteEvent).toHaveBeenCalledWith('event123');
  });
});
  