#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const LOGS_DIR = 'logs';

function viewLogs() {
  const args = process.argv.slice(2);
  const logType = args[0] || 'requests'; // 'requests' or 'errors'
  const lines = parseInt(args[1]) || 50; // Number of lines to show
  
  const logFile = path.join(LOGS_DIR, `api-${logType}-${new Date().toISOString().split('T')[0]}.log`);
  
  if (!fs.existsSync(logFile)) {
    console.log(`❌ Log file not found: ${logFile}`);
    console.log('Available log files:');
    
    if (fs.existsSync(LOGS_DIR)) {
      const files = fs.readdirSync(LOGS_DIR);
      files.forEach(file => {
        if (file.endsWith('.log')) {
          console.log(`  - ${file}`);
        }
      });
    }
    return;
  }
  
  const logContent = fs.readFileSync(logFile, 'utf8');
  const logLines = logContent.trim().split('\n').filter(line => line.trim());
  
  console.log(`📊 Viewing last ${lines} entries from: ${logFile}\n`);
  console.log('='.repeat(80));
  
  // Show last N lines
  const lastLines = logLines.slice(-lines);
  
  lastLines.forEach((line, index) => {
    try {
      const logEntry = JSON.parse(line);
      console.log(`\n[${index + 1}] ${logEntry.timestamp}`);
      console.log(`Action: ${logEntry.action || logEntry.type}`);
      
      if (logEntry.details) {
        console.log('Details:', JSON.stringify(logEntry.details, null, 2));
      }
      
      if (logEntry.error) {
        console.log('Error:', JSON.stringify(logEntry.error, null, 2));
      }
      
      if (logEntry.usageStats) {
        console.log('Usage Stats:', {
          requestsThisHour: logEntry.usageStats.requestsThisHour,
          requestsThisDay: logEntry.usageStats.requestsThisDay,
          estimatedCostToday: logEntry.usageStats.estimatedCostToday,
          consecutiveFailures: logEntry.usageStats.consecutiveFailures,
          circuitBreakerOpen: logEntry.usageStats.circuitBreakerOpen
        });
      }
      
      console.log('-'.repeat(40));
    } catch (error) {
      console.log(`[${index + 1}] Raw line: ${line}`);
    }
  });
  
  console.log(`\n📈 Total log entries: ${logLines.length}`);
}

function analyzeLogs() {
  const today = new Date().toISOString().split('T')[0];
  const requestsLog = path.join(LOGS_DIR, `api-requests-${today}.log`);
  const errorsLog = path.join(LOGS_DIR, `api-errors-${today}.log`);
  
  console.log('📊 API Log Analysis for Today\n');
  console.log('='.repeat(50));
  
  // Analyze requests
  if (fs.existsSync(requestsLog)) {
    const requestsContent = fs.readFileSync(requestsLog, 'utf8');
    const requestLines = requestsContent.trim().split('\n').filter(line => line.trim());
    
    const requestStats = {
      total: requestLines.length,
      apiCalls: 0,
      queueAdds: 0,
      usageUpdates: 0,
      successful: 0,
      failed: 0
    };
    
    requestLines.forEach(line => {
      try {
        const entry = JSON.parse(line);
        if (entry.action === 'API_CALL_START') requestStats.apiCalls++;
        if (entry.action === 'QUEUE_ADD') requestStats.queueAdds++;
        if (entry.action === 'USAGE_UPDATE') {
          requestStats.usageUpdates++;
          if (entry.details?.success) requestStats.successful++;
          else requestStats.failed++;
        }
      } catch (error) {
        // Skip malformed lines
      }
    });
    
    console.log('📈 Request Statistics:');
    console.log(`  Total Log Entries: ${requestStats.total}`);
    console.log(`  API Calls Started: ${requestStats.apiCalls}`);
    console.log(`  Queue Additions: ${requestStats.queueAdds}`);
    console.log(`  Usage Updates: ${requestStats.usageUpdates}`);
    console.log(`  Successful Requests: ${requestStats.successful}`);
    console.log(`  Failed Requests: ${requestStats.failed}`);
  }
  
  // Analyze errors
  if (fs.existsSync(errorsLog)) {
    const errorsContent = fs.readFileSync(errorsLog, 'utf8');
    const errorLines = errorsContent.trim().split('\n').filter(line => line.trim());
    
    console.log('\n❌ Error Statistics:');
    console.log(`  Total Errors: ${errorLines.length}`);
    
    const errorTypes = {};
    errorLines.forEach(line => {
      try {
        const entry = JSON.parse(line);
        const errorType = entry.error?.status || entry.error?.code || 'unknown';
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      } catch (error) {
        // Skip malformed lines
      }
    });
    
    Object.entries(errorTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--analyze') || args.includes('-a')) {
  analyzeLogs();
} else {
  viewLogs();
}
