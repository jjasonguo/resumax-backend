import OpenAI from 'openai';
import puppeteer from 'puppeteer';
import User from '../models/User.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Rate limiting and batching configuration
const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 20, // Conservative limit
  maxTokensPerMinute: 150000,
  maxRetries: 3,
  baseDelay: 1000, // 1 second base delay
  maxDelay: 60000, // 1 minute max delay
  batchSize: 5, // Process multiple applications in batches
  queueTimeout: 300000 // 5 minutes timeout
};

// API Credit Protection Configuration
const API_SAFEGUARDS = {
  maxRequestsPerHour: 100, // Maximum requests per hour
  maxRequestsPerDay: 1000, // Maximum requests per day
  maxCostPerDay: 10.00, // Maximum cost in USD per day (adjust based on your plan)
  estimatedCostPerRequest: 0.05, // Estimated cost per request in USD
  circuitBreakerThreshold: 5, // Number of consecutive failures before circuit breaker
  circuitBreakerTimeout: 300000, // 5 minutes circuit breaker timeout
  maxConcurrentRequests: 3, // Maximum concurrent API requests
  requestTimeout: 30000, // 30 seconds timeout per request
  maxQueueSize: 50, // Maximum items in queue to prevent memory issues
  emergencyStopThreshold: 100 // Emergency stop if requests exceed this in 1 hour
};

// Request queue for batching
let requestQueue = [];
let isProcessingQueue = false;
let lastRequestTime = 0;

// API Credit Protection State
let apiUsageStats = {
  requestsThisHour: 0,
  requestsThisDay: 0,
  estimatedCostToday: 0,
  consecutiveFailures: 0,
  circuitBreakerOpen: false,
  circuitBreakerOpenedAt: null,
  activeRequests: 0,
  totalRequests: 0,
  lastRequestTimestamp: null
};

// Hourly and daily reset timers
let hourlyResetTimer = null;
let dailyResetTimer = null;

// Initialize timers
const initializeTimers = () => {
  // Reset hourly stats every hour
  hourlyResetTimer = setInterval(() => {
    apiUsageStats.requestsThisHour = 0;
    console.log('🔄 Hourly API usage reset');
  }, 60 * 60 * 1000);

  // Reset daily stats every day
  dailyResetTimer = setInterval(() => {
    apiUsageStats.requestsThisDay = 0;
    apiUsageStats.estimatedCostToday = 0;
    console.log('🔄 Daily API usage reset');
  }, 24 * 60 * 60 * 1000);
};

// Start timers
initializeTimers();

// Logging utilities
const logApiRequest = (action, details) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    action,
    details,
    usageStats: { ...apiUsageStats }
  };

  // Console logging
  console.log(`📊 API Request Log [${timestamp}]:`, JSON.stringify(logEntry, null, 2));

  // File logging
  const logDir = 'logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = path.join(logDir, `api-requests-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
};

const logApiError = (error, context) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    type: 'API_ERROR',
    error: {
      message: error.message,
      status: error.status,
      code: error.code
    },
    context,
    usageStats: { ...apiUsageStats }
  };

  console.error(`❌ API Error Log [${timestamp}]:`, JSON.stringify(logEntry, null, 2));

  // File logging
  const logDir = 'logs';
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const errorLogFile = path.join(logDir, `api-errors-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(errorLogFile, JSON.stringify(logEntry) + '\n');
};

// Rate limiting utilities
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const calculateBackoffDelay = (attempt) => {
  const delay = Math.min(
    RATE_LIMIT_CONFIG.baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
    RATE_LIMIT_CONFIG.maxDelay
  );
  return delay;
};

const waitForRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  const minInterval = 60000 / RATE_LIMIT_CONFIG.maxRequestsPerMinute; // 60 seconds / requests per minute
  
  if (timeSinceLastRequest < minInterval) {
    const waitTime = minInterval - timeSinceLastRequest;
    console.log(`⏳ Rate limiting: waiting ${waitTime}ms before next request`);
    await sleep(waitTime);
  }
  lastRequestTime = Date.now();
};

// API Credit Protection Functions
const checkApiSafeguards = () => {
  const now = Date.now();

  // Check circuit breaker
  if (apiUsageStats.circuitBreakerOpen) {
    const timeSinceCircuitBreaker = now - apiUsageStats.circuitBreakerOpenedAt;
    if (timeSinceCircuitBreaker < API_SAFEGUARDS.circuitBreakerTimeout) {
      throw new Error(`Circuit breaker is open. API calls blocked for ${Math.ceil((API_SAFEGUARDS.circuitBreakerTimeout - timeSinceCircuitBreaker) / 1000)} more seconds`);
    } else {
      // Reset circuit breaker
      apiUsageStats.circuitBreakerOpen = false;
      apiUsageStats.consecutiveFailures = 0;
      console.log('🔄 Circuit breaker reset');
    }
  }

  // Check hourly limit
  if (apiUsageStats.requestsThisHour >= API_SAFEGUARDS.maxRequestsPerHour) {
    throw new Error(`Hourly API request limit exceeded (${API_SAFEGUARDS.maxRequestsPerHour}). Please try again later.`);
  }

  // Check daily limit
  if (apiUsageStats.requestsThisDay >= API_SAFEGUARDS.maxRequestsPerDay) {
    throw new Error(`Daily API request limit exceeded (${API_SAFEGUARDS.maxRequestsPerDay}). Please try again tomorrow.`);
  }

  // Check cost limit
  if (apiUsageStats.estimatedCostToday >= API_SAFEGUARDS.maxCostPerDay) {
    throw new Error(`Daily cost limit exceeded ($${API_SAFEGUARDS.maxCostPerDay}). Please check your billing.`);
  }

  // Check concurrent requests
  if (apiUsageStats.activeRequests >= API_SAFEGUARDS.maxConcurrentRequests) {
    throw new Error(`Too many concurrent API requests (${apiUsageStats.activeRequests}/${API_SAFEGUARDS.maxConcurrentRequests}). Please wait.`);
  }

  // Emergency stop check (if requests are too frequent)
  if (apiUsageStats.lastRequestTimestamp) {
    const timeSinceLastRequest = now - apiUsageStats.lastRequestTimestamp;
    if (timeSinceLastRequest < 1000 && apiUsageStats.requestsThisHour > API_SAFEGUARDS.emergencyStopThreshold) {
      throw new Error('Emergency stop: Too many rapid API requests detected. Please check for infinite loops.');
    }
  }
};

const updateApiUsage = (success = true) => {
  const now = Date.now();
  
  apiUsageStats.requestsThisHour++;
  apiUsageStats.requestsThisDay++;
  apiUsageStats.estimatedCostToday += API_SAFEGUARDS.estimatedCostPerRequest;
  apiUsageStats.totalRequests++;
  apiUsageStats.lastRequestTimestamp = now;

  if (success) {
    apiUsageStats.consecutiveFailures = 0;
  } else {
    apiUsageStats.consecutiveFailures++;
    
    // Check if circuit breaker should open
    if (apiUsageStats.consecutiveFailures >= API_SAFEGUARDS.circuitBreakerThreshold) {
      apiUsageStats.circuitBreakerOpen = true;
      apiUsageStats.circuitBreakerOpenedAt = now;
      console.log('🚨 Circuit breaker opened due to consecutive failures');
    }
  }

  logApiRequest('USAGE_UPDATE', {
    success,
    consecutiveFailures: apiUsageStats.consecutiveFailures,
    circuitBreakerOpen: apiUsageStats.circuitBreakerOpen
  });
};

// Initialize OpenAI with retry logic
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Retry wrapper for OpenAI API calls with comprehensive safeguards
const retryOpenAIRequest = async (apiCall, maxRetries = RATE_LIMIT_CONFIG.maxRetries) => {
  // Check safeguards before making any request
  checkApiSafeguards();

  // Increment active requests
  apiUsageStats.activeRequests++;

  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await waitForRateLimit();
        
        logApiRequest('API_CALL_START', {
          attempt: attempt + 1,
          maxRetries,
          activeRequests: apiUsageStats.activeRequests
        });

        // Add timeout to the API call
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), API_SAFEGUARDS.requestTimeout);
        });

        const result = await Promise.race([apiCall(), timeoutPromise]);
        
        logApiRequest('API_CALL_SUCCESS', {
          attempt: attempt + 1,
          result: typeof result === 'string' ? result.substring(0, 100) + '...' : 'Object'
        });

        updateApiUsage(true);
        return result;
        
      } catch (error) {
        logApiError(error, { attempt: attempt + 1, maxRetries });
        
        if (error.status === 429) {
          // Rate limit error
          const delay = calculateBackoffDelay(attempt);
          console.log(`🔄 Rate limit hit, retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        } else if (error.status === 402 || error.code === 'insufficient_quota') {
          // Quota exceeded - this is a hard error
          updateApiUsage(false);
          throw new Error('OpenAI quota exceeded. Please check your billing and plan details.');
        } else if (error.message === 'Request timeout') {
          // Timeout error
          console.log(`⏰ Request timeout on attempt ${attempt + 1}`);
          if (attempt === maxRetries) {
            updateApiUsage(false);
            throw new Error('Request timeout after all retries');
          }
          continue;
        } else if (attempt === maxRetries) {
          // Max retries reached
          updateApiUsage(false);
          throw error;
        } else {
          // Other errors - retry with backoff
          const delay = calculateBackoffDelay(attempt);
          console.log(`🔄 API error, retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }
  } finally {
    // Decrement active requests
    apiUsageStats.activeRequests--;
  }
};

// Queue processor for batching requests with safeguards
const processQueue = async () => {
  if (isProcessingQueue || requestQueue.length === 0) {
    return;
  }
  
  // Check queue size limit
  if (requestQueue.length > API_SAFEGUARDS.maxQueueSize) {
    console.log(`⚠️ Queue size limit exceeded (${requestQueue.length}/${API_SAFEGUARDS.maxQueueSize}). Dropping oldest requests.`);
    requestQueue = requestQueue.slice(-API_SAFEGUARDS.maxQueueSize);
  }
  
  isProcessingQueue = true;
  console.log(`🔄 Processing queue with ${requestQueue.length} items`);
  
  try {
    // Process requests in batches
    const batchSize = Math.min(RATE_LIMIT_CONFIG.batchSize, requestQueue.length);
    const batch = requestQueue.splice(0, batchSize);
    
    console.log(`📦 Processing batch of ${batch.length} requests`);
    
    // Process batch concurrently with rate limiting
    const batchPromises = batch.map(async (queueItem) => {
      try {
        const result = await queueItem.process();
        queueItem.resolve(result);
      } catch (error) {
        queueItem.reject(error);
      }
    });
    
    await Promise.all(batchPromises);
    
    // If there are more items in queue, process them after a delay
    if (requestQueue.length > 0) {
      setTimeout(processQueue, 2000); // 2 second delay between batches
    }
    
  } catch (error) {
    console.error('❌ Error processing queue:', error);
  } finally {
    isProcessingQueue = false;
  }
};

// Add request to queue with safeguards
const addToQueue = (process) => {
  return new Promise((resolve, reject) => {
    // Check queue size before adding
    if (requestQueue.length >= API_SAFEGUARDS.maxQueueSize) {
      reject(new Error(`Queue is full (${API_SAFEGUARDS.maxQueueSize} items). Please try again later.`));
      return;
    }

    const queueItem = { process, resolve, reject };
    requestQueue.push(queueItem);
    
    logApiRequest('QUEUE_ADD', {
      queueLength: requestQueue.length,
      maxQueueSize: API_SAFEGUARDS.maxQueueSize
    });
    
    // Start processing if not already running
    if (!isProcessingQueue) {
      processQueue();
    }
  });
};

// Application automation controller with comprehensive safeguards
export const automateApplication = async (req, res) => {
  try {
    const { jobUrl, clerkUserId } = req.body;
    
    if (!jobUrl || !clerkUserId) {
      return res.status(400).json({ 
        message: 'Job URL and user ID are required' 
      });
    }

    console.log('🤖 Starting application automation for:', jobUrl);

    // 1. Get user data from database
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 2. Create application strategy with rate limiting and safeguards
    const applicationStrategy = await addToQueue(async () => {
      return await createApplicationStrategy(jobUrl, user);
    });
    
    // 3. Execute automation with Puppeteer
    const result = await executeApplication(jobUrl, applicationStrategy, user);

    res.json({
      message: 'Application automation completed',
      result: result
    });

  } catch (error) {
    console.error('❌ Application automation error:', error);
    
    // Handle specific error types
    if (error.message.includes('quota exceeded')) {
      return res.status(429).json({ 
        message: 'OpenAI quota exceeded. Please try again later or check your billing.',
        error: error.message 
      });
    } else if (error.message.includes('limit exceeded') || error.message.includes('Circuit breaker')) {
      return res.status(429).json({ 
        message: error.message,
        error: error.message 
      });
    } else if (error.message.includes('Queue is full')) {
      return res.status(503).json({ 
        message: 'Service temporarily unavailable. Please try again later.',
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      message: 'Error automating application', 
      error: error.message 
    });
  }
};

// Create application strategy using OpenAI with rate limiting and safeguards
const createApplicationStrategy = async (jobUrl, user) => {
  // Debug: Check if API key is loaded
  console.log('🔑 OpenAI API Key loaded:', process.env.OPENAI_API_KEY ? 'Yes' : 'No');
  
  const prompt = `
You are an expert job application assistant. Analyze this job application URL and create a strategy for filling it out.

Job URL: ${jobUrl}
User Profile:
- Name: ${user.name}
- Email: ${user.email}
- Phone: ${user.phone}
- University: ${user.university}
- Major: ${user.major}
- LinkedIn: ${user.linkedinUrl}
- GitHub: ${user.githubUrl}

Work Experience: ${JSON.stringify(user.parsedResumeData?.extractedWorkExperience || [])}
Projects: ${JSON.stringify(user.parsedResumeData?.extractedProjects || [])}

Create a detailed strategy for:
1. Identifying form fields on the page
2. Mapping user data to form fields
3. Handling different field types (text, dropdown, file upload, etc.)
4. Crafting appropriate responses for open-ended questions
5. Handling any CAPTCHA or verification steps

Return your strategy as a JSON object with field mappings and instructions.
`;

  return await retryOpenAIRequest(async () => {
    const completion = await openai.chat.completions.create({
      model: "o4-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at job application automation. Provide detailed, actionable strategies."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000, // Limit tokens to avoid hitting limits
    });

    return JSON.parse(completion.choices[0].message.content);
  });
};

// Execute application automation with Puppeteer
const executeApplication = async (jobUrl, strategy, user) => {
  const browser = await puppeteer.launch({ 
    headless: false, // Set to true for production
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('🌐 Navigating to job application...');
    await page.goto(jobUrl, { waitUntil: 'networkidle2' });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Execute the application strategy
    const result = await page.evaluate((strategy, user) => {
      const results = {
        filledFields: [],
        errors: [],
        status: 'completed'
      };

      try {
        // Fill basic information fields
        const fieldMappings = {
          'name': user.name,
          'email': user.email,
          'phone': user.phone,
          'university': user.university,
          'major': user.major,
          'linkedin': user.linkedinUrl,
          'github': user.githubUrl
        };

        // Find and fill form fields
        Object.entries(fieldMappings).forEach(([fieldType, value]) => {
          if (!value) return;

          // Try different selectors for each field type
          const selectors = [
            `input[name*="${fieldType}" i]`,
            `input[placeholder*="${fieldType}" i]`,
            `input[id*="${fieldType}" i]`,
            `textarea[name*="${fieldType}" i]`,
            `textarea[placeholder*="${fieldType}" i]`,
            `textarea[id*="${fieldType}" i]`
          ];

          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              element.value = value;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              results.filledFields.push({ field: fieldType, value: value, selector: selector });
              break;
            }
          }
        });

        // Handle file uploads (resume)
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach((input, index) => {
          // Note: File uploads need to be handled differently in Puppeteer
          results.filledFields.push({ 
            field: 'file_upload', 
            index: index, 
            note: 'File upload detected - needs manual handling' 
          });
        });

        // Handle dropdowns and selects
        const selects = document.querySelectorAll('select');
        selects.forEach((select, index) => {
          if (select.options.length > 0) {
            // Try to find relevant options based on user data
            const userData = [user.major, user.university, '2024', '2025', 'Present'];
            for (const option of select.options) {
              if (userData.some(data => 
                data && option.text.toLowerCase().includes(data.toLowerCase())
              )) {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                results.filledFields.push({ 
                  field: 'dropdown', 
                  value: option.text, 
                  selector: `select[${index}]` 
                });
                break;
              }
            }
          }
        });

      } catch (error) {
        results.errors.push(error.message);
        results.status = 'error';
      }

      return results;
    }, strategy, user);

    console.log('✅ Form filling completed:', result);

    // Take a screenshot for verification
    const screenshot = await page.screenshot({ 
      fullPage: true,
      path: `uploads/application-${Date.now()}.png`
    });

    await browser.close();

    return {
      ...result,
      screenshot: screenshot.toString('base64')
    };

  } catch (error) {
    await browser.close();
    throw error;
  }
};

// Get application status
export const getApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    // This would typically query a database for application status
    // For now, return a mock status
    res.json({
      applicationId,
      status: 'completed',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error getting application status:', error);
    res.status(500).json({ 
      message: 'Error getting application status', 
      error: error.message 
    });
  }
};

// Get queue status (for monitoring)
export const getQueueStatus = async (req, res) => {
  try {
    res.json({
      queueLength: requestQueue.length,
      isProcessing: isProcessingQueue,
      lastRequestTime: new Date(lastRequestTime).toISOString(),
      rateLimitConfig: RATE_LIMIT_CONFIG,
      apiSafeguards: API_SAFEGUARDS,
      apiUsageStats: apiUsageStats
    });
  } catch (error) {
    console.error('❌ Error getting queue status:', error);
    res.status(500).json({ 
      message: 'Error getting queue status', 
      error: error.message 
    });
  }
};

// Emergency stop function (for admin use)
export const emergencyStop = async (req, res) => {
  try {
    // Clear queue
    requestQueue = [];
    isProcessingQueue = false;
    
    // Reset API usage stats
    apiUsageStats = {
      requestsThisHour: 0,
      requestsThisDay: 0,
      estimatedCostToday: 0,
      consecutiveFailures: 0,
      circuitBreakerOpen: false,
      circuitBreakerOpenedAt: null,
      activeRequests: 0,
      totalRequests: apiUsageStats.totalRequests, // Keep total for historical purposes
      lastRequestTimestamp: null
    };
    
    console.log('🚨 Emergency stop executed - all API requests halted');
    
    res.json({
      message: 'Emergency stop executed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error executing emergency stop:', error);
    res.status(500).json({ 
      message: 'Error executing emergency stop', 
      error: error.message 
    });
  }
};

// Cleanup function for graceful shutdown
export const cleanup = () => {
  if (hourlyResetTimer) {
    clearInterval(hourlyResetTimer);
  }
  if (dailyResetTimer) {
    clearInterval(dailyResetTimer);
  }
  console.log('🧹 Cleanup completed');
};

// Handle process termination
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, cleaning up...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, cleaning up...');
  cleanup();
  process.exit(0);
});
