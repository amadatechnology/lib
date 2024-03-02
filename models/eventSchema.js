const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  eventName: { type: String, required: true },
  shortDescription: { type: String, required: true },
  locationName: { type: String, required: true },
  venueLocation: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  eventCategory: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Adding the location object to include city, state, and country
  location: {
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true }
  }
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;
