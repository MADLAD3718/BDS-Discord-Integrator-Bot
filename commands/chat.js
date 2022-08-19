const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
	.setName('chat')
	.setDefaultMemberPermissions(1 << 3)
	.setDMPermission(false)
	.setDescription('Connect this text channel with BDS chat feed.')
	.addStringOption(option =>
		option
			.setName('server-uuid')
			.setDescription("The UUID of the server you're connecting the chat feed to.")
			.setRequired(true))
	.addBooleanOption(option =>
		option
			.setName('allow-channel-messages')
			.setDescription('Allow messages sent in this channel to be published in BDS chat feed.')
			.setRequired(true));

module.exports.data = data;