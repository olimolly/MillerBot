/**/
require("dotenv").config(); //to start process from .env file
const {Client, Intents}=require("discord.js");
const fs = require('fs');
/**
import 'dotenv/config.js';
import {Client, Intents} from 'discord.js';
import * as fs from 'fs';
// import { Guy } from './guy.js';
*/
const client = new Client({intents: [Intents.FLAGS.GUILDS, "GUILDS", "GUILD_MESSAGES", "GUILD_PRESENCES", "GUILD_MEMBERS", "DIRECT_MESSAGES"]});

client.once("ready", () => {
    console.log("BOT IS ONLINE");
})



client.on('messageCreate', async message => {

    ///// PRE INITIALISATION \\\\\
    const prefix = "!";
    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();
    const regexChan = /<#[0-9]{15,20}>/;
    const regexUser = /<@[0-9]{16,20}>/;
    const regexDate = /(?:(?:31(\/)(?:0?[13578]|1[02]))\1|(?:(?:29|30)(\/)(?:0?[13-9]|1[0-2])\2))(?:(?:1[6-9]|[2-9]\d)?\d{2})$|^(?:29(\/)0?2\3(?:(?:(?:1[6-9]|[2-9]\d)?(?:0[48]|[2468][048]|[13579][26])|(?:(?:16|[2468][048]|[3579][26])00))))$|^(?:0?[1-9]|1\d|2[0-8])(\/)(?:(?:0?[1-9])|(?:1[0-2]))\4(?:(?:1[6-9]|[2-9]\d)?\d{2})/;
    let msgContent = message.content;

    const OWNER_ID = process.env.ID_OWNER;
    const guild = await client.guilds.cache.get(process.env.GUILD_ID);
    const aRoleWhiteList = process.env.ROLE_WHITE_LIST.split(","); // 1st must be Member (isMember) Member, Friend, Invited.
    const aRoleBlackList = process.env.ROLE_BLACK_LIST.split(","); // Ping exception on those roles. Invited, Bots, VIP, etc
    const aRoleStaffRcc = process.env.ROLE_STAFF.split(","); // cf checkAdmin()

    const allGuildMembers = await guild.members.fetch();
    const chan = await message.channel; // current channel as default
    const chanGuildUsers = await chan.members.map(oMember => oMember.user); // return User information independent of Guilds (no _roles)
    const chanMessages = await chan.messages.fetch();  // limited at 50 messages

    let date = Date.now(); // const timestamp = date.toGMTString();



    try {
        JSON.parse(fs.readFileSync('Data/Guys.json', 'utf-8'));
    }
    catch (e) {
        console.error(`The JSON is invalid, ${e} has some further information.`);
    }
    let myGuys = JSON.parse(fs.readFileSync('Data/Guys.json', 'utf-8'));
    // let myGuys = await collectGuys(ALL_GuildMembers_A); // init Guy objects
    let myTmpGuys = []; // not saved in json. Opti for !presence cmd



    ///// METHODS | FUNCTIONS \\\\\

    /**
     * Guy class and constructor
    */
    class Guy {
        constructor (id, nickname, roles, isRccMember, hasCredential, hasException, lastMessage = "", isAbsent = null, dateAbsStart = null, dateAbsEnd = null, dateTimestamp = date) {
            this.id = id;
            this.nickname = nickname;
            this.roles = roles;
            this.isRccMember = isRccMember;
            this.hasCredential = hasCredential;
            this.hasException = hasException;
            this.lastMessage = lastMessage;
            this.isAbsent = isAbsent;
            this.dateAbsStart = dateAbsStart;
            this.dateAbsEnd = dateAbsEnd;
            this.dateTimestamp = dateTimestamp; // created
        }
    }/**/

    /**
     * Dump json function
     * @param {*} toJsonData
     */
    function saveGuys(toJsonData) {

        let JsonArrayOfObjects = JSON.stringify(toJsonData);
        fs.writeFile("Data/Guys.json", JsonArrayOfObjects, function(err, result) {
            if (err) {
                console.log('Error writeFile' . err);
            }
        });
    }

    /**
     * Fetch api
     * @param {*} argUserId
     * @returns promise
     */
    async function getMember(argUserId) {
        return await guild.members.fetch(argUserId);
    }

    /**
     * Log txt function
     * @param {*} content
     */
    function logAppendF(content) {
        fs.appendFile( `Logs/logfile.txt`, content, function (err, result) {
            if (err) throw err;
        });
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * @param x between 0-6, 0 = sunday
     * @returns {Date}
     */
    function nextDay(x){
        let dateTomorrow = new Date();
        dateTomorrow.setDate(dateTomorrow.getDate()+1);

        let nextDate = dateTomorrow;
        nextDate.setHours(16); nextDate.setMinutes(30); nextDate.setSeconds(0);
        nextDate.setDate(nextDate.getDate() + (x+(7-nextDate.getDay())) % 7);
        return nextDate;
    }



    /**
     * check if an array of roles includes a string role
     * @param {*} aRoles
     * @param {*} sortingRole rcc member role by default
     * @returns boolean if a guy has defined role
     */
    function checkRole(aRoles, sortingRole = aRoleWhiteList[0]) {
        return aRoles.includes(sortingRole);
    }



    /**
     * Get Members from current channel
     * that are not bots
     * @param argChanGuildUsers members of a channel (GuildChannelManager GuildChannelMembers)
     * @returns {[]} array of member IDs from a channel
     */
    function membersChannelArray(argChanGuildUsers) {
        let aChannelMembersIds = [];

        for (let i = 0; i < argChanGuildUsers.length; i++) {
            if (argChanGuildUsers[i].bot !== true) {
                aChannelMembersIds.push(argChanGuildUsers[i].id);
            }
        }

        return aChannelMembersIds;

    }



    /**
     * Get an all members from the Guild having white-listed role
     * that are not bots
     * @param argGuildMembers
     * @returns {[]} array of members IDs from the Guild
     */
    function guildMembersWithAccredArray(argGuildMembers) {
        let aMembersAccredIds = [];

        for (let [keyMap, valueMap] of argGuildMembers) {
            if (aRoleWhiteList.some(el => valueMap._roles.includes(el)) && (valueMap.user.bot !== true)) {
                aMembersAccredIds.push(keyMap);
            }
        }

        return aMembersAccredIds;
    }


    /**
     * @param {*} userId
     * @param {*} roleCondition
     * @param {*} roleException
     * @param message
     * @returns a new Guy
     */
    async function createGuy(userId, roleCondition, roleException, message = "") {
        let myGuy;
        myGuy = await getMember(userId)
            .then(resolvedMember => {
                let knownName = (resolvedMember.nickname != null ? resolvedMember.nickname : resolvedMember.user.username);
                let isRccMember = checkRole(resolvedMember._roles);

                return new Guy(
                    resolvedMember.user.id, // string
                    knownName, // string
                    resolvedMember._roles, // array
                    isRccMember, // boolean
                    roleCondition.some(el => resolvedMember._roles.includes(el)), // boolean // If at least one role condition in aRoleWhiteList is included in a member's roles.
                    roleException.some(el => resolvedMember._roles.includes(el)) // boolean
                );
            })
            .catch(() => {
                console.error('Error caught on getMember(' + userId + ')');
            });

        return myGuy;
    }



    /**
     * Members having posted a message in a specified channel
     * That is not a bot and that is not in array already
     * @param {*} argChanMessages a message
     * @returns array of members IDs from a message
     */
    function manifestedMembersArray(argChanMessages) {
        let aManifestedMembersIds = [];

        argChanMessages.forEach((oMessage) => {
            if ((oMessage.author.bot !== true) && (aManifestedMembersIds.indexOf(oMessage.author.id) === -1)) {
                aManifestedMembersIds.push(oMessage.author.id);
            }
        });

        return aManifestedMembersIds;
    }

    /**
     * TODO change foreach into for loop key value and merge with duplicated manifestedMembersArray
     * Get manifested members from Messages Collection [Map]
     * @param argChanMessages Collection [Map]
     * @returns {[]} array of messages with unique user
     */
    function manifestedMembersMessagesArray(argChanMessages) {
        let aManifestedMembers = [];

        argChanMessages.forEach((oMessage) => {
            if ((oMessage.author.bot !== true) && (aManifestedMembers.indexOf(oMessage.author.id) === -1)) {
                aManifestedMembers.push(oMessage);
            }
        });

        return aManifestedMembers;
    }

    /**
     * Collect or Update
     * Get members from array of IDs (with extra logs)
     * @param {*} arrIDs
     * @returns array of objects
     */
    async function collectGuys(arrIDs) {
        let countAccredited = 0;
        let countExempted = 0;
        let myGuy;
        let nStatus = 0;
        let strError = 'Erreur logged :: Erreur dans le lot des membres filtrés, arrêt du traitement. ';
        let strExcluded = ' :: Ce membre est exempté: ';
        let contentLog = '=======\n' + date;

        for (let i = 0; i < arrIDs.length; i++) {

            myGuy = await createGuy(arrIDs[i], aRoleWhiteList, aRoleBlackList).then(resMember => {

                if((resMember.hasCredential === true) && (resMember.hasException !== true)) {
                    countAccredited++;
                    nStatus = 0; // OK
                } else if (resMember.hasException === true) {
                    countExempted++; // unauthorized
                    logAppendF(contentLog += strExcluded + resMember.nickname + "\n");
                    nStatus = 1;
                } else {
                    logAppendF(contentLog = contentLog + strError + '\nError logged :: Check this Guy\'s roles: ' + resMember.id + ':' + resMember.nickname);
                    nStatus = -1; // error
                }

                return resMember;
            });

            if (nStatus === -1) {
                console.log('Break For loop.'); break;
            } else {
                addGuyIfNotExist(myGuy, myGuys);
            }
        }

        if ((countAccredited + countExempted) !== arrIDs.length) {
            console.error(contentLog + "Décompte de message inégale.");
            return "Retourne un décompte de message inégale. ";
        } else {
            contentLog = `Accredités: ${countAccredited} - exemptés: ${countExempted} \nCumul accredités et exemptés = ${countAccredited + countExempted} <==> ${arrIDs.length} messages | Poursuite du traitement.\n-------\n`;
            logAppendF(contentLog);
            saveGuys(myGuys);
            return myGuys;
        }
    }



    /**
     * TODO: Merge function * TMP test duplicated function to insert last message
     * Collect or Update
     * Get members and messages from array of messages
     * @param arrMsg
     * @returns {Promise<void>}
     */
    async function collectMessagesGuys(arrMsg) {
        let countAccredited = 0;
        let countExempted = 0;
        let myGuy;
        let nStatus = 0;
        let strError = 'Erreur logged :: Erreur dans le lot des membres filtrés, arrêt du traitement. ';
        let strExcluded = ' :: Ce membre est exempté: ';
        let contentLog = '=======\n' + date;

        for (let i = 0; i < arrMsg.length; i++) {

            myGuy = await createGuy(arrMsg[i].author.id, aRoleWhiteList, aRoleBlackList, msgFormat(arrMsg[i].content)).then(resMember => {
                if((resMember.hasCredential === true) && (resMember.hasException !== true)) {
                    countAccredited++;
                    nStatus = 0; // OK
                } else if (resMember.hasException === true) {
                    countExempted++; // unauthorized
                    logAppendF(contentLog += strExcluded + resMember.nickname + "\n");
                    nStatus = 1;
                } else {
                    logAppendF(contentLog = contentLog + strError + '\nError logged :: Check this Guy\'s roles: ' + resMember.id + ':' + resMember.nickname);
                    nStatus = -1; // error
                }

                return resMember;
            });

            if(nStatus === -1) { console.log('break for loop'); break; }

            addGuyIfNotExist(myGuy, myGuys);

            // update last message
            let fIndex = myGuys.findIndex(x => x.id === myGuy.id);
            let tmpLastMsg = msgFormat(arrMsg[i].content);
            if (myGuys[fIndex] !== undefined) {
                myGuys[fIndex].lastMessage !== tmpLastMsg ? myGuys[fIndex].lastMessage = tmpLastMsg : logAppendF(`is same message \"${tmpLastMsg}\" already in. `);
            } else {
                console.log("myGuys[fIndex] : " + myGuys[fIndex]);
            }
        }
        saveGuys(myGuys);
    }



    function addGuyIfNotExist(argGuy, argGuys) {
        let fIndex = argGuys.findIndex(x => x.id === argGuy.id);
        fIndex === -1 ? argGuys.push(argGuy) : logAppendF(`object ${argGuy.nickname} - Guy already exists `);
    }

    function findGuy(argUserId) {
        return myGuys.find(x => x.id === argUserId);
    }

    function updateGuy(argGuy, data = myGuys) {
        let aUpdatedGuys = data;
        let fIndex = aUpdatedGuys.findIndex(x => x.id === argGuy.id);
        aUpdatedGuys[fIndex] = argGuy;
        saveGuys(aUpdatedGuys);
    }

    async function updateGuysPromise() {
        for (let i = 0; i < myGuys.length; i++) {
            await getMember(myGuys[i].id)
                .then(resolvedMember => {
                    //myGuys[i].nickname = (resolvedMember.nickname != null ? resolvedMember.nickname : resolvedMember.user.username);
                    myGuys[i].isRccMember = checkRole(resolvedMember._roles);
                    updateGuy(myGuys[i]);
                })
                .catch(() => {
                    console.error('Error caught on getMember(' + myGuys[i].id + ')');
                });
        }
    }

    /*
    function updateGuys(argGuys, data = myGuys) {
        let aUpdatingGuys = data;
        for (let i = 0; i < argGuys.length; i++) {
            let fIndex = aUpdatingGuys.findIndex(x => x.id === argGuys[i].id);
            aUpdatingGuys[fIndex] = argGuys[i];
        }
        saveGuys(aUpdatingGuys);
    }
     */



    function editAbsent(argUserId, bAbsence, dateEnd = null) {
        let foundGuy = findGuy(argUserId);
        if (foundGuy !== undefined) {
            foundGuy.isAbsent = bAbsence;
            foundGuy.dateAbsStart = date;
            foundGuy.dateAbsEnd = dateEnd;
            updateGuy(foundGuy);
        } else {
            console.error("Error: can't find user.")
        }
    }

    /**
     * Refresh and update absences before listing
     * @param absGuys
     */
    function checkAbsences(absGuys) {

        for (let i = 0; i < absGuys.length; i++) {
            if (regexDate.test(absGuys[i].dateAbsEnd)) {
                let aDateInput = absGuys[i].dateAbsEnd.split("/");
                let formatDate = aDateInput[1] + "/" + aDateInput[0] + "/" + aDateInput[2];
                let newDateEnd = new Date(formatDate).getTime();

                if (newDateEnd < date) {
                    absGuys[i].isAbsent = false;
                    absGuys[i].dateAbsEnd = null;
                    updateGuy(absGuys[i]);
                    logAppendF('Fin d\'absence de ' + absGuys[i].nickname);
                    // ('Fin d\'absence de ' + absGuys[i].nickname)
                } /*else {
                console.log("Absence toujours en cours.")
            }*/
            }
        }
    }

    function listAbsences() {
        let absGuys = myGuys.filter(x => x.isAbsent === true);
        checkAbsences(absGuys);
        return absGuys.map((_x, index) => `${index+1}. **${_x.nickname}** ==> ${_x.dateAbsEnd}\n`).join('');
    }



    /**
     * sort and return local Guys objects from array of id
     * @param aInputIDs
     * @param arrayF variation with myGuys as default
     */
    function getGuys(aInputIDs, arrayF = myGuys) {
        let aTmp;
        aTmp = arrayF.filter(element => aInputIDs.includes(element.id));
        aTmp.sort(function(elA, elB) {
            let nameA = elA.nickname.toUpperCase();
            let nameB = elB.nickname.toUpperCase();
            if (nameA < nameB) {
                return -1; //nameA comes first
            }
            if (nameA > nameB) {
                return 1; // nameB comes first
            }
            return 0;  // names must be equal
        });
        return aTmp.sort((argA, argB) => { return argB.isRccMember - argA.isRccMember; });
    }



    /**
     * Mother function using guild.members.fetch("ID")
     * @param {*} argA array of strings with id from member in the channel
     * @param {*} argB array of strings with id having posted a message in the channel
     * @returns array of Objects (a - b)
     */
    async function filterUnmanifestedMembers(argA,argB) {

        myTmpGuys = await collectGuys(argA);

        // isSameUser Get items that only occur in the left array,
        // using the compareFunction to determine equality.
        // A comparer used to determine if two entries are equal.
        const isSameUser = (compA, compB) => compA === compB;
        const onlyInLeft = (left, right, compareFunction) =>
            left.filter(leftValue =>
                !right.some(rightValue => compareFunction(leftValue, rightValue)));

        const aOnlyInA = onlyInLeft(argA, argB, isSameUser); // ==> unmanifested (IDs)
        const aOnlyInB = onlyInLeft(argB, argA, isSameUser); // ==> data integrity error if not empty (IDs)

        if (aOnlyInB.length !== 0) {
            console.error(`Error data integrity on manifested IDs: ${aOnlyInB}.\nSome users should not have any message in this channel. Please remove thoses messages and try again.`);
            logAppendF(`Error data integrity on manifested IDs: ${aOnlyInB}.\nSome users should not have any message in this channel. Please remove thoses messages and try again.`);
            return null;
        } else {
            return getGuys(aOnlyInA, myTmpGuys);
        }
    }


    /**
     * @param argChannelUsers
     * @param cmdName
     * @returns {boolean}
     */
    function checkAdminOrModo(argChannelUsers, cmdName = "N/A") {
        const cmdLaunchedById = message.author.id;
        const cmdMember = argChannelUsers.find(elUser => elUser.id === cmdLaunchedById);
        // if (cmdMember !== undefined) {
            if ((cmdLaunchedById === OWNER_ID) || (aRoleStaffRcc.some(elRole => cmdMember._roles.includes(elRole)))) {
                console.log(cmdMember.username + " executed command and is bot owner or in staff team " + cmdName)
                return true;
            } else {
                console.log(cmdMember.username + "does not have proper rights for this command " + cmdName + ", exit.\n=======================================================================================================\n")
                return false;
            }
        // } else {
        //     console.error("non habilité à utiliser cette commande.");
        // }
    }


    /**
     * initJsonGuys
     */
    function initJsonGuys() {
        let initGuys = [];
        let initGuy = new Guy(11111111111111111,"nickname",["22222222222222221"], false, false, false, "init");
        initGuys.push(initGuy);
        saveGuys(initGuys);

        logAppendF('Initialising members in json file.');
        console.log('Initialising members in json file.')
    }

    /**
     * @param stringFormat
     * @returns {*}
     */
    function msgFormat(stringFormat) {
        return stringFormat.slice(0,42).replace(/[*_@!~]|https?:\/\/(www\.)?(tenor.com\/view\/)?/g, '');
    }



    ///// POST INITIALISATION \\\\\
    const ALL_GuildMembers_A = guildMembersWithAccredArray(allGuildMembers); // users with accred from the Guild
    const a = membersChannelArray(chanGuildUsers); // only from current channel
    const b = manifestedMembersArray(chanMessages); // only from current channel
    const strRegexError = 'Regex does not match. Command argument error.';


/*
    try {
        const dataGuys = JSON.parse(fs.readFileSync('Data/Guys.json', 'utf-8'));
    } catch (err) {
        console.log('Error json input: ', err);
    }
*/



    ///// COMMANDS \\\\\
    if ((command === 'presence') && (checkAdminOrModo(chanGuildUsers, '!Presence'))) {
        // compares manifested and unmanifested from current channel

        message.delete();
        // listAbsences();

        const aPresenceC = await filterUnmanifestedMembers(a,b);
        const displayUnmanifested = aPresenceC.map(_x => `${(_x.isAbsent || _x.hasException) ? '' : '<@' + _x.id + '>'}`);
        const strUnmanifested =  "Merci d'indiquer votre **présence/absence** afin d'aider les game masters: \n";

        logAppendF(strUnmanifested + [...displayUnmanifested].join(' - '));
        message.channel.send(strUnmanifested + [...displayUnmanifested].join(' '));
        // TODO ajouter condition si displayUnmanifested empty tout le monde s'est manifesté ?

        console.log(`\n — Presence command used by ${message.author.username}. \n`);

    } else if ((command === 'recap') && (checkAdminOrModo(chanGuildUsers, '!Recap'))) {
        // compares manifested and unmanifested from a targeted channel with all white-listed (role) in the Guild.

        message.delete();
        listAbsences();

        let inputChannelId = "0";
        let argTextRecap = msgContent.slice(7);
        let aManifested_B = [];
        let chanMessageDist = [];
        let aManifestedIDs_B = [];

        if ((argTextRecap === undefined) || (argTextRecap.length < 18)) {

            inputChannelId = message.channel.id;
            let aOneMsgMember_B = manifestedMembersMessagesArray(chanMessages);
            await collectMessagesGuys(aOneMsgMember_B); // update lastMessage
            aManifestedIDs_B = manifestedMembersArray(chanMessages)
            aManifested_B = getGuys(aManifestedIDs_B);
            console.log("Arg Test Recap is undefined, selecting current channel");

        } else if (regexChan.test(argTextRecap)) {
            inputChannelId = argTextRecap.slice(2, -1);
            console.log('recap target channel: ' + inputChannelId);

            let chanFetched = await client.channels.fetch(inputChannelId);
            chanMessageDist = await chanFetched.messages.fetch();

            let aOneMsgMembers_B = manifestedMembersMessagesArray(chanMessageDist);
            await collectMessagesGuys(aOneMsgMembers_B); // update lastMessage

            aManifestedIDs_B = manifestedMembersArray(chanMessageDist);
            aManifested_B = getGuys(aManifestedIDs_B);
        } else {
            console.log(strRegexError + " Must be a channel.");
        }

        let aRecapC = await filterUnmanifestedMembers(ALL_GuildMembers_A, aManifestedIDs_B);
        if (aRecapC !== null) {
            logAppendF(aRecapC.map((_x, index) => `${index+1}. ${_x.nickname}\n`).join(''));
            message.channel.send('__Recap des membres manifestés sur le channel <#' + inputChannelId + '>:__\n' + aManifested_B.map((_x, index) => `${index+1}. **${_x.nickname}:** _${_x.lastMessage}_\n`).join(''));
            let txtRecapNonManif = '__Recap des non-manifestés:__ \n' + aRecapC.map((_x, index) => `${index+1}. **${_x.nickname}** ${ _x.isAbsent ? '*absent ==> ' + _x.dateAbsEnd + '*' : '' }\n`).join(''); // TODO if null show "undetermined"
            message.channel.send(txtRecapNonManif);
            console.log(`\n — Recap command used by ${message.author.username}. \n`);
        } else {
            console.error('aRecapC is null, can\'t execute command');
            logAppendF('aRecapC is null, can\'t execute command');
        }

    } else if ((command === 'update') && (checkAdminOrModo(chanGuildUsers, '!update'))) {

        message.delete();
        // TODO duplicated from recap
        await updateGuysPromise();

        /*
        let inputChannelId = "0";
        let argTextRecap = msgContent.slice(14);
        let aManifested_U = [];
        let chanMessageDist = [];
        let aManifestedIDs_U = [];

        if (regexChan.test(argTextRecap)) {
            inputChannelId = argTextRecap.slice(2, -1);
            console.log('updateMember target channel: ' + inputChannelId);

            let chanFetched = await client.channels.fetch(inputChannelId);
            chanMessageDist = await chanFetched.messages.fetch();

            let aOneMsgMembers_B = manifestedMembersMessagesArray(chanMessageDist);
            await collectMessagesGuys(aOneMsgMembers_B); // update lastMessage
            //
            let fIndex = myGuys.findIndex(x => x.id === myGuy.id);
            let tmpLastMsg = msgFormat(arrMsg[i].content);
            if (myGuys[fIndex] !== undefined) {
                myGuys[fIndex].lastMessage !== tmpLastMsg ? myGuys[fIndex].lastMessage = tmpLastMsg : logAppendF(`is same message \"${tmpLastMsg}\" already in. `);
            } else {
                console.log("myGuys[fIndex] : " + myGuys[fIndex]);
            }

            aManifestedIDs_U = manifestedMembersArray(chanMessageDist);

            console.log(aManifestedIDs_U);

        } else {
            console.log(strRegexError + " Must be a channel.");
        }*/

    } else if ((command === 'initGuys') && (checkAdminOrModo(chanGuildUsers, '!initGuys'))) {

        // TODO do tests for empty json
        message.delete();
        initJsonGuys();

    } else if ((command === 'absent') && (checkAdminOrModo(chanGuildUsers, '!absent'))) {  // Ex: !absent <@58xxxx28> on

        message.delete();

        let argTextAbs = msgContent.slice(8);
        let arg3 = msgContent.split(' ');
        let inputUserId = arg3[1].slice(2, -1);

        if ((argTextAbs === undefined) || (argTextAbs.length < 18)) {
            console.log("Arg absent is undefined.");
        } else if ((regexUser.test(argTextAbs)) && (arg3[2]) !== undefined) {

            if (arg3[2].toUpperCase() === 'OFF') {
                editAbsent(inputUserId, false);
                console.log('editing absent to false');
            } else if (arg3[2].toUpperCase() === 'ON') {
                if (regexDate.test(arg3[3])) {
                    editAbsent(inputUserId, true, arg3[3]);
                } else if (arg3[3] === "?") {
                    editAbsent(inputUserId, true, "date indéterminée");
                } else {
                    editAbsent(inputUserId, true);
                }
                console.log('editing absent to true');
            } else {
                console.error('Error arg3[2] with !absent command. Unknown parameter, must be ON or OFF.');
            }

            // console.log('set ' + findGuy(inputUserId).nickname + ' absent status: ' + findGuy(inputUserId).isAbsent); // bug .nickname not found if not in .json

        } else {
            console.log(strRegexError + " Must be @Member + On/Off");
        }

    } else if ((command === 'absences') && (checkAdminOrModo(chanGuildUsers, '!absences'))) {

        message.delete();
        message.channel.send('__Liste des absences enregistrées:__ \n' + listAbsences());

    } else if ((command === 'event') && (checkAdminOrModo(chanGuildUsers, '!event'))) {

        message.delete();
        let timeStart = nextDay(6);
        let timeEnd = nextDay(6);
        timeEnd.setHours(19);
        timeEnd.setMinutes(0);
        console.log(timeStart.toLocaleString);
        console.log(timeEnd.toLocaleString());

        const missionEvent = await guild.scheduledEvents.create({
            name: 'Mission coop R.C.C',
            scheduledStartTime: timeStart,
            scheduledEndTime: timeEnd,
            privacyLevel: 'GUILD_ONLY',
            entityType: 'EXTERNAL',
            description: "Mission: TBD\nModset: TBD\n\nInscription et choix du slot directement dans le salon #mission.\nAdressez-vous à un modérateur pour demander l'accès au salon d'inscription.\n",
            entityMetadata: {location: 'Serveur du 1er R.C.C / TeamSpeak'},
            // image: "https://cdn.discordapp.com/attachments/964589608820158505/1030824108277108828/RVSLogo.jpg",
            reason: "Missions hebdomadaire du 1er R.C.C"
        })
            .then(console.log)
            .catch(console.error);

        // description: "Mission:\nModset:\n\nInscription et choix du slot directement dans le salon #mission-samedi.\nAdressez-vous à un modérateur si vous souhaitez participer en invité pour obtenir l'accès au salon d'inscription.\n",

        // console.log(testPromise);
        /*
        guild.channels.create('new-general', { reason: 'Needed a cool new channel' })
            .then(console.log)
            .catch(console.error);
         */

    } else if ((command === 'test') && (checkAdminOrModo(chanGuildUsers, '!test'))) {

        message.channel.send('test');
        console.log(process.env.ROLE_STAFF)

        message.delete();

    } else if ((command === 'say') && (checkAdminOrModo(chanGuildUsers, '!say'))) {

        let argTextSay = msgContent.slice(5);
        message.delete();
        message.channel.send(argTextSay);

    } else if ((command === 'clear-for-presence') && (checkAdminOrModo(chanGuildUsers, '!clear-for-presence'))) {
        message.delete();

        let [nMsgToRm] = args;
        if ((args.length !== 0) && (args[0] < 101)) {
            await message.channel.bulkDelete(`${nMsgToRm}`)
                .then(messages => console.log(`Bulk deleted ${messages.size} messages`))
                .catch(console.error);
        } else {
            console.log("La commande !clear-for-presence must have a number (max 100) as argument.")
            await message.channel.send({
                content: 'La commande !clear-for-presence must have a number inferior or equal as 100 as argument. Ex: "!clear-for-presence 100',
                ephemeral: false
            });
        }
    }

});

client.login(process.env.BOT_TOKEN);

    ///// TMP \\\\\

    /* MEMO
    // Fetch a single role
    message.guild.roles.fetch('222078108977594368')
        .then(role => console.log(`The role color is: ${role.color}`))
        .catch(console.error);
    */

    /** DEBUG
    varToJson = JSON.stringify(chanMessages);
    fs.writeFile("chanMessages.json", varToJson, function(err, result) {
        if(err) console.log('error', err);
    /**/
