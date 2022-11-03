/**
* Deletes a group's voice channel.
* @param {Channel} lobby The voice lobby to send the users to.
* @param {Channel} groupChannel The group channel to delete.
*/
module.exports.deleteGroup = async (lobby, groupChannel) => {
	if (groupChannel) {
		const members = [];
		for (const member of groupChannel.members) {
			members.push(member['1']);
		}
		const moveMembers = members.map(member => {
			return member.voice.setChannel(lobby);
		})
		return Promise.all(moveMembers);
	}
	console.log(`No voice channel found for group.`);
	return new Promise(resolve => resolve());		
}