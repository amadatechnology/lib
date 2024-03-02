// stripe.js
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

if (!stripeSecretKey) {
  throw new Error('Stripe secret key not provided in .env file');
}

const stripe = require('stripe')(stripeSecretKey);

const createCustomer = async (email, paymentMethod) => {
  try {
    const customer = await stripe.customers.create({
      email: email,
      payment_method: paymentMethod,
      invoice_settings: {
        default_payment_method: paymentMethod,
      },
    });
    return customer;
  } catch (error) {
    throw error;
  }
};

const createSubscription = async (customerId, priceId) => {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
    });
    return subscription;
  } catch (error) {
    throw error;
  }
};

const upgradeSubscription = async (subscriptionId, newPriceId) => {
  try {
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{ price: newPriceId }],
    });
    return updatedSubscription;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  createCustomer,
  createSubscription,
  upgradeSubscription,
};
