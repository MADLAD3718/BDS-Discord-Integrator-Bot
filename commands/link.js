const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
	.setName('link')
	.setDescription('Handle connections between your Minecraft account and discord.')
	.setDefaultMemberPermissions('0')
	.setDMPermission(true)
	.addIntegerOption(option =>
		option
			.setName('code')
			.setDescription('Input the code you were given in game to connect your Minecraft account with discord.')
			.setRequired(true));

module.exports.data = data;