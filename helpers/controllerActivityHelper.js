import cron from 'node-cron';
import transporter from '../config/mailer.js';
import User from '../models/User.js';
import ControllerHours from '../models/ControllerHours.js';
import TrainingRequest from '../models/TrainingRequest.js';
import { DateTime as luxon } from 'luxon'
import Redis from 'redis';
import RedisLock from 'redis-lock';
import env from 'dotenv';

env.config();

let redis = Redis.createClient({ url: process.env.REDIS_URI });
let redisLock = RedisLock(redis);
await redis.connect();

const observerRatingCode = 1;
const activityWindowInDays = 60;
const gracePeriodInDays = 15;
const requiredHoursPerPeriod = 2;
const redisActivityCheckKey = "ACTIVITYCHECKRUNNING";

/**
 * Registers a CRON job that sends controllers reminder emails.
 */
function registerControllerActivityChecking() {
    try {
        if (process.env.NODE_ENV === 'production') {
            cron.schedule('0 0 * * *', async () => {
                // Lock the activity check to avoid multiple app instances trying to simulatenously run the check.
                const lockRunningActivityCheck = await redisLock(redisActivityCheckKey);

                await checkControllerActivity();
                await checkControllersNeedingRemoval();

                lockRunningActivityCheck(); // Releases the lock.
            });

            console.log("Successfully registered activity CRON checks")
        }
    }
    catch (e) {
        console.log("Error registering activity CRON checks")
        console.error(e)
    }
}

/**
 * Checks controllers for activity and sends a reminder email.
 */
async function checkControllerActivity() {
    const today = luxon.utc();
    const minActivityDate = today.minus({ days: activityWindowInDays - 1 });
    const controllerHoursSummary = {};
    const controllerTrainingSummary = {};

    try {
        const usersNeedingActivityCheck = await User.find(
            {
                member: true,
                $or: [{ nextActivityCheckDate: { $lte: today } }, { nextActivityCheckDate: null }]
            });

        const userCidsNeedingActivityCheck = usersNeedingActivityCheck.map(u => u.cid);

        (await ControllerHours.aggregate([
            {
                $match: {
                    timeStart: { $gt: minActivityDate },
                    cid: { $in: userCidsNeedingActivityCheck }
                }
            },
            {
                $project: {
                    length: {
                        "$divide": [
                            { $subtract: ['$timeEnd', '$timeStart'] },
                            60 * 1000 * 60 // Convert to hours.
                        ]
                    },
                    cid: 1
                }
            },
            {
                $group: {
                    _id: "$cid",
                    total: { "$sum": "$length" }
                }
            }
        ])).forEach(i => controllerHoursSummary[i._id] = i.total);

        (await TrainingRequest.aggregate([
            { $match: { startTime: { $gt: minActivityDate }, studentCid: { $in: userCidsNeedingActivityCheck } } },
            {
                $group: {
                    _id: "$studentCid",
                    total: { $sum: 1 }
                }
            }
        ])).forEach(i => controllerTrainingSummary[i._id] = i.total);


        usersNeedingActivityCheck.forEach(async user => {
            const controllerHasLessThanTwoHours = (controllerHoursSummary[user.cid] ?? 0) < requiredHoursPerPeriod;
            const controllerJoinedMoreThan60DaysAgo = (user.joinDate ?? user.createdAt) < minActivityDate;
            const controllerIsNotObserverWithTrainingSession = user.rating != observerRatingCode || !controllerTrainingSummary[user.cid];
            const controllerInactive = controllerHasLessThanTwoHours && controllerJoinedMoreThan60DaysAgo && controllerIsNotObserverWithTrainingSession;

            // Set check dates before emailing to prevent duplicate checks if an exception occurs.
            await User.updateOne(
                { "cid": user.cid },
                {
                    nextActivityCheckDate: today.plus({ days: activityWindowInDays })
                }
            )

            if (controllerInactive) {
                await User.updateOne(
                    { "cid": user.cid },
                    {
                        removalWarningDeliveryDate: today.plus({ days: gracePeriodInDays })
                    }
                )

                transporter.sendMail({
                    //to: user.Email,
                    from: {
                        name: "Albuquerque ARTCC",
                        address: 'noreply@zabartcc.org'
                    },
                    subject: `Controller Activity Warning | Albuquerque ARTCC`,
                    template: 'activityReminder',
                    context: {
                        name: user.fname,
                        requiredHours: requiredHoursPerPeriod,
                        activityWindow: activityWindowInDays,
                        daysRemaining: gracePeriodInDays,
                        currentHours: (controllerHoursSummary[user.cid]?.toFixed(2) ?? 0)
                    }
                });
            }
        });
    }
    catch (e) {
        console.error(e)
    }
}

/**
 * Checks for controllers that did not maintain activity and sends a removal email.
 */
async function checkControllersNeedingRemoval() {
    const today = luxon.utc();

    try {
        const usersNeedingRemovalWarning = await User.find(
            {
                member: true,
                removalWarningDeliveryDate: { $lte: today }
            });

        usersNeedingRemovalWarning.forEach(async user => {
            await User.updateOne(
                { "cid": user.cid },
                {
                    removalWarningDeliveryDate: null
                }
            )

            transporter.sendMail({
                //to: user.Email,
                //cc: 'datm@zabartcc.org',
                from: {
                    name: "Albuquerque ARTCC",
                    address: 'noreply@zabartcc.org'
                },
                subject: `Controller Inactivity Notice | Albuquerque ARTCC`,
                template: 'activityWarning',
                context: {
                    name: user.fname,
                    requiredHours: requiredHoursPerPeriod,
                    activityWindow: activityWindowInDays
                }
            });
        });
    }
    catch (e) {
        console.error(e);
    }
}

export default {
    registerControllerActivityChecking: registerControllerActivityChecking
}