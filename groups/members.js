const { GuildChannel, GuildMember } = require(`discord.js`)
/**
* Gets all members currently within a voice channel in the category.
* @param {GuildChannel} lobby The lobby channel to look for members under.
* @returns {GuildMember[]} An array of all the members under the proximity chat channels.
*/
module.exports.getMembers = (lobby) => {
    const members = [];
    for (const channel of lobby.parent.children.cache) {
        if (channel['1'].type !== 2) continue;
        for (const member of channel['1'].members) {
            members.push(member['1']);
        }
    }
    return members;
}