const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
	.setName('voice')
	.setDefaultMemberPermissions(1 << 3)
	.setDMPermission(false)
	.setDescription('Connect this text channel with BDS chat feed.')
	.addChannelOption(option => 
		option
			.setName('channel')
			.setDescription('Voice channel to initialize as the proximity chat origin.')
			.setRequired(true))
	.addStringOption(option =>
		option
			.setName('server-uuid')
			.setDescription("The UUID of the server you're connecting to for proximity chat.")
			.setRequired(true));

module.exports.data = data;