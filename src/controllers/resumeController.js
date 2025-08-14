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
    extractedSkills: [],
    extractedEducation: [],
    extractedExperience: []
  };

  // Extract skills (look for common skill keywords)
  const skillKeywords = [
    'javascript', 'python', 'java', 'react', 'node.js', 'mongodb', 'sql', 'html', 'css',
    'typescript', 'angular', 'vue', 'express', 'django', 'flask', 'aws', 'docker', 'kubernetes',
    'git', 'agile', 'scrum', 'leadership', 'communication', 'problem solving', 'teamwork'
  ];

  lines.forEach(line => {
    const lowerLine = line.toLowerCase();
    
    // Extract skills
    skillKeywords.forEach(skill => {
      if (lowerLine.includes(skill) && !extractedData.extractedSkills.includes(skill)) {
        extractedData.extractedSkills.push(skill);
      }
    });

    // Extract education (look for degree keywords)
    if (lowerLine.includes('bachelor') || lowerLine.includes('master') || 
        lowerLine.includes('phd') || lowerLine.includes('degree') ||
        lowerLine.includes('university') || lowerLine.includes('college')) {
      extractedData.extractedEducation.push(line);
    }

    // Extract experience (look for job-related keywords)
    if (lowerLine.includes('experience') || lowerLine.includes('work') ||
        lowerLine.includes('job') || lowerLine.includes('position') ||
        lowerLine.includes('role') || lowerLine.includes('responsibilities')) {
      extractedData.extractedExperience.push(line);
    }
  });

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

    // Parse the content
    const parsedData = parseResumeContent(pdfData.text);
    
    console.log('📄 Extracted skills:', parsedData.extractedSkills.length);
    console.log('📄 Extracted education:', parsedData.extractedEducation.length);
    console.log('📄 Extracted experience:', parsedData.extractedExperience.length);

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
