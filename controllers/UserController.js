import e from "express";
const router = e.Router();

import User from "../models/User.js";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import axios from "axios";
import { randomUUID } from "crypto";
import getUser from "../middleware/getUser.js";
import Notification from "../models/Notification.js";
import ControllerHours from "../models/ControllerHours.js";
import Discord from "discord-oauth2";
import oAuth from "../middleware/vatsimOAuth.js";
import vatsimApiHelper from "../helpers/vatsimApiHelper.js";

dotenv.config();

router.get("/", async (req, res) => {
  try {
    if (!req.cookies.token) {
      throw {
        code: 401,
        message: "Token cookie not found",
      };
    }

    await new Promise((resolve, reject) => {
      jwt
        .verify(
          req.cookies.token,
          process.env.JWT_SECRET,
          async (err, decoded) => {
            if (err) {
              res.cookie("token", "", { expires: new Date(0) });
              reject({
                code: 403,
                message: `Unable to verify token: ${err}`,
              });
            } else {
              const user = await User.findOne({
                cid: decoded.cid,
              })
                .select("-createdAt -updatedAt")
                .populate("roles")
                .catch(console.log);
              if (!user) {
                res.cookie("token", "", { expires: new Date(0) });
                reject({
                  code: 401,
                  message: "User not found",
                });
              }
              res.stdRes.data = user;
            }
            resolve();
          }
        )
        .catch((err) => {
          throw err;
        });
    });
  } catch (e) {
    req.app.Sentry.captureException(e);
    res.stdRes.ret_det = e;
  }

  return res.json(res.stdRes);
});

router.post("/idsToken", getUser, async (req, res) => {
  try {
    if (!req.cookies.token) {
      throw {
        code: 401,
        message: "Not logged in",
      };
    }

    res.user.idsToken = randomUUID();

    await res.user.save();

    await req.app.dossier.create({
      by: res.user.cid,
      affected: -1,
      action: `%b generated a new IDS Token.`,
    });

    res.stdRes.data = res.user.idsToken;
  } catch (e) {
    req.app.Sentry.captureException(e);
    res.stdRes.ret_det = e;
  }

  return res.json(res.stdRes);
});

// Endpoint to preform user login, uses oAuth middleware to retrieve an access token
router.post("/login", oAuth, async (req, res) => {
  try {
    const { access_token } = req.oauth;

    // Use access token to attempt to get user data.
    let vatsimUserData = await vatsimApiHelper.getUserInformation(access_token);

    // VATSIM API returns 200 codes on some errors, use CID as a check to see if there was an error.
    if (vatsimUserData?.data?.cid == null) {
      let error = vatsimUserData;
      throw error;
    } else {
      vatsimUserData = vatsimUserData.data;
    }

    const userData = {
      email: vatsimUserData.personal.email,
      firstName: vatsimUserData.personal.name_first,
      lastName: vatsimUserData.personal.name_last,
      cid: vatsimUserData.cid,
      ratingId: vatsimUserData.vatsim.rating.id,
    };

    // If the user did not authorize all requested data from the AUTH login, we may have null parameters
    // If that is the case throw a BadRequest exception.
    if (Object.values(userData).some((x) => x == null || x == "")) {
      throw {
        code: 400,
        message:
          "User must authorize all requested VATSIM data. [Authorize Data]",
      };
    }

    let user = await User.findOne({ cid: userData.cid });

    if (!user) {
      user = await User.create({
        cid: userData.cid,
        fname: userData.firstName,
        lname: userData.lastName,
        email: userData.email,
        rating: userData.ratingId,
        oi: null,
        broadcast: false,
        member: false,
        vis: false,
      });
    } else {
      if (!user.email) {
        user.email = userData.email;
      }
      if (!user.prefName ?? true) {
        user.fname = userData.firstName;
        user.lname = userData.lastName;
      }
      user.rating = userData.ratingId;
    }

    if (user.oi && !user.avatar) {
      const { data } = await axios.get(
        `https://ui-avatars.com/api/?name=${user.oi}&size=256&background=122049&color=ffffff`,
        { responseType: "arraybuffer" }
      );

      await req.app.s3
        .putObject({
          Bucket: "zabartcc/avatars",
          Key: `${user.cid}-default.png`,
          Body: data,
          ContentType: "image/png",
          ACL: "public-read",
          ContentDisposition: "inline",
        })
        .promise();

      user.avatar = `${user.cid}-default.png`;
    }

    await user.save();

    const apiToken = jwt.sign({ cid: userData.cid }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.cookie("token", apiToken, {
      httpOnly: true,
      maxAge: 432000000,
      sameSite: true,
    }); // Expires in 5 days
  } catch (e) {
    req.app.Sentry.captureException(e);
    res.stdRes.ret_det = e;
    res.status(500);
  }

  return res.json(res.stdRes);
});

router.get("/logout", async (req, res) => {
  try {
    if (!req.cookies.token) {
      throw {
        code: 400,
        message: "User not logged in",
      };
    }
    res.cookie("token", "", { expires: new Date(0) });
  } catch (e) {
    req.app.Sentry.captureException(e);
    res.stdRes.ret_det = e;
  }

  return res.json(res.stdRes);
});

router.get("/sessions", getUser, async (req, res) => {
  try {
    const sessions = await ControllerHours.find({ cid: res.user.cid })
      .sort({ timeStart: -1 })
      .limit(20)
      .lean();
    res.stdRes.data = sessions;
  } catch (e) {
    req.app.Sentry.captureException(e);
    res.stdRes.ret_det = e;
  }

  return res.json(res.stdRes);
});

router.get("/discord", getUser, async (req, res) => {
  try {
    res.stdRes.data = !!res.user.discordInfo.clientId;
  } catch (e) {
    req.app.Sentry.captureException(e);
    res.stdRes.ret_det = e;
  }

  return res.json(res.stdRes);
});

router.post("/discord", async (req, res) => {
  try {
    if (!req.body.code || !req.body.cid) {
      throw {
        code: 400,
        message: "Incomplete request",
      };
    }

    const { cid, code } = req.body;
    const user = await User.findOne({ cid });

    if (!user) {
      throw {
        code: 401,
        message: "User not found",
      };
    }

    const oauth = new Discord();
    const token = await oauth
      .tokenRequest({
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        redirectUri: process.env.DISCORD_REDIRECT_URI,
        grantType: "authorization_code",
        code,
        scope: "identify",
      })
      .catch((err) => {
        console.log(err);
        return false;
      });

    if (!token) {
      throw {
        code: 403,
        message: "Unable to authenticate with Discord",
      };
    }

    const { data: discordUser } = await axios
      .get("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `${token.token_type} ${token.access_token}`,
          "User-Agent": "Albuquerque ARTCC API",
        },
      })
      .catch((err) => {
        console.log(err);
        return false;
      });

    if (!discordUser) {
      throw {
        code: 403,
        message: "Unable to retrieve Discord info",
      };
    }

    user.discordInfo.clientId = discordUser.id;
    user.discordInfo.accessToken = token.access_token;
    user.discordInfo.refreshToken = token.refresh_token;
    user.discordInfo.tokenType = token.token_type;

    let currentTime = new Date();
    currentTime = new Date(currentTime.getTime() + token.expires_in * 1000);
    user.discordInfo.expires = currentTime;

    await user.save();

    await req.app.dossier.create({
      by: user.cid,
      affected: -1,
      action: `%b connected their Discord.`,
    });
  } catch (e) {
    req.app.Sentry.captureException(e);
    res.stdRes.ret_det = e;
  }

  return res.json(res.stdRes);
});

router.delete("/discord", getUser, async (req, res) => {
  try {
    res.user.discordInfo = undefined;
    await res.user.save();
  } catch (e) {
    req.app.Sentry.captureException(e);
    res.stdRes.ret_det = e;
  }

  return res.json(res.stdRes);
});

router.get("/notifications", getUser, async (req, res) => {
  try {
    const page = +req.query.page || 1;
    const limit = +req.query.limit || 10;

    const unread = await Notification.countDocuments({
      deleted: false,
      recipient: res.user.cid,
      read: false,
    });
    const amount = await Notification.countDocuments({
      deleted: false,
      recipient: res.user.cid,
    });
    const notif = await Notification.find({
      recipient: res.user.cid,
      deleted: false,
    })
      .skip(limit * (page - 1))
      .limit(limit)
      .sort({ createdAt: "desc" })
      .lean();

    res.stdRes.data = {
      unread,
      amount,
      notif,
    };
  } catch (e) {
    req.app.Sentry.captureException(e);
    res.stdRes.ret_det = e;
  }

  return res.json(res.stdRes);
});

router.put("/notifications/read/all", getUser, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: res.user.cid },
      {
        read: true,
      }
    );
  } catch (e) {
    req.app.Sentry.captureException(e);
    res.stdRes.ret_det = e;
  }

  return res.json(res.stdRes);
});

router.put("/notifications/read/:id", async (req, res) => {
  try {
    if (!req.params.id) {
      throw {
        code: 400,
        message: "Incomplete request",
      };
    }
    await Notification.findByIdAndUpdate(req.params.id, {
      read: true,
    });
  } catch (e) {
    req.app.Sentry.captureException(e);
    res.stdRes.ret_det = e;
  }

  return res.json(res.stdRes);
});

router.delete("/notifications", getUser, async (req, res) => {
  try {
    await Notification.delete({ recipient: res.user.cid });
  } catch (e) {
    req.app.Sentry.captureException(e);
    res.stdRes.ret_det = e;
  }

  return res.json(res.stdRes);
});

router.put("/profile", getUser, async (req, res) => {
  try {
    const { bio } = req.body;

    await User.findOneAndUpdate(
      { cid: res.user.cid },
      {
        bio,
      }
    );

    await req.app.dossier.create({
      by: res.user.cid,
      affected: -1,
      action: `%b updated their profile.`,
    });
  } catch (e) {
    req.app.Sentry.captureException(e);
    res.stdRes.ret_det = e;
  }

  return res.json(res.stdRes);
});

export default router;
