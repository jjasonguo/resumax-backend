#!/usr/bin/env node

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:5001/api';

async function checkQueueStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/applications/queue-status`);
    const data = await response.json();
    
    console.log('📊 Queue Status:');
    console.log('================');
    console.log(`Queue Length: ${data.queueLength}`);
    console.log(`Is Processing: ${data.isProcessing}`);
    console.log(`Last Request Time: ${data.lastRequestTime}`);
    
    console.log('\n🛡️ API Safeguards:');
    console.log('==================');
    console.log(`Max Requests/Hour: ${data.apiSafeguards.maxRequestsPerHour}`);
    console.log(`Max Requests/Day: ${data.apiSafeguards.maxRequestsPerDay}`);
    console.log(`Max Cost/Day: $${data.apiSafeguards.maxCostPerDay}`);
    console.log(`Max Concurrent Requests: ${data.apiSafeguards.maxConcurrentRequests}`);
    console.log(`Circuit Breaker Threshold: ${data.apiSafeguards.circuitBreakerThreshold}`);
    console.log(`Max Queue Size: ${data.apiSafeguards.maxQueueSize}`);
    
    console.log('\n💰 API Usage Statistics:');
    console.log('========================');
    console.log(`Requests This Hour: ${data.apiUsageStats.requestsThisHour}/${data.apiSafeguards.maxRequestsPerHour}`);
    console.log(`Requests This Day: ${data.apiUsageStats.requestsThisDay}/${data.apiSafeguards.maxRequestsPerDay}`);
    console.log(`Estimated Cost Today: $${data.apiUsageStats.estimatedCostToday.toFixed(2)}/$${data.apiSafeguards.maxCostPerDay}`);
    console.log(`Active Requests: ${data.apiUsageStats.activeRequests}/${data.apiSafeguards.maxConcurrentRequests}`);
    console.log(`Total Requests: ${data.apiUsageStats.totalRequests}`);
    console.log(`Consecutive Failures: ${data.apiUsageStats.consecutiveFailures}`);
    console.log(`Circuit Breaker Open: ${data.apiUsageStats.circuitBreakerOpen}`);
    
    // Calculate usage percentages
    const hourlyUsage = (data.apiUsageStats.requestsThisHour / data.apiSafeguards.maxRequestsPerHour * 100).toFixed(1);
    const dailyUsage = (data.apiUsageStats.requestsThisDay / data.apiSafeguards.maxRequestsPerDay * 100).toFixed(1);
    const costUsage = (data.apiUsageStats.estimatedCostToday / data.apiSafeguards.maxCostPerDay * 100).toFixed(1);
    
    console.log('\n📈 Usage Percentages:');
    console.log('=====================');
    console.log(`Hourly Usage: ${hourlyUsage}%`);
    console.log(`Daily Usage: ${dailyUsage}%`);
    console.log(`Cost Usage: ${costUsage}%`);
    
    // Warning indicators
    if (hourlyUsage > 80) {
      console.log('⚠️  WARNING: High hourly usage!');
    }
    if (dailyUsage > 80) {
      console.log('⚠️  WARNING: High daily usage!');
    }
    if (costUsage > 80) {
      console.log('⚠️  WARNING: High cost usage!');
    }
    if (data.apiUsageStats.circuitBreakerOpen) {
      console.log('🚨 ALERT: Circuit breaker is open!');
    }
    
  } catch (error) {
    console.error('❌ Error checking queue status:', error.message);
  }
}

async function emergencyStop() {
  try {
    console.log('🚨 Executing emergency stop...');
    const response = await fetch(`${API_BASE_URL}/applications/emergency-stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Emergency stop executed successfully');
      console.log('Timestamp:', data.timestamp);
    } else {
      console.error('❌ Failed to execute emergency stop');
    }
  } catch (error) {
    console.error('❌ Error executing emergency stop:', error.message);
  }
}

async function monitorRateLimits() {
  console.log('🔍 Monitoring OpenAI API Rate Limits & Safeguards...\n');
  
  // Check initial status
  await checkQueueStatus();
  
  // Monitor every 30 seconds
  setInterval(async () => {
    console.log('\n' + '='.repeat(80));
    console.log(`🕐 ${new Date().toLocaleTimeString()}`);
    await checkQueueStatus();
  }, 30000);
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--emergency-stop') || args.includes('-e')) {
  emergencyStop().then(() => process.exit(0));
} else {
  // Start monitoring
  monitorRateLimits().catch(console.error);
}
