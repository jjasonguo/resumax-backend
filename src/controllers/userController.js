import User from "../models/User.js";

// User CRUD Operations
export const createUser = async (req, res) => {
  try {
    const user = new User(req.body);
    const savedUser = await user.save();
    res.status(201).json(savedUser);
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ message: "User with this email already exists" });
    } else {
      res.status(500).json({ message: "Error creating user", error: error.message });
    }
  }
};

export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user", error: error.message });
  }
};

export const getUserByEmail = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user", error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error updating user", error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting user", error: error.message });
  }
};

// Project Operations
export const addProject = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          projects: req.body
        }
      },
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error adding project", error: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, "projects._id": req.params.projectId },
      {
        $set: {
          "projects.$.projectName": req.body.projectName,
          "projects.$.skills": req.body.skills,
          "projects.$.sampleBullets": req.body.sampleBullets,
          "projects.$.updatedAt": new Date()
        }
      },
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({ message: "User or project not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error updating project", error: error.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $pull: {
          projects: { _id: req.params.projectId }
        }
      },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error deleting project", error: error.message });
  }
};

// Work Experience Operations
export const addWorkExperience = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          workExperiences: req.body
        }
      },
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error adding work experience", error: error.message });
  }
};

export const updateWorkExperience = async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, "workExperiences._id": req.params.experienceId },
      {
        $set: {
          "workExperiences.$.company": req.body.company,
          "workExperiences.$.position": req.body.position,
          "workExperiences.$.startDate": req.body.startDate,
          "workExperiences.$.endDate": req.body.endDate,
          "workExperiences.$.skills": req.body.skills,
          "workExperiences.$.sampleBullets": req.body.sampleBullets,
          "workExperiences.$.updatedAt": new Date()
        }
      },
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(404).json({ message: "User or work experience not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error updating work experience", error: error.message });
  }
};

export const deleteWorkExperience = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        $pull: {
          workExperiences: { _id: req.params.experienceId }
        }
      },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error deleting work experience", error: error.message });
  }
};

// Search and Analytics Operations
export const searchUsersBySkills = async (req, res) => {
  try {
    const { skills } = req.query;
    const skillsArray = skills.split(',').map(skill => skill.trim());
    
    const users = await User.find({
      $or: [
        { "projects.skills": { $in: skillsArray } },
        { "workExperiences.skills": { $in: skillsArray } }
      ]
    });
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error searching users", error: error.message });
  }
};

export const getUsersByCompany = async (req, res) => {
  try {
    const users = await User.find({
      "workExperiences.company": req.params.company
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users by company", error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error: error.message });
  }
}; 