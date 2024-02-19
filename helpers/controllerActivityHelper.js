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
        $or: [{lastDateCheckedForActivity: {$lte: today}}, {lastDateCheckedForActivity: null}]
    });


    console.log(usersNeedingActivityCheck.filter(u => u.cid == 1496714));

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


    usersNeedingActivityCheck.forEach(user => {
        const controllerHasLessThanTwoHours = (controllerHoursSummary[user.cid] ?? 0) < 2;
        const controllerJoinedMoreThan60DaysAgo = (user.joinDate ?? user.createdAt) < chkDate;
        const controllerIsNotObserverWithTrainingSession = user.rating != observerRating || !controllerTrainingSummary[user.cid];
        const controllerInactive = controllerHasLessThanTwoHours && controllerJoinedMoreThan60DaysAgo && controllerIsNotObserverWithTrainingSession;

        if (controllerInactive){
            // Send Email 
            // Set warning date
        }
        
        // Set next check date
    });
}

export default {
    registerSendControllerActivityReminders: registerSendControllerActivityReminders
}