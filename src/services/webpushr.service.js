const axios = require('axios');

const WEBPUSHR_BASE = process.env.WEBPUSHR_BASE || 'https://api.webpushr.com/v1';
const HEADERS = {
    'webpushrKey': process.env.WEBPUSHR_KEY,
    'webpushrAuthToken': process.env.WEBPUSHR_AUTH_TOKEN,
    'Content-Type': 'application/json',
};

// Send to all subscribers
async function sendToAll({ title, message, target_url }) {
    try {
        const res = await axios.post(
            `${WEBPUSHR_BASE}/notification/send/all`,
            { title, message, target_url },
            { headers: HEADERS }
        );
        return res.data;
    } catch (err) {
        console.error('Webpushr sendToAll error:', err.response?.data || err.message);
    }
}

// Send to one subscriber by Webpushr SID
async function sendToSubscriber({ sid, title, message, target_url }) {
    try {
        const res = await axios.post(
            `${WEBPUSHR_BASE}/notification/send/sid`,
            { title, message, target_url, sid },
            { headers: HEADERS }
        );
        console.log(res.data, "-------------------webpushr sendToSubscriber response-------------------");
        return res.data;
    } catch (err) {
        console.error('Webpushr sendToSubscriber error:', err.response?.data || err.message);
    }
}

// Optional: get status or subscriber count
async function getSubscriberCount() {
    try {
        const res = await axios.get(`${WEBPUSHR_BASE}/site/subscriber_count`, { headers: HEADERS });
        return res.data;
    } catch (err) {
        console.error('Webpushr getSubscriberCount error:', err.response?.data || err.message);
    }
}

module.exports = { sendToAll, sendToSubscriber, getSubscriberCount };
