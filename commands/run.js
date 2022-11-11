const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
	.setName('run')
	.setDefaultMemberPermissions(1 << 3)
	.setDMPermission(false)
	.setDescription('Run a command on a connected server.')
	.addStringOption(option =>
		option
			.setName('server-uuid')
			.setDescription("The UUID of the server to run the command on.")
			.setRequired(true))
	.addStringOption(option =>
		option
			.setName('command')
			.setDescription("The command you would like to run. Do not include \"/\".")
			.setRequired(true));

module.exports.data = data;