import cron from 'node-cron';
import transporter from '../config/mailer.js';
import User from '../models/User.js';
import ControllerHours from '../models/ControllerHours.js';
import TrainingRequest from '../models/TrainingRequest.js';
import { DateTime as L } from 'luxon'

const observerRating = 1;

function checkControllerActivity(){
    let minDateForActivityReminder = new Date();
    let minDateForInactivityWarning = new Date();

    const daysBeforeActivityReminder = 45; // TODO: make env var.
    const daysBeforeInactivityWarning = 60; // TODO: make env var.

    minDateForActivityReminder = minDateForActivityReminder.setDate(minDateForActivityReminder.getDate() - daysBeforeActivityReminder);
    minDateForInactivityWarning = minDateForInactivityWarning.setDate(minDateForInactivityWarning.getDate() - daysBeforeInactivityWarning);
}

async function registerSendControllerActivityReminders(){
    const today = L.utc();
    const chkDate = today.minus({days: 61});
    const controllerHoursSummary = {};
    const controllerTrainingSummary = {};

    const usersNeedingActivityCheck = await User.find(
    {
        member: true,
        $or: [{nextActivityCheckDate: {$lte: today}}, {nextActivityCheckDate: null}]
    });

    const userCidsNeedingActivityCheck = usersNeedingActivityCheck.map(u =>  u.cid);

    (await ControllerHours.aggregate([
        {$match: {
            timeStart: {$gt: chkDate},
            cid: { $in: userCidsNeedingActivityCheck }
        }},
        {$project: {
            length: {
                "$divide": [
                    {$subtract: ['$timeEnd', '$timeStart']},
                    60 * 1000 * 60
                ]
            },
            cid: 1
        }},
        {$group: {
            _id: "$cid",
            total: { "$sum": "$length" }
        }}
    ])).forEach(i => controllerHoursSummary[i._id] = i.total);

    (await TrainingRequest.aggregate([
        {$match: {startTime: {$gt: chkDate}, studentCid: { $in: userCidsNeedingActivityCheck } }},
        {$group: {
            _id: "$studentCid",
            total: {$sum: 1}
        }}
    ])).forEach(i => controllerTrainingSummary[i._id] = i.total);


    usersNeedingActivityCheck.forEach(async user => {
        const controllerHasLessThanTwoHours = (controllerHoursSummary[user.cid] ?? 0) < 2;
        const controllerJoinedMoreThan60DaysAgo = (user.joinDate ?? user.createdAt) < chkDate;
        const controllerIsNotObserverWithTrainingSession = user.rating != observerRating || !controllerTrainingSummary[user.cid];
        const controllerInactive = controllerHasLessThanTwoHours && controllerJoinedMoreThan60DaysAgo && controllerIsNotObserverWithTrainingSession;

        // Set check dates before emailing to prevent duplicate checks if an exception occurs.
        await User.updateOne(
            { "cid": user.cid},
            { 
                nextActivityCheckDate: today.plus({days: 60})
            }
        )

        if (controllerInactive){
            await User.updateOne(
                { "cid": user.cid},
                { 
                    removalWarningDeliveryDate: today.plus({days: 45})
                }
            )

            await transporter.sendMail({
                //to: user.Email,
                //cc: 'datm@zabartcc.org,atm@zabartcc.org',
                from: {
                    name: "Albuquerque ARTCC",
                    address: 'noreply@zabartcc.org'
                },
                subject: `Controller Activity Warning | Albuquerque ARTCC`,
                template: 'activityReminder',
                context: {
                    name: user.fname,
                    requiredHours: 2,
                    activityWindow: 60,
                    daysRemaining: 15,
                    currentHours: (controllerHoursSummary[user.cid]?.toFixed(2) ?? 0)
                }
            });
        }
    });
}

async function registerRemovalWarningReminders(){
    const today = L.utc();

    const usersNeedingRemovalWarning = await User.find(
    {
        member: true,
        removalWarningDeliveryDate: {$lte: today}
    });

    usersNeedingRemovalWarning.forEach(async user => {

        // FIX ME: date not updating
        await User.updateOne(
            { "cid": user.cid},
            { 
                removalWarningDeliveryDate: null
            }
        )

        await transporter.sendMail({
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
                requiredHours: 2,
                activityWindow: 60
            }
        });
    });

}

export default {
    registerSendControllerActivityReminders: registerSendControllerActivityReminders,
    registerRemovalWarningReminders: registerRemovalWarningReminders
}