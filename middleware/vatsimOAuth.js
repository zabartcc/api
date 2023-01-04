// Middleware class to handle VATSIM OAuth flow for user login.

import axios from "axios";

export default function (req, res, next) {
  const code = req.body.code;
  let redirectUrl = "/login/verify";

  const vatsimOauthTokenEndpoint =
    process.env.VATSIM_AUTH_ENDPOINT + "/oauth/token";

  if (process.env.NODE_ENV === "beta") {
    redirectUrl = "https://beta.zabartcc.org" + redirectUrl;
  } else if (process.env.NODE_ENV === "prod") {
    redirectUrl = "https://zabartcc.org" + redirectUrl;
  } else {
    redirectUrl = "http://localhost:8080" + redirectUrl;
  }

  if (!code) {
    res.status(400).send("No authorization code provided.");
  }

  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("client_id", process.env.VATSIM_AUTH_CLIENT_ID);
  params.append("client_secret", process.env.VATSIM_AUTH_CLIENT_SECRET);
  params.append("code", code);
  params.append("redirect_uri", redirectUrl);

  axios
    .post(vatsimOauthTokenEndpoint, params)
    .then((response) => {
      req.oauth = response.data;
      next();
    })
    .catch((e) => {
      console.error(e);
      res.status(500).send();
    });
}
