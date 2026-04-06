// netlify/functions/subscribe.js
// Adds a contact to the Resend audience when someone subscribes

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { email, firstName } = JSON.parse(event.body);

    if (!email || !email.includes("@") || !email.includes(".")) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: "Please enter a valid email address." })
      };
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID;

    if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
      console.error("Missing Resend environment variables");
      return {
        statusCode: 500, headers,
        body: JSON.stringify({ error: "Service configuration error." })
      };
    }

    const response = await fetch(
      "https://api.resend.com/audiences/" + RESEND_AUDIENCE_ID + "/contacts",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + RESEND_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          first_name: firstName ? firstName.trim() : "",
          unsubscribed: false
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Resend error:", JSON.stringify(result));

      // If contact already exists, treat as success
      if (result.message && result.message.includes("already exists")) {
        return {
          statusCode: 200, headers,
          body: JSON.stringify({ success: true, message: "You're already subscribed. See you tomorrow at 06:30 CET." })
        };
      }

      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: "Subscription failed. Please try again." })
      };
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, message: "Welcome to ZRC Morning Intelligence." })
    };

  } catch (err) {
    console.error("Subscribe error:", err);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "Something went wrong. Please try again." })
    };
  }
};
