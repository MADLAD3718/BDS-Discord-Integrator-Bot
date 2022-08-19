const { ChannelType, ApplicationCommandOptionType } = require('discord.js');

module.exports.data = {
	name: 'voice',
	description: 'Connect a voice channel with BDS for proximity chat.',
	options: [
		{
			name: 'channel',
			description: 'Voice channel to initialize as the proximity chat origin.',
			type: ApplicationCommandOptionType.Channel,
			channelType: [ChannelType.GuildVoice],
			required: true
		},
		{
			name: 'server-uuid',
			description: "The UUID of the server you're connecting the chat feed to."	,
			type: ApplicationCommandOptionType.String,
			required: true
		}
	]
};