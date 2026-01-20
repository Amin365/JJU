
// mpesaAuthHelper.js
import axios from "axios";

export const getAccessToken = async () => {
  try {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

    const response = await axios.get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      }
    );

    return response.data.access_token; // ✅ returns only the token string
  } catch (error) {
    console.error("ERROR GETTING MPESA TOKEN:", error.message);
    throw new Error("Failed to generate access token");
  }
};
