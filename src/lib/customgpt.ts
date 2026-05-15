const API_TOKEN = import.meta.env.VITE_CUSTOMGPT_API_TOKEN;
const PROJECT_ID = import.meta.env.VITE_CUSTOMGPT_PROJECT_ID;
const BASE_URL = 'https://app.customgpt.ai/api/v1';

export async function createConversation(name: string = 'Session MVP') {
  const response = await fetch(`${BASE_URL}/projects/${PROJECT_ID}/conversations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  });
  
  if (!response.ok) {
    throw new Error('Failed to create conversation');
  }
  
  const data = await response.json();
  return data.data.session_id;
}

export async function sendMessage(sessionId: string, prompt: string) {
  const response = await fetch(`${BASE_URL}/projects/${PROJECT_ID}/conversations/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  const data = await response.json();
  return data.data.openai_response;
}
