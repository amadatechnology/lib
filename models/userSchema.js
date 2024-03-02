const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    default: ''
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  firstName: String,
  lastName: String,
  birthday: Date,
  location: {
    city: String,
    state: String,
    country: String
  },
  phone: {
    type: String
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  profile: {
    type: String // This could be a URL to the user's profile picture or a text-based bio
  },
  signUpIPAddress: String,
  stripeCustomerId: String,
  profileComplete: {
    type: Boolean,
    default: false
  },
  attending: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Additional fields can be added as needed
}, { timestamps: true }); // Enable createdAt and updatedAt timestamps

// Optionally, you can add methods or statics to the schema here

const User = mongoose.model('User', userSchema);

module.exports = User;
