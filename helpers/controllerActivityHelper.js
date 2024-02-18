import cron from 'node-cron';
import transporter from '../config/mailer.js';
import User from '../models/User.js';
import ControllerHours from '../models/ControllerHours.js';
import { DateTime as L } from 'luxon'

function checkControllerActivity(){
    let minDateForActivityReminder = new Date();
    let minDateForInactivityWarning = new Date();

    const daysBeforeActivityReminder = 45; // TODO: make env var.
    const daysBeforeInactivityWarning = 60; // TODO: make env var.

    minDateForActivityReminder = minDateForActivityReminder.setDate(minDateForActivityReminder.getDate() - daysBeforeActivityReminder);
    minDateForInactivityWarning = minDateForInactivityWarning.setDate(minDateForInactivityWarning.getDate() - daysBeforeInactivityWarning);

    const usersNeedingActivityReminder = User.find({lastDateCheckedForActivity: {$lte: daysBeforeActivityReminder}})
}

async function registerSendControllerActivityReminders(){
    const today = L.utc();
    const chkDate = today.minus({days: 60});

    let usersNeedingActivityCheck = await User.find(
        { 
            deleted: false, 
            $or: [ {vis: true}, {member: true} ],
            $or: [{lastDateCheckedForActivity: {$lte: today}}, {lastDateCheckedForActivity: null}]
        }).exec();

    let userCidsNeedingActivityCheck = usersNeedingActivityCheck.map(u => u.cid);

    let usersHoursControlledInTimeFrame = await ControllerHours.aggregate( [
        {
            $match: {
                timeStart: {$gt: chkDate},
                cid: { $in: userCidsNeedingActivityCheck } 
            },
        },
        {$project: {
            "difference": {
                "$divide": [
                  { "$subtract": ['$timeEnd', '$timeStart'] },
                  60 * 1000 * 60
                ]
              },
            cid: 1
        }},
        {$group: {
            _id: "$cid",
            "totalDifference": { "$sum": "$difference" }
        }}
     ] ).exec();

    let controllersCidsUnderTwoHours = usersHoursControlledInTimeFrame.filter(h => h.totalDifference <= 2).map(u => u._id);
    console.log(controllersCidsUnderTwoHours)

    let controllerCidsWithNoHours = userCidsNeedingActivityCheck.filter(u => !controllersCidsUnderTwoHours.includes(u.cid));
    console.log(controllerCidsWithNoHours)

    let controllerCidsNeedReminder = controllerCidsWithNoHours.concat(controllersCidsUnderTwoHours);

    console.log(controllerCidsNeedReminder);

    const totalTime = Math.round(usersHoursControlledInTimeFrame[0].total / 1000) || 0;

    return totalTime;
}

export default {
    registerSendControllerActivityReminders: registerSendControllerActivityReminders
}