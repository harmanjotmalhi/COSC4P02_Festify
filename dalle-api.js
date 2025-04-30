// DALL-E API Integration
import { config } from './config.js';
import { getApiKey } from './firebase.js';

const API_URL = 'https://api.openai.com/v1/images/generations';

export async function generateEventPoster(eventTitle, eventDescription) {
  try {
    // Get OpenAI API key from Firebase
    const OPENAI_API_KEY = await getApiKey('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not found');
    }
    
    const prompt = `Create a professional event poster for: ${eventTitle}. Description: ${eventDescription}. 
    The poster should be modern, visually appealing, and suitable for social media sharing. 
    Include elements that represent the event theme and make it stand out.`;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid"
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].url;
  } catch (error) {
    console.error('Error generating poster:', error);
    throw error;
  }
}