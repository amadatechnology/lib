require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const User = require('./models/userSchema');
const Event = require('./models/eventSchema');
const Activity = require('./models/activitySchema');





const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((error) => console.error('MongoDB connection error:', error));

  

  
  

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Access Denied / Unauthorized request" });

  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      console.error("JWT Verification Error:", err.message);
      return res.status(403).json({ message: "Invalid Token" });
    }
    req.userId = decoded.userId;
    next();
  });
};

// Function to generate access token
const generateAccessToken = (userId) => {
  const expiresIn = '24h'; // Adjust based on your requirements
  const accessToken = jwt.sign({ userId }, process.env.SECRET_KEY, { expiresIn });
  return { accessToken, expiresIn };
};

const generateVerificationCode = () => {
  // Generate a random 6-digit code
  return Math.floor(100000 + Math.random() * 900000).toString();
};


// Login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const { accessToken, expiresIn } = generateAccessToken(user._id);
    res.json({
      accessToken,
      expiresIn,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        emailVerified: user.emailVerified,
        profileComplete: user.profileComplete,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        followers: user.followers.length,
        following: user.following.length,
        ips: user.ips,
        interests: user.interests,
        attending: user.attending,
        location: user.location
        // Include other necessary user data
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: "An error occurred during the login process." });
  }
});


// Registration endpoint
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email already in use." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      password: hashedPassword,
      profileComplete: false,
      emailVerified: false,
      // Include other fields based on your schema
    });

    const savedUser = await newUser.save();

    const { accessToken, expiresIn } = generateAccessToken(savedUser._id);

    res.status(201).json({
      message: "User registered successfully.",
      accessToken,
      user: {
        id: savedUser._id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        phone: savedUser.phone,
        emailVerified: savedUser.emailVerified,
        profileComplete: savedUser.profileComplete,
        role: savedUser.role,
        createdAt: savedUser.createdAt,
        lastLogin: savedUser.lastLogin,
        followers: savedUser.followers.length,
        following: savedUser.following.length,
        ips: savedUser.ips,
        interests: savedUser.interests,
        attending: savedUser.attending,
        location: savedUser.location
        // Include other necessary user data
      },
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: "Error registering user." });
  }
});

// Define the /current-user endpoint
app.get('/current-user', authenticateToken, async (req, res) => {
  try {
    // Fetch the user data using the userId from the authenticated token
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Fetch recent activities for the user
    const activities = await Activity.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(10); // Limit to the last 10 activities, adjust as needed

    // Return the user data along with activities in the response
    res.json({
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      emailVerified: user.emailVerified,
      profileComplete: user.profileComplete,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      followers: user.followers.length,
      following: user.following.length,
      ips: user.ips,
      interests: user.interests,
      attending: user.attending,
      location: user.location,
      activities: activities,
    });
  } catch (error) {
    console.error('Error fetching current user data:', error);
    res.status(500).json({ message: 'An error occurred during the fetch.' });
  }
});


app.post('/refresh-token', async (req, res) => {
  const refreshToken = req.body.refreshToken;

  if (!refreshToken) {
    return res.sendStatus(401);
  }

  try {
    // Verify the refresh token
    const user = verifyToken(refreshToken);

    // If verification is successful, generate a new access token
    const accessToken = generateAccessToken(user);

    // Send the new access token to the client
    res.json({ accessToken });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.sendStatus(403);
  }
});




//// Forgot-password endpoint
app.post('/forgot-password', async (req, res) => {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const { email } = req.body;
  try {
      const user = await User.findOne({ email });
      if (!user) {
          // To prevent email enumeration attacks, consider always returning a successful message
          // even if the email is not found in the database.
          return res.status(200).send('If that email address is in our database, we will send you an email to reset your password.');
      }

      // Create a one-time use token for resetting the password
      const resetToken = jwt.sign({ id: user._id }, process.env.SECRET_KEY, { expiresIn: '1h' });
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

      // Send email
      const msg = {
          to: email, // Recipient email address
          from: 'info@blanklocations.com', // Must match a verified sender in SendGrid
          subject: 'Password Reset Request',
          html: `<p>You requested a password reset. Please follow this link to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
      };

      await sgMail.send(msg);
      res.status(200).send('If that email address is in our database, we will send you an email to reset your password.');
  } catch (error) {
      console.error('Forgot-password error:', error);
      res.status(500).send('Error processing forgot-password request.');
  }
});

app.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).send('Token and new password are required.');
  }

  try {
    // Verifying the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).send('User not found.');
    }

    // Hashing the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    // Consider logging out the user from all devices here if applicable
    // This may involve clearing any refresh tokens or session identifiers

    res.send('Password has been reset successfully.');
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).send('Token has expired.');
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).send('Invalid token.');
    }
    console.error('Reset password error:', error);
    res.status(500).send('An error occurred while resetting the password.');
  }
});

//// Email verification endpoint
app.post('/verify-email', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  try {
    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Generate a 6-digit verification code
    const verificationCode = generateVerificationCode();

    // TODO: Send the verification code to the user's email
    // You can use your email sending logic or a third-party service

    // For testing purposes, you can log the verification code
    console.log(`Verification Code for ${email}: ${verificationCode}`);

    res.status(200).json({ message: "Verification code sent successfully." });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ message: "An error occurred during email verification." });
  }
});


// Endpoint to verify the code
app.post('/verify-code', async (req, res) => {
  const { email, verificationCode } = req.body;

  try {
    const user = await User.findOne({ email, emailVerified: false, verificationCode });

    if (!user) {
      return res.status(404).json({ message: "User not found or already verified." });
    }

    // If the code is valid, update user's emailVerified status to true
    user.emailVerified = true;
    await user.save();

    res.json({ message: "Email verified successfully." });
  } catch (error) {
    console.error('Verification code error:', error);
    res.status(500).json({ message: "An error occurred during verification." });
  }
});





// MEMBERSHIP


// ACTIVITY Feed
// POST a new activity update
app.post('/activities', async (req, res) => {
  try {
    const { user, type, eventType, eventId } = req.body;
    const newActivity = new Activity({
      user,
      type,
      eventType,
      eventId,
      timestamp: new Date() // Optional, as it defaults to Date.now
    });

    const savedActivity = await newActivity.save();
    res.status(201).json(savedActivity);
  } catch (error) {
    console.error('Error creating new activity:', error);
    res.status(500).json({ message: 'Failed to create new activity' });
  }
});

// GET all activities
app.get('/activities', async (req, res) => {
  try {
    const activities = await Activity.find().populate('user').populate('eventId');
    res.json(activities);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ message: 'Failed to fetch activities' });
  }
});


// Create profile - Secured
app.post('/create-profile', authenticateToken, async (req, res) => {
  const userId = req.userId;
  const profileData = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(userId, { $set: profileData, profileComplete: true }, { new: true });
    if (!updatedUser) return res.status(404).send("User Not Found");

    res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: "Error updating profile", error: error.toString() });
  }
});

//  EVENTS //
// Fetch all events from the events collection
app.get('/events', authenticateToken, async (req, res) => {
  try {
    // Fetch all events from the database
    const events = await Event.find({});
    
    // Optionally, you can enhance the response by checking if the current user
    // has RSVPed to each event and adding a 'hasRSVPed' flag to each event object.
    const userId = req.userId; // Assuming this is added by authenticateToken middleware
    const eventsWithRSVPStatus = events.map(event => ({
      ...event.toObject(),
      hasRSVPed: event.attendees.includes(userId)
    }));

    res.json(eventsWithRSVPStatus);
  } catch (error) {
    console.error('Failed to fetch events:', error);
    res.status(500).json({ message: "Failed to fetch events", error: error.toString() });
  }
});

// Fetch single event by its ID w/ attendees
app.get('/events/:eventId', authenticateToken, async (req, res) => {
  const { eventId } = req.params;
  try {
    // Fetch the event and populate the attendees' full name and profile
    const event = await Event.findById(eventId)
      .populate('attendees', 'firstName lastName profile'); // Add any other fields needed for the modal

    if (!event) return res.status(404).send("Event Not Found");

    // You don't need to modify the attendees' data here since we'll handle the initials on the client side
    res.json(event); // This will include the full attendees with their full name and profile
  } catch (error) {
    res.status(500).json({ message: "Error fetching event", error: error.toString() });
  }
});


// RSVP to an event - Secured
app.post('/events/:eventId/rsvp', authenticateToken, async (req, res) => {
  const eventId = req.params.eventId;
  const userId = req.userId;

  console.log(`Attempting to RSVP. Event ID: ${eventId}, User ID: ${userId}`);

  // Ensure eventId is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    return res.status(400).send(`Invalid Event ID format: ${eventId}`);
  }

  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    const event = await Event.findById(eventId).session(session);
    if (!event) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).send("Event Not Found");
    }
    
    if (event.attendees.includes(userId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).send("Already RSVPed");
    }

    event.attendees.push(userId);
    await event.save({ session });

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).send("User Not Found");
    }

    if (!user.attending.includes(eventId)) {
      user.attending.push(eventId);
      await user.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ message: "RSVP successful" });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    console.error(`RSVP error for Event ID: ${eventId}, User ID: ${userId}:`, error);
    res.status(500).send("Failed to RSVP");
  }
});



//  MEMBERS //
// Fetch all members excluding currentUser
app.get('/members', authenticateToken, async (req, res) => {
  try {
    // Exclude the current user's data from the members list
    const members = await User.find({ _id: { $ne: req.userId } }).select('-password -refreshToken');
    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ message: "Error fetching members" });
  }
});

// Fetch user data by userId - Secured
app.get('/user/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User Not Found");
    }
    const isFollowing = user.followers.includes(req.userId);
    res.json({ ...user.toObject(), isFollowing });
  } catch (error) {
    res.status(500).json({ message: "Error fetching user data", error: error.toString() });
  }
});

// Follow a User
app.post('/user/:userId/follow', authenticateToken, async (req, res) => {
  const userIdToFollow = req.params.userId; // ID of the user to be followed
  const currentUserId = req.userId; // Extracted from token in authenticateToken middleware

  if (currentUserId === userIdToFollow) {
      return res.status(400).json({ message: "You cannot follow yourself." });
  }

  try {
      // Use MongoDB's $addToSet to prevent duplicates in following and followers arrays
      const userBeingFollowed = await User.findByIdAndUpdate(userIdToFollow, {
          $addToSet: { followers: currentUserId }
      }, { new: true });

      const currentUser = await User.findByIdAndUpdate(currentUserId, {
          $addToSet: { following: userIdToFollow }
      }, { new: true });

      if (!userBeingFollowed || !currentUser) {
          return res.status(404).json({ message: "User not found." });
      }

      res.status(200).json({ message: "Followed successfully." });
  } catch (error) {
      console.error('Error following user:', error);
      res.status(500).json({ message: "Error processing follow request" });
  }
});

// Unfollow a User
app.post('/user/:userId/unfollow', authenticateToken, async (req, res) => {
  const userIdToUnfollow = req.params.userId; // ID of the user to be unfollowed
  const currentUserId = req.userId; // Extracted from token in authenticateToken middleware

  if (currentUserId === userIdToUnfollow) {
    return res.status(400).json({ message: "You cannot unfollow yourself." });
  }

  try {
    // Use MongoDB's $pull to remove currentUserId from the followers array of the user being unfollowed
    const userBeingUnfollowed = await User.findByIdAndUpdate(userIdToUnfollow, {
      $pull: { followers: currentUserId }
    }, { new: true });

    // Similarly, remove userIdToUnfollow from the following array of the current user
    const currentUser = await User.findByIdAndUpdate(currentUserId, {
      $pull: { following: userIdToUnfollow }
    }, { new: true });

    if (!userBeingUnfollowed || !currentUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ message: "Unfollowed successfully." });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ message: "Error processing unfollow request" });
  }
});






//PROFILE Endpoints
// Fetch currentUser Profile
app.get('/profile', authenticateToken, async (req, res) => {
  // authenticateToken middleware should verify the token and attach userId to the req object
  const userId = req.userId;

  try {
    const user = await User.findById(userId).select('-password -refreshToken'); // Exclude sensitive fields
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user); // Send the user data back to the client
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: "Error fetching profile data" });
  }
});

//Fetch currentUser attendingEvents
app.get('/user/events/attending', authenticateToken, async (req, res) => {
  const userId = req.userId; // Assuming authenticateToken middleware adds this

  try {
    // Find the user and populate the attending events along with createdBy details
    const userWithEvents = await User.findById(userId)
      .populate({
        path: 'attending',
        select: 'eventName shortDescription locationName venueLocation startTime endTime eventCategory createdBy attendees',
        populate: { // Corrected usage of populate to include createdBy details
          path: 'createdBy',
          select: 'firstName lastName'
        }
      });

    if (!userWithEvents) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(userWithEvents.attending); // Send the attending events back to the client
  } catch (error) {
    console.error('Error fetching attending events:', error);
    res.status(500).json({ message: "Error fetching attending events" });
  }
});



//Following and Follower Endpoints
// Fetch the list of users the currentUser is following
app.get('/profile/following', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('following', 'firstName lastName location');
    if (!user) return res.status(404).send("User not found");

    // Assuming location is populated correctly, map over the following to include location details
    const followingWithLocation = user.following.map(followingUser => ({
      ...followingUser.toObject(),
      location: followingUser.location // Assuming location is populated and structured correctly
    }));

    res.json(followingWithLocation);
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).send("Internal server error");
  }
});

// Fetch the list of users following the currentUser
app.get('/profile/followers', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('followers', 'firstName lastName location');
    if (!user) return res.status(404).send("User not found");

    // Assuming location is populated correctly, map over the followers to include location details
    const followersWithLocation = user.followers.map(followerUser => ({
      ...followerUser.toObject(),
      location: followerUser.location // Assuming location is populated and structured correctly
    }));

    res.json(followersWithLocation);
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).send("Internal server error");
  }
});

// Update general profile settings - Secured
app.put('/profile/settings/general', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { email, phone } = req.body;
    if (!email || !phone) { // Simple validation
      return res.status(400).json({ message: "Email and phone are required." });
    }
    const updatedUser = await User.findByIdAndUpdate(userId, {
      $set: { email: email, phone: phone }
    }, { new: true });
    if (!updatedUser) {
      throw new Error("User not found or update failed.");
    }
    res.status(200).json({ message: "General settings updated successfully", user: updatedUser });
  } catch (error) {
    console.error('Error updating general settings:', error);
    res.status(500).json({ message: `Error updating general settings: ${error.message}` });
  }
});


// Update privacy settings - Secured
app.put('/profile/settings/privacy', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { publicProfile, hideFromGuestLists, showEventsAttending, optInForSMSUpdates } = req.body;
    // No validation added here as boolean fields can be true or false
    const updatedUser = await User.findByIdAndUpdate(userId, {
      $set: {
        publicProfile: publicProfile,
        hideFromGuestLists: hideFromGuestLists,
        showEventsAttending: showEventsAttending,
        optInForSMSUpdates: optInForSMSUpdates
      }
    }, { new: true });
    if (!updatedUser) {
      throw new Error("User not found or update failed.");
    }
    res.status(200).json({ message: "Privacy settings updated successfully", user: updatedUser });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    res.status(500).json({ message: `Error updating privacy settings: ${error.message}` });
  }
});


// Update account security - Secured
app.put('/profile/settings/security', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required." });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new Error("User not found.");
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: `Error updating password: ${error.message}` });
  }
});








const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));