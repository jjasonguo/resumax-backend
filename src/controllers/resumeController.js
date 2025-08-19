import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pdf from 'pdf-parse';
import User from '../models/User.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Parse PDF content and extract information
const parseResumeContent = (text) => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const extractedData = {
    rawText: text,
    name: '',
    email: '',
    phone: '',
    linkedinUrl: '',
    university: '',
    gpa: '',
    major: '',
    extractedSkills: [],
    extractedWorkExperience: [],
    extractedProjects: []
  };

  let currentSection = '';
  let currentExperience = null;
  let currentProject = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();
    
    // Extract name from first line
    if (i === 0 && !lowerLine.includes('|') && !lowerLine.includes('education')) {
      extractedData.name = line;
      continue;
    }

    // Extract contact info from second line
    if (i === 1 && line.includes('|')) {
      const parts = line.split('|').map(part => part.trim());
      if (parts.length >= 4) {
        // parts[0] = address, parts[1] = email, parts[2] = phone, parts[3] = linkedin
        extractedData.email = parts[1];
        extractedData.phone = parts[2];
        extractedData.linkedinUrl = parts[3];
      }
      continue;
    }

    // Detect sections
    if (lowerLine === 'education') {
      currentSection = 'education';
      continue;
    }
    
    if (lowerLine === 'relevant experience') {
      currentSection = 'experience';
      continue;
    }
    
    if (lowerLine === 'projects') {
      currentSection = 'projects';
      continue;
    }

    // Parse education section
    if (currentSection === 'education') {
      // Look for university line (contains "University" and "GPA")
      if (line.includes('University') && line.includes('GPA')) {
        const universityMatch = line.match(/([^|]+)/);
        if (universityMatch) {
          extractedData.university = universityMatch[1].trim();
        }
        
        const gpaMatch = line.match(/GPA:\s*([\d.]+)/);
        if (gpaMatch) {
          extractedData.gpa = gpaMatch[1];
        }
        continue;
      }

      // Look for major line (contains "Intended Major:")
      if (line.includes('Intended Major:')) {
        const majorMatch = line.match(/Intended Major:\s*(.+)/);
        if (majorMatch) {
          extractedData.major = majorMatch[1].trim();
        }
        continue;
      }
    }

    // Parse work experience section
    if (currentSection === 'experience') {
      // Look for job titles (lines that contain " at " and end with year)
      if (line.includes(' at ') && (line.includes('202') || line.includes('Present'))) {
        if (currentExperience) {
          extractedData.extractedWorkExperience.push(currentExperience);
        }
        
        currentExperience = {
          title: line,
          bullets: []
        };
        continue;
      }
      
      // Add bullet points to current experience
      if (currentExperience && line.startsWith('●')) {
        currentExperience.bullets.push(line.replace(/^●\s*/, ''));
      }
    }

    // Parse projects section
    if (currentSection === 'projects') {
      // Look for project titles (lines that contain " | " and end with year)
      if (line.includes(' | ') && (line.includes('202') || line.includes('Present'))) {
        if (currentProject) {
          extractedData.extractedProjects.push(currentProject);
        }
        
        currentProject = {
          title: line,
          bullets: []
        };
        continue;
      }
      
      // Add bullet points to current project
      if (currentProject && line.startsWith('●')) {
        currentProject.bullets.push(line.replace(/^●\s*/, ''));
      }
    }
  }

  // Add the last experience/project if exists
  if (currentExperience) {
    extractedData.extractedWorkExperience.push(currentExperience);
  }
  if (currentProject) {
    extractedData.extractedProjects.push(currentProject);
  }

  return extractedData;
};

// Upload and parse resume
export const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { clerkUserId } = req.body;
    if (!clerkUserId) {
      return res.status(400).json({ message: 'Clerk user ID is required' });
    }

    console.log('📄 Processing resume for user:', clerkUserId);
    console.log('📄 File:', req.file.originalname);

    // Read and parse the PDF
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdf(dataBuffer);
    
    console.log('📄 PDF parsed successfully, text length:', pdfData.text.length);
    console.log('📄 RAW PDF TEXT:');
    console.log('='.repeat(80));
    console.log(pdfData.text);
    console.log('='.repeat(80));

    // Parse the content
    const parsedData = parseResumeContent(pdfData.text);
    
    console.log('📄 Extracted personal info:', {
      name: parsedData.name,
      email: parsedData.email,
      phone: parsedData.phone,
      linkedinUrl: parsedData.linkedinUrl
    });
    console.log('📄 Extracted education:', {
      university: parsedData.university,
      gpa: parsedData.gpa,
      major: parsedData.major
    });
    console.log('📄 Extracted work experience:', parsedData.extractedWorkExperience.length, 'entries');
    console.log('📄 Extracted projects:', parsedData.extractedProjects.length, 'entries');

    // Update user with resume data
    const updatedUser = await User.findOneAndUpdate(
      { clerkUserId },
      {
        resumePdf: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          uploadDate: new Date()
        },
        parsedResumeData: parsedData
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);

    console.log('✅ Resume uploaded and parsed successfully for user:', clerkUserId);

    res.json({
      message: 'Resume uploaded and parsed successfully',
      user: updatedUser,
      extractedData: parsedData
    });

  } catch (error) {
    console.error('❌ Error uploading resume:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      message: 'Error uploading resume', 
      error: error.message 
    });
  }
};

// Get resume data for a user
export const getResumeData = async (req, res) => {
  try {
    const { clerkUserId } = req.params;
    
    const user = await User.findOne({ clerkUserId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      resumePdf: user.resumePdf,
      parsedResumeData: user.parsedResumeData
    });

  } catch (error) {
    console.error('❌ Error getting resume data:', error);
    res.status(500).json({ 
      message: 'Error getting resume data', 
      error: error.message 
    });
  }
};

export { upload };
