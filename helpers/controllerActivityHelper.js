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

async function getControllerActivity(cid){
    const today = L.utc();
    const chkDate = today.minus({days: 10001});


    var hours = await ControllerHours.aggregate( [
        {
           $match: { cid: cid} 
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

     console.log(hours[0]);

    const totalTime = Math.round(hours[0].total / 1000) || 0;

    return totalTime;
}

export default {
    getControllerActivity
}