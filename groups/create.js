const { getMembers } = require(`./members.js`)
/**
* Creates a new voice group under the server's voice lobby.
* @param {object} users The list of users stored on the database.
* @param {Channel} lobby The lobby channel to create the group under.
* @param {string} groupId The ID of the group to create.
* @param {string[]} members The members of the new group.
*/
module.exports.createGroup = async (users, lobby, groupId, members) => {
	console.log(`New group with id: ${groupId}`);
	return new Promise((resolve) => {
		// Create the new channel
		lobby.parent.children.create({
			name: `MC-${groupId}`,
			type: 2
		}).then(channel => {
			channel.setParent(lobby.parentId);
			for (const member of getMembers(lobby)) {
				for (const playerName of members) {
					if (!users[playerName]) continue;
					if (users[playerName].id === member.id) {
						member.voice.setChannel(channel);
					}
				}
			}
			resolve(channel.id);
		}).catch(error => {
			console.error(error);
		});
	})
}