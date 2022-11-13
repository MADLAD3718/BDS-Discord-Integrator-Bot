const { write } = require("../database_functions");

module.exports.accountLink = function accountLink(database, serverUUID, username, hasTag, response) {
    const code = Math.round(Math.random() * 9999).toString().padStart(4, '0');
    if (database["users"][username] !== undefined) {
        if (hasTag === false) {
            database["servers"][serverUUID].queue.push(
                `tag "${username}" add linked`
            );
            write(database);
            response.set('Content-Type', 'text/plain').json(`Your link status has been updated on this server!`);
        } else {
            response.set('Content-Type', 'text/plain').json(`You have already linked your account with §9${database["users"][username].username}#${database["users"][username].discriminator}§r!`);
        }
    } else {
        if (database["pending"][username] !== undefined) {
            response.set('Content-Type', 'text/plain').json(`You already have a pending request for code §a${database["pending"][username].code}§r!`);
        } else {
            database["pending"][username] = {
                code: code,
                origin: serverUUID
            }
            write(database);
            setTimeout(() => {
                if (!database["pending"][username]) return console.log(`Pending link for ${username} was already used`);
                console.log(`Deleting pending connection for ${username}`)
                database["servers"][serverUUID].queue.push(
                    `tellraw "${username}" {"rawtext":[{"text":"Your pending link code has expired! You can use the link command to create a new one."}]}`
                );
                delete database["pending"][username];
                write(database);
            }, 5 * 60 * 1000);
            response.set('Content-Type', 'text/plain').json(`Use the §d/link§r command with your BDS Integration bot using code §a${code}§r to link your Minecraft account with Discord.`);
        }
    }
}