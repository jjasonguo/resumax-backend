import fetch from 'node-fetch';

const testBackend = async () => {
  try {
    console.log('🔧 Testing backend connection...');
    
    const response = await fetch('http://localhost:5001/api/users');
    console.log('🔧 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('🔧 Backend is working!');
      console.log('🔧 Response:', data);
    } else {
      console.log('🔧 Backend error:', response.status);
    }
  } catch (error) {
    console.error('🔧 Backend connection failed:', error.message);
  }
};

testBackend(); 