import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:5001/api';

async function testFillNameEndpoint() {
  try {
    console.log('🧪 Testing fill name endpoint (with apply button click + 5s wait)...');
    
    // Test with a sample URL and clerkUserId
    const testData = {
      url: 'https://tower-research.com/open-positions/?gh_jid=6653745',
      clerkUserId: 'user_30vlF2Uqt64OZ1ifyXhtDYFJd0E'
    };
    
    const response = await fetch(`${API_BASE_URL}/automation/fill-name`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Fill name endpoint test successful!');
      console.log('Response:', JSON.stringify(result, null, 2));
      console.log('📋 Summary:');
      console.log(`   - Apply button found: ${result.apply ? 'Yes' : 'No'}`);
      console.log(`   - Apply button clicked: ${result.applyClicked ? 'Yes' : 'No'}`);
      console.log(`   - Click method: ${result.clickMethod || 'N/A'}`);
      console.log(`   - Textbox filled: ${result.textbox ? 'Yes' : 'No'}`);
      console.log(`   - User name used: ${result.userName || 'N/A'}`);
      console.log(`   - Status: ${result.status || 'N/A'}`);
    } else {
      console.log('❌ Fill name endpoint test failed!');
      console.log('Status:', response.status);
      console.log('Error:', result);
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

async function testGetUserNameEndpoint() {
  try {
    console.log('🧪 Testing get user name endpoint...');
    
    const testClerkUserId = 'test-clerk-user-id';
    
    const response = await fetch(`${API_BASE_URL}/users/clerk/${testClerkUserId}/name`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Get user name endpoint test successful!');
      console.log('Response:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Get user name endpoint test failed!');
      console.log('Status:', response.status);
      console.log('Error:', result);
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run tests
console.log('🚀 Starting endpoint tests...\n');

testGetUserNameEndpoint()
  .then(() => {
    console.log('\n' + '='.repeat(50) + '\n');
    return testFillNameEndpoint();
  })
  .then(() => {
    console.log('\n✅ All tests completed!');
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
  });
