const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
	.setName('unsub')
	.setDescription('Unsubscribe connections between your Minecraft account and discord.')
	.setDefaultMemberPermissions(1 << 3)
	.setDMPermission(false)
	.addSubcommand(subcommand =>
		subcommand
			.setName('chat')
			.setDescription('Unsubscribe this text channel from all subscribed chat feeds.'))
	.addSubcommand(subcommand =>
		subcommand
			.setName('voice')
			.setDescription('Unsubscribe a channel from proximity chat.')
			.addChannelOption(option =>
				option
					.setName('channel')
					.setDescription('The voice channel to unsubscribe from proximity chat.')
					.setRequired(true)));

module.exports.data = data;