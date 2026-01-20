import { getAccessToken } from "./mpesaAuthHelper.js";

export const generateAccessToken = async (req, res) => {
  try {
    const token = await getAccessToken();
    res.status(200).json({ access_token: token });
  } catch (error) {
    res.status(500).json({
      message: "Failed to generate access token",
      error: error.message,
    });
  }
};
