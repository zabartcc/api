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
}

async function registerSendControllerActivityReminders(){
    const today = L.utc();
    const chkDate = today.minus({days: 61});

    const usersNeedingActivityCheck = await User.find(
    { 
        member: true,
        $or: [{lastDateCheckedForActivity: {$lte: today}}, {lastDateCheckedForActivity: null}]
    });

    const userCidsNeedingActivityCheck = usersNeedingActivityCheck.map(u => u.cid);

    const usersHoursControlledInTimeFrame = await ControllerHours.aggregate( [
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

    const controllersCidsUnderTwoHours = usersHoursControlledInTimeFrame.filter(h => h.totalDifference < 2).map(u => u._id);
    const controllerCidsWithNoHours = 
        userCidsNeedingActivityCheck
            .filter(u => usersHoursControlledInTimeFrame
            .filter(h => h._id == u).length == 0); // Controllers that had no ControllerHour records (did not control, 0 hours).
    const controllerCidsNeedReminder = controllerCidsWithNoHours.concat(controllersCidsUnderTwoHours);

    controllerCidsNeedReminder.forEach(c => {
        const controller = usersNeedingActivityCheck.find(u => u.cid == c);
        const hours = usersHoursControlledInTimeFrame.find(h => h._id == c)?.totalDifference ?? 0.00

        console.log(controller.fname + " " + controller.lname);
    });
}

export default {
    registerSendControllerActivityReminders: registerSendControllerActivityReminders
}