// Simple connectivity test for the Render backend
const testAPI = async () => {
  try {
    console.log('Testing API connectivity...');
    
    const response = await fetch('https://glovers.onrender.com/api/health', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API is working:', data);
      return true;
    } else {
      console.log('❌ API returned error:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.log('❌ API connection failed:', error.message);
    return false;
  }
};

// Run the test
testAPI().then(result => {
  if (result) {
    console.log('Backend is accessible');
  } else {
    console.log('Backend is not accessible - check if it\'s running');
  }
});