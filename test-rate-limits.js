#!/usr/bin/env node

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:5001/api';

async function testRateLimits() {
  console.log('🧪 Testing Rate Limits and Safeguards...\n');
  
  try {
    // Test 1: Check initial queue status
    console.log('📊 Test 1: Checking initial queue status...');
    const statusResponse = await fetch(`${API_BASE_URL}/applications/queue-status`);
    const statusData = await statusResponse.json();
    console.log('✅ Queue Status:', {
      queueLength: statusData.queueLength,
      isProcessing: statusData.isProcessing,
      requestsThisHour: statusData.apiUsageStats.requestsThisHour,
      requestsThisDay: statusData.apiUsageStats.requestsThisDay
    });

    // Test 2: Try to make a test application (this should fail due to quota)
    console.log('\n📝 Test 2: Attempting test application...');
    const testResponse = await fetch(`${API_BASE_URL}/applications/automate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jobUrl: 'https://example.com/test-job',
        clerkUserId: 'test-user-123'
      })
    });

    const testData = await testResponse.json();
    console.log('📋 Test Response Status:', testResponse.status);
    console.log('📋 Test Response:', testData);

    if (testData.errorType === 'quota_exceeded') {
      console.log('✅ Rate limiting working correctly - quota exceeded error caught');
    } else if (testData.errorType === 'rate_limit') {
      console.log('✅ Rate limiting working correctly - rate limit error caught');
    } else {
      console.log('⚠️  Unexpected error type:', testData.errorType);
    }

    // Test 3: Check queue status after test
    console.log('\n📊 Test 3: Checking queue status after test...');
    const finalStatusResponse = await fetch(`${API_BASE_URL}/applications/queue-status`);
    const finalStatusData = await finalStatusResponse.json();
    console.log('✅ Final Queue Status:', {
      queueLength: finalStatusData.queueLength,
      isProcessing: finalStatusData.isProcessing,
      requestsThisHour: finalStatusData.apiUsageStats.requestsThisHour,
      requestsThisDay: finalStatusData.apiUsageStats.requestsThisDay,
      consecutiveFailures: finalStatusData.apiUsageStats.consecutiveFailures,
      circuitBreakerOpen: finalStatusData.apiUsageStats.circuitBreakerOpen
    });

    console.log('\n🎯 Test Summary:');
    console.log('================');
    if (finalStatusData.apiUsageStats.consecutiveFailures > 0) {
      console.log('✅ Consecutive failures tracked correctly');
    }
    if (finalStatusData.apiUsageStats.requestsThisHour > 0) {
      console.log('✅ Request counting working correctly');
    }
    if (testData.errorType) {
      console.log('✅ Error categorization working correctly');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testRateLimits().catch(console.error);
