// Helper class to communicate with VATSIM API

import axios from "axios";

export default {
  // Method utilizing access token from OAuth middle ware to retrieve user data needed to process a login from VATSIM API.
  async getUserInformation(accessToken) {
    const getUserEndpoint = process.env.VATSIM_AUTH_ENDPOINT + "/api/user";

    return await axios
      .get(getUserEndpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((response) => {
        return response?.data?.data;
      })
      .catch((e) => {
        req.app.Sentry.captureException(e);
        res.status(500);
      });
  },
};
