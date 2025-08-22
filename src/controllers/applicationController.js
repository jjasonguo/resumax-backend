import OpenAI from 'openai';
import puppeteer from 'puppeteer';
import User from '../models/User.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Application automation controller
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

    // 2. Create application strategy with OpenAI
    const applicationStrategy = await createApplicationStrategy(jobUrl, user);
    
    // 3. Execute automation with Puppeteer
    const result = await executeApplication(jobUrl, applicationStrategy, user);

    res.json({
      message: 'Application automation completed',
      result: result
    });

  } catch (error) {
    console.error('❌ Application automation error:', error);
    res.status(500).json({ 
      message: 'Error automating application', 
      error: error.message 
    });
  }
};

// Create application strategy using OpenAI
const createApplicationStrategy = async (jobUrl, user) => {
  // Debug: Check if API key is loaded
  console.log('🔑 OpenAI API Key loaded:', process.env.OPENAI_API_KEY ? 'Yes' : 'No');
  
  // Initialize OpenAI with API key
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

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

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
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
  });

  return JSON.parse(completion.choices[0].message.content);
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
