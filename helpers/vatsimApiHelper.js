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
      .then((response) => response?.data)
      .catch(function (error) {
        let errorToThrow = {};

        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          errorToThrow = {
            data: error.response.data,
            status: error.response.status,
            headers: error.response.headers,
          };
        } else if (error.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          errorToThrow = error.request;
        } else {
          // Something happened in setting up the request that triggered an Error
          errorToThrow = error.message;
        }

        throw errorToThrow;
      });
  },
};
