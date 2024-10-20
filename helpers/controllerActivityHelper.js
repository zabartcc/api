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
const activityWindowInDays = 90;
const gracePeriodInDays = 15;
const requiredHoursPerPeriod = 2;
const redisActivityCheckKey = "ACTIVITYCHECKRUNNING";

/**
 * Registers a CRON job that sends controllers reminder emails.
 */
function registerControllerActivityChecking() {
    try {
        if (process.env.NODE_ENV === 'prod') {
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

    try {
        const usersNeedingActivityCheck = await User.find(
            {
                member: true,
                $or: [{ nextActivityCheckDate: { $lte: today } }, { nextActivityCheckDate: null }]
            });

        await User.updateMany(
            { "cid": { $in: usersNeedingActivityCheck.map(u => u.cid) } },
            {
                nextActivityCheckDate: today.plus({ days: activityWindowInDays })
            }
        )

        const inactiveUserData = await getControllerInactivityData(usersNeedingActivityCheck, minActivityDate);

        inactiveUserData.forEach(async record => {
            await User.updateOne(
                { "cid": record.user.cid },
                {
                    removalWarningDeliveryDate: today.plus({ days: gracePeriodInDays })
                }
            )

            transporter.sendMail({
                to: record.user.email,
                from: {
                    name: "Albuquerque ARTCC",
                    address: 'noreply@zabartcc.org'
                },
                subject: `Controller Activity Warning | Albuquerque ARTCC`,
                template: 'activityReminder',
                context: {
                    name: record.user.fname,
                    requiredHours: requiredHoursPerPeriod,
                    activityWindow: activityWindowInDays,
                    daysRemaining: gracePeriodInDays,
                    currentHours: record.hours.toFixed(2)
                }
            });
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
        const usersNeedingRemovalWarningCheck = await User.find(
            {
                member: true,
                removalWarningDeliveryDate: { $lte: today }
            });

        usersNeedingRemovalWarningCheck.forEach(async user => {
            const minActivityDate = luxon.fromJSDate(user.removalWarningDeliveryDate).minus({ days: activityWindowInDays - 1 });
            const userHourSums = await ControllerHours.aggregate([
                {
                    $match: {
                        timeStart: { $gt: minActivityDate },
                        cid: user.cid
                    }
                },
                {
                    $project: {
                        length: {
                            "$divide": [
                                { $subtract: ['$timeEnd', '$timeStart'] },
                                60 * 1000 * 60 // Convert to hours.
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: "$cid",
                        total: { "$sum": "$length" }
                    }
                }
            ]);
            const userTotalHoursInPeriod = (userHourSums && userHourSums.length > 0) ? userHourSums[0].total : 0;
            const userTrainingRequestCount = await TrainingRequest.count({ studentCid: user.cid, startTime: { $gt: minActivityDate } });

            await User.updateOne(
                { "cid": user.cid },
                {
                    removalWarningDeliveryDate: null
                }
            )

            if (controllerIsInactive(user, userTotalHoursInPeriod, userTrainingRequestCount, minActivityDate)) {
                transporter.sendMail({
                    to: user.email,
                    cc: 'datm@zabartcc.org',
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
            }
        });
    }
    catch (e) {
        console.error(e);
    }
}

/**
 * Determines which controllers are inactive from a list and returns inactivity data of those controllers.
 * @param controllersToGetStatusFor A list of users to check the activity of.
 * @param minActivityDate The start date of the activity period.
 * @return A map of inactive controllers with the amount of hours they've controlled in the current period.
 */
async function getControllerInactivityData(controllersToGetStatusFor, minActivityDate) {
    const controllerHoursSummary = {};
    const controllerTrainingSummary = {};
    const inactiveControllers = [];
    const controllerCids = controllersToGetStatusFor.map(c => c.cid);

    (await ControllerHours.aggregate([
        {
            $match: {
                timeStart: { $gt: minActivityDate },
                cid: { $in: controllerCids }
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
        { $match: { startTime: { $gt: minActivityDate }, studentCid: { $in: controllerCids } } },
        {
            $group: {
                _id: "$studentCid",
                total: { $sum: 1 }
            }
        }
    ])).forEach(i => controllerTrainingSummary[i._id] = i.total);

    controllersToGetStatusFor.forEach(async user => {
        let controllerHoursCount = controllerHoursSummary[user.cid] ?? 0;
        let controllerTrainingSessions = controllerTrainingSummary[user.cid] != null ? controllerTrainingSummary[user.cid].length : 0

        if (controllerIsInactive(user, controllerHoursCount, controllerTrainingSessions, minActivityDate)) {
            const inactiveControllerData = {
                user: user,
                hours: controllerHoursCount
            };

            inactiveControllers.push(inactiveControllerData);
        }
    });

    return inactiveControllers;
}

/**
 * Determines if a controller meets activity requirements based on the information provided.
 * @param user The user to check for inactivity.
 * @param hoursInPeriod The hours the controller controlled in this activity window.
 * @param trainingSessionInPeriod The number of training sessions the user scheduled in this period.
 * @param minActivityDate The start date of the activity period.
 * @return True if controller is inactive, false otherwise.
 */
function controllerIsInactive(user, hoursInPeriod, trainingSessionInPeriod, minActivityDate) {
    const controllerHasLessThanTwoHours = (hoursInPeriod ?? 0) < requiredHoursPerPeriod;
    const controllerJoinedMoreThan60DaysAgo = (user.joinDate ?? user.createdAt) < minActivityDate;
    const controllerIsNotObserverWithTrainingSession = user.rating != observerRatingCode || trainingSessionInPeriod < 1;

    return controllerHasLessThanTwoHours && controllerJoinedMoreThan60DaysAgo && controllerIsNotObserverWithTrainingSession;
}

export default {
    registerControllerActivityChecking: registerControllerActivityChecking
}
