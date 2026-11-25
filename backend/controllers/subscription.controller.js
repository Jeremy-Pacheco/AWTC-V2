const webPush = require('web-push');
const db = require('../models');
const { isAllowedPushEndpoint, sameKeys, endpointHost } = require('../services/push.service');
const Subscription = db.Subscription;

// Configure web-push with VAPID keys from environment variables
webPush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'your-email@example.com'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Subscribe a user to push notifications
 * @param {Object} req - Express request object with subscription data
 * @param {Object} res - Express response object
 */
const subscribe = async (req, res) => {
  try {
    // Body validated by validation/schemas.js -> subscribe (allowed push
    // services only, SEC-20); requireAuth guarantees req.user.
    const { endpoint, expirationTime, keys } = req.body;
    const userId = req.user.id;

    const existing = await Subscription.findOne({ where: { endpoint } });

    if (existing) {
      if (existing.userId !== userId) {
        // SEC-21: never hand an endpoint to another account just because its
        // URL is known. Only the browser that owns it (same keys) can move it,
        // e.g. a different person logging in on a shared computer.
        if (!sameKeys(existing.keys, keys)) {
          console.warn(`[push] Rejected takeover of a subscription (${endpointHost(endpoint)}) by user ${userId}`);
          return res.status(409).json({ message: 'This push subscription belongs to another account' });
        }
        existing.userId = userId;
      }
      existing.keys = JSON.stringify(keys);
      existing.expirationTime = expirationTime || null;
      await existing.save();
      return res.status(200).json({ message: 'Subscription updated', subscription: { id: existing.id } });
    }

    const subscription = await Subscription.create({
      userId,
      endpoint,
      expirationTime: expirationTime || null,
      keys: JSON.stringify(keys)
    });

    res.status(201).json({
      message: 'Successfully subscribed to notifications',
      subscription: { id: subscription.id }
    });
  } catch (error) {
    console.error('Error creating subscription:', error.message);
    res.status(500).json({
      message: 'Error creating subscription'
    });
  }
};

/**
 * Unsubscribe a user from push notifications
 * @param {Object} req - Express request object with endpoint in body
 * @param {Object} res - Express response object
 */
const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    const userId = req.user.id;

    if (!endpoint) {
      return res.status(400).json({
        message: 'Endpoint is required'
      });
    }

    const deleted = await Subscription.destroy({
      where: {
        endpoint,
        userId
      }
    });

    if (deleted) {
      res.status(200).json({
        message: 'Successfully unsubscribed'
      });
    } else {
      res.status(404).json({
        message: 'Subscription not found'
      });
    }
  } catch (error) {
    console.error('Error deleting subscription:', error);
    res.status(500).json({
      message: 'Error deleting subscription'
    });
  }
};

/**
 * Get user's current subscriptions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserSubscriptions = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscriptions = await Subscription.findAll({
      where: { userId },
      attributes: ['id', 'endpoint', 'expirationTime', 'createdAt']
    });

    res.status(200).json({
      subscriptions
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      message: 'Error fetching subscriptions'
    });
  }
};

/**
 * Send push notification to a specific user
 * @param {number} userId - Target user ID
 * @param {Object} payload - Notification payload with title, body, icon, etc.
 * @returns {Promise<Object>} Result with success count and errors
 */
const sendNotificationToUser = async (userId, payload) => {
  try {
    console.log(`📬 Sending notification to user ${userId}: ${payload && payload.title ? payload.title : ''}`);
    
    // Find all subscriptions for the user
    const subscriptions = await Subscription.findAll({
      where: { userId }
    });

    console.log(`   Found ${subscriptions.length} subscription(s) for user ${userId}`);

    if (subscriptions.length === 0) {
      return {
        success: false,
        message: 'No subscriptions found for user'
      };
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: []
    };

    // Send notification to all user's subscriptions
    for (const subscription of subscriptions) {
      // Defence in depth (SEC-20): rows saved before the allowlist existed
      if (!isAllowedPushEndpoint(subscription.endpoint)) {
        console.warn(`   🗑️  Deleting subscription with a non-push endpoint (${endpointHost(subscription.endpoint)})`);
        results.failed++;
        results.errors.push('Endpoint is not a supported push service');
        await subscription.destroy();
        continue;
      }
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: JSON.parse(subscription.keys)
        };

        await webPush.sendNotification(
          pushSubscription,
          JSON.stringify(payload)
        );

        console.log(`   ✅ Notification sent (${endpointHost(subscription.endpoint)})`);
        results.sent++;
      } catch (error) {
        console.error(`   ❌ Error sending notification to endpoint:`, error.message);
        results.failed++;
        results.errors.push(error.message);

        // If subscription is invalid (410 Gone), delete it
        if (error.statusCode === 404 || error.statusCode === 410) {
          console.log(`   🗑️  Deleting expired subscription (${error.statusCode})`);
          await subscription.destroy();
        }
      }
    }

    console.log(`   📊 Results: ${results.sent} sent, ${results.failed} failed`);

    return {
      success: results.sent > 0,
      ...results
    };
  } catch (error) {
    console.error('❌ Error in sendNotificationToUser:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

/**
 * Test endpoint to send a notification to the current user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
module.exports = {
  subscribe,
  unsubscribe,
  getUserSubscriptions,
  sendNotificationToUser
};
