const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
	.setName('delete')
	.setDescription('Delete your server data from BDS Integration database.')
	.setDefaultMemberPermissions(1 << 3)
	.setDMPermission(false)
	.addStringOption(option =>
		option
			.setName('server-uuid')
			.setDescription('The UUID of the server you are deleting from the database.')
			.setRequired(true));

module.exports.data = data;