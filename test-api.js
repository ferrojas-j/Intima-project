const API_TOKEN = '10208|14lKozsmjKKMWLzRm4NusxPPTlpfivDQMuXFy3PUee76ddd8';
const BASE_URL = 'https://app.customgpt.ai/api/v1';

async function test() {
  try {
    console.log("Listing projects...");
    const response = await fetch(`${BASE_URL}/projects`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}

test();
