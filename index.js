const uuid = require("uuid");
const { createGroup } = require(`./groups/create.js`);
const { deleteGroup } = require(`./groups/delete.js`);
const fs = require('fs');
const express = require("express")
const app = express()

app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

app.get("/", (req, res) => {
	res.send(JSON.parse(fs.readFileSync('database.json')));
})

let database = JSON.parse(fs.readFileSync('database.json'));
if (!database["users"]) database["users"] = {};
if (!database["servers"]) database["servers"] = {};
if (!database["pending"]) database["pending"] = {};
fs.writeFileSync('database.json', JSON.stringify(database));

setInterval(() => {
	// console.log(`Scrubbing pending connections.`)
	for (const connection in database["pending"]) {
		const minutesAgo = (new Date().getTime() - database["pending"][connection].time) / 60000;
		// console.log(`Pending connection for ${connection} created ${minutesAgo} minutes ago.`)
		if (minutesAgo >= 5) {
			console.log(`Deleting pending connection for ${connection}`)
			delete database["pending"][connection];
			fs.writeFileSync('database.json', JSON.stringify(database));
		}
	}
}, 30 * 1000) // Run every 30 seconds

// Handle HTTP Requests
app.post("/api", async (req, res) => {
	const type = req.header('mc-data-type');
	console.log(`Recieving ${type} request from ${req.header('server-uuid')}`)
	console.log(req.body);
	switch (type) {
		case 'account-link':
			const code = Math.round(Math.random() * 9999).toString().padStart(4, '0');
			if (database["users"][req.body.username] !== undefined) {
				if (req.body.hasTag === false) {
					database["servers"][req.header('server-uuid')].queue.push(
						`tag "${req.body.username}" add linked`
					);
					fs.writeFileSync('database.json', JSON.stringify(database));
					res.set('Content-Type', 'text/plain').json(`Your link status has been updated on this server!`);
				} else {
					res.set('Content-Type', 'text/plain').json(`You have already linked your account with §9${database["users"][req.body.username].username}#${database["users"][req.body.username].discriminator}§r!`);
				}
			} else {
				if (database["pending"][req.body.username] !== undefined) {
					res.set('Content-Type', 'text/plain').json(`You already have a pending request for code §a${database["pending"][req.body.username].code}§r!`);
				} else {
					database["pending"][req.body.username] = {
						code: code,
						time: new Date().getTime(),
						origin: req.header('server-uuid')
					}
					fs.writeFileSync('database.json', JSON.stringify(database));
					res.set('Content-Type', 'text/plain').json(`Use §d/link§r in DMs with the BDS Integration bot using code §a${code}§r to link your Minecraft account with Discord.`);
				}
			}
			break;
		case 'account-unlink':
			if (database["users"][req.body.username]) {
				const discordUser = `${database["users"][req.body.username].username}#${database["users"][req.body.username].discriminator}`
				delete database["users"][req.body.username];
				fs.writeFileSync('database.json', JSON.stringify(database));
				database["servers"][req.header('server-uuid')].queue.push(
					`tag "${req.body.username}" remove linked`,
					`tellraw "${req.body.username}" {"rawtext":[{"text":"You have unlinked your account from §9${discordUser}§r."}]}`
				);
			} else {
				database["servers"][req.header('server-uuid')].queue.push(`tellraw "${req.body.username}" {"rawtext":[{"text":"You haven't linked your account with Discord!"}]}`);
			}
			res.set('Content-Type', 'text/plain').send(`Received`);
			break;
		case 'chat-message':
			if (database["servers"][req.header('server-uuid')].chat.enabled !== true) return;
			for (const channelId in database["servers"][req.header('server-uuid')].chat.channels) {
				const channel = client.channels.cache.get(channelId);
				channel.send(`<${req.body.username}> ${req.body.message}`);
			}
			res.set('Content-Type', 'text/plain').send(`Received`);
			break;
		case "announcement":
			if (database["servers"][req.header('server-uuid')].chat.enabled !== true) return;
			for (const channelId in database["servers"][req.header('server-uuid')].chat.channels) {
				const channel = client.channels.cache.get(channelId);
				channel.send(req.body.announcement);
			}
			res.set('Content-Type', 'text/plain').send(`Received`);
			break;
		case 'voice-group-create':
			if (!database["servers"][req.header("server-uuid")].voice.lobby) {
				console.log(`Lobby ID not found.`)
				return;
			}
			client.channels.fetch(database["servers"][req.header("server-uuid")].voice.lobby).then(lobby => {
				if (!lobby) return;
				const groupId = req.body.group;
				const members = req.body.members;
				console.log(`Attempting to create group ${groupId} with members ${members}`)
				createGroup(database["users"], lobby, groupId, members).then(channelId => {
					database["servers"][req.header("server-uuid")].voice.groups[groupId] = channelId;
					fs.writeFileSync('database.json', JSON.stringify(database));
				});
			});
			res.set('Content-Type', 'text/plain').send(req.body);
			break;
		case 'voice-group-add':
			const lobby = client.channels.cache.get(database["servers"][req.header('server-uuid')].voice.lobby);
			if (!lobby) return;
			const serverGroup = database["servers"][req.header('server-uuid')].voice.groups[req.body.group];
			console.log(`Group ${req.body.group} gained new member ${req.body.newMember}`);
			const channel = client.channels.cache.get(serverGroup);
			for (const member of lobby?.members) {
				try {
					if (database["users"][req.body.newMember].id === member['1'].id) {
						await member['1'].voice.setChannel(channel);
					}
				} catch { }
			}
			res.set('Content-Type', 'text/plain').send(req.body);
			break;
		case 'voice-group-remove':
			try {
				const lobby = client.channels.cache.get(database["servers"][req.header('server-uuid')].voice.lobby);
				if (!lobby) return;
				const serverGroup = database["servers"][req.header('server-uuid')].voice.groups[req.body.group];
				console.log(`Group ${req.body.group} lost member ${req.body.removedMember}`);
				const channel = await client.channels.fetch(serverGroup).then(channel => { return channel; });
				for (const member of channel?.members) {
					try {
						if (database["users"][req.body.removedMember].id === member['1'].id) {
							await member['1'].voice.setChannel(lobby);
						}
					} catch { }
				}
			} catch (error) {
				console.error(error);
			}
			res.set('Content-Type', 'text/plain').send(req.body);
			break;
		case 'voice-group-disband':
			if (!database["servers"][req.header("server-uuid")].voice.lobby) return;
			const groupId = req.body.group;
			console.log(`Group ${groupId} was deleted`);
			client.channels.fetch(database["servers"][req.header("server-uuid")].voice.lobby).then(lobby => {
				if (!lobby) return;
				const groupChannel = client.channels.cache.get(database["servers"][req.header("server-uuid")].voice.groups[groupId]);
				if (!groupChannel) {
					console.log(`Group channel not found for ${groupId}, read as:`)
					console.log(groupChannel);
					return;
				}
				deleteGroup(lobby, groupChannel).then(() => {
					groupChannel.delete().catch(console.error);
				});
				delete database["servers"][req.header("server-uuid")].voice.groups[groupId];
				fs.writeFileSync('database.json', JSON.stringify(database));
			})
			res.set('Content-Type', 'text/plain').send(req.body);
			break;
		case 'voice-group-merge':
			const deletedGroupId = req.body.deleted;
			const mergedGroupId = req.body.merged;
			try {
				const deletedGroupChannel = client.channels.cache.get(database["servers"][req.header('server-uuid')].voice.groups[deletedGroupId]);
				const mergedGroupChannel = client.channels.cache.get(database["servers"][req.header('server-uuid')].voice.groups[mergedGroupId]);
				for (const member of deletedGroupChannel?.members) {
					await member['1'].voice.setChannel(mergedGroupChannel);
				}
				delete database["servers"][req.header('server-uuid')].voice.groups[deletedGroupId];
				console.log(`Group ${deletedGroupId} was deleted`);
				deletedGroupChannel.delete();
			} catch (error) {
				console.error(error);
			}
			break;
		case 'server-init':
			const serverUUID = req.header('server-uuid');
			const validUUID = uuid.validate(serverUUID);
			res.set('Content-Type', 'text/plain').json(validUUID);
			if (database["servers"][serverUUID]) {
				database["servers"][serverUUID].chat.enabled = req.body.chat;
				database["servers"][serverUUID].voice.enabled = req.body.voice;
				client.channels.fetch(database["servers"][serverUUID].voice.lobby).then(lobby => {
					if (!lobby) return;
					for (const id in database["servers"][serverUUID].voice.groups) {
						console.log(`Group ${id} was deleted`);
						const channelId = database["servers"][serverUUID].voice.groups[id]
						client.channels.fetch(channelId).then(groupChannel => {
							if (!groupChannel) return;
							deleteGroup(lobby, groupChannel).then(() => {
								groupChannel?.delete().catch(console.error);
							});
						})
						delete database["servers"][serverUUID].voice.groups[id];
					}
				});
				database["servers"][serverUUID].queue = [];
			} else if (validUUID === true) {
				database["servers"][req.header('server-uuid')] = {
					chat: {
						enabled: req.body.chat,
						channels: {}
					},
					voice: {
						enabled: req.body.voice,
						groups: {}
					},
					queue: []
				}
			}
			fs.writeFileSync('database.json', JSON.stringify(database));
	}
})

app.get("/api", async (req, res) => {
	const type = req.header('mc-data-type');
	// Server Queue
	if (type === 'server-queue') {
		const serverUUID = req.header('server-uuid');
		if (database["servers"][serverUUID]) {
			res.set('Content-Type', 'text/plain').json(database["servers"][serverUUID].queue);
			// console.log(`Resetting Queue for server ${serverUUID}`)
			database["servers"][serverUUID].queue = [];
			fs.writeFileSync('database.json', JSON.stringify(database));
		}
	}
})

app.listen(8081, () => {
	console.log(`Websever started on port 8081!`)
})

// Discord Integration
const { Client, IntentsBitField } = require("discord.js");
const client = new Client({ intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.GuildVoiceStates, IntentsBitField.Flags.MessageContent], allowedMentions: { parse: [] } });

// Commands
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

const clientId = '1036698748937576459';

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	commands.push(command.data);
}

const rest = new REST({ version: '10' }).setToken('MTAzNjY5ODc0ODkzNzU3NjQ1OQ.GmeWCJ.T3TYj9tq6dnEndNF_8AGxwL19k11y7tgTmnXgM');

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		// console.log(commands)
		await rest.put(
			Routes.applicationCommands(clientId),
			{ body: commands },
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
})();

// Handle Command Interactions
client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;
	// Account Linking
	if (interaction.commandName === 'link') {
		let username = "";
		let serverUUID = "";
		code = interaction.options.getInteger('code').toString().padStart(4, '0');
		for (const connection in database["pending"]) {
			if (code === database["pending"][connection].code) {
				username = connection;
				database["users"][connection] = {
					id: interaction.user.id,
					username: interaction.user.username,
					discriminator: interaction.user.discriminator
				};
				serverUUID = database["pending"][connection].origin;
				delete database["pending"][connection];
				fs.writeFileSync('database.json', JSON.stringify(database));
			}
		}
		if (username !== "") {
			database["servers"][serverUUID].queue.push(
				`tag "${username}" add linked`,
				`tellraw "${username}" {"rawtext":[{"text":"Your account has been successfully linked with §9${interaction.user.username}#${interaction.user.discriminator}§r!"}]}`
			);
			await interaction.reply({ content: `You have linked this discord account with ${username}.`, ephemeral: true });
		} else {
			await interaction.reply({ content: `There are currently no pending connections for code ${code}.`, ephemeral: true });
		}
	}

	// Chat Feed Connections
	if (interaction.commandName === 'chat') {
		const serverUUID = interaction.options.getString('server-uuid');
		const channel = interaction.channelId;
		const allowChannelMessages = interaction.options.getBoolean('allow-channel-messages');

		if (database["servers"][serverUUID].chat.enabled === false) {
			await interaction.reply({ content: `Chat integration is not enabled for this server!`, ephemeral: true });
		} else {
			if (Object.keys(database["servers"][serverUUID].chat.channels).includes(channel) === false) {
				database["servers"][serverUUID].chat.channels[channel] = allowChannelMessages;
				database["servers"][serverUUID].queue.push(
					`tellraw @a {"rawtext":[{"text":"Server §9${interaction.guild.name}§r subscribed to chat feed in §9#${interaction.channel.name}§r, with §7allow channel messages§r set to §a${allowChannelMessages}§r."}]}`
				);
				fs.writeFileSync('database.json', JSON.stringify(database));
				await interaction.reply({ content: `Channel ${interaction.channel} subscribed to server \`${serverUUID}\` chat feed with allow channel messages set to ${allowChannelMessages}.`, ephemeral: true });
			} else {
				await interaction.reply({ content: `Channel ${interaction.channel} is already subscribed to server ${serverUUID} chat feed!`, ephemeral: true });
			}
		}
	}

	// Voice Chat Connections
	if (interaction.commandName === 'voice') {
		const serverUUID = interaction.options.getString('server-uuid');
		const channel = interaction.options.getChannel('channel');
		// If the channel provided was not a voice channel
		if (channel.type !== 2) {
			await interaction.reply({ content: `${channel} is not a valid voice channel!`, ephemeral: true });
			return;
		}
		// If the server does not exist
		if (!database["servers"][serverUUID]) {
			await interaction.reply({ content: `Server \`${serverUUID}\` does not exist!`, ephemeral: true });
			return;
		}
		// If server voice is disabled
		if (database["servers"][serverUUID].voice.enabled === false) {
			await interaction.reply({ content: `Voice is not enabled on server \`${serverUUID}\`.`, ephemeral: true });
			return;
		}
		// If server is already subscribed to voice
		if (database["servers"][serverUUID].voice.channels.length === 1) {
			// If the subscribed voice channel is the same as the requested one
			if (database["servers"][serverUUID].voice.channels.includes(channel.id)) {
				await interaction.reply({ content: `Channel ${channel} is already subscribed to server \`${serverUUID}\` proximity chat!`, ephemeral: true });
				return;
			}
			await interaction.reply({ content: `Server \`${serverUUID}\` already has a channel subscribed to proximity chat!`, ephemeral: true });
			return;
		}
		// Else eveything should be valid
		database["servers"][serverUUID].voice.lobby = channel.id;
		fs.writeFileSync('database.json', JSON.stringify(database));
		database["servers"][serverUUID].queue.push(
			`tellraw @a {"rawtext":[{"text":"Server §9${interaction.guild.name}§r subscribed to proximity chat in §9${channel.name}§r."}]}`
		);
		await interaction.reply({ content: `Channel ${channel} subscribed to server \`${serverUUID}\` proximity chat.`, ephemeral: true });
	}

	// Unsubscribe
	if (interaction.commandName === 'unsub') {
		// Chat
		if (interaction.options.getSubcommand() === 'chat') {
			const channel = interaction.channel.id;
			let found = false;
			for (const serverUUID in database["servers"]) {
				if (database["servers"][serverUUID].chat.channels[channel] !== undefined) {
					delete database["servers"][serverUUID].chat.channels[channel];
					found = true;
					database["servers"][serverUUID].queue.push(
						`tellraw @a {"rawtext":[{"text":"Server §9${interaction.guild.name}§r unsubscribed §9#${interaction.channel.name}§r from chat feed."}]}`
					);
					interaction.reply({ content: `Unsubscribed channel ${client.channels.cache.get(channel)} from server \`${serverUUID}\` chat feed.`, ephemeral: true });
				}
			}
			if (found === false) {
				await interaction.reply({ content: `This channel isn't subscribed to any chat feeds!`, ephemeral: true });
				return;
			}
			fs.writeFileSync('database.json', JSON.stringify(database));
		}
		// Voice
		if (interaction.options.getSubcommand() === 'voice') {
			const channel = interaction.options.getChannel('channel');
			// If the channel provided was not a voice channel
			if (channel.type !== 2) {
				await interaction.reply({ content: `${channel} is not a valid voice channel!`, ephemeral: true });
				return;
			}
			let found = false;
			for (const serverUUID in database["servers"]) {
				// If server has the channel id
				if (database["servers"][serverUUID].voice.lobby === channel.id) {
					delete database["servers"][serverUUID].voice.lobby;
					database["servers"][serverUUID].voice.groups = {};
					fs.writeFileSync('database.json', JSON.stringify(database));
					database["servers"][serverUUID].queue.push(
						`tellraw @a {"rawtext":[{"text":"Server §9${interaction.guild.name}§r unsubscribed §9${channel.name}§r from proximity chat."}]}`
					);
					interaction.reply({ content: `Unsubscribed ${channel} from server \`${serverUUID}\` proximity chat.`, ephemeral: true });
					found = true;
				}
			}
			// If no server was found
			if (found === false) {
				await interaction.reply({ content: `${channel} isn't subscribed to any server's proximity chat!`, ephemeral: true });
			}
		}
	}

	// Delete
	if (interaction.commandName === 'delete') {
		const serverUUID = interaction.options.getString('server-uuid');
		if (database["servers"][serverUUID]) {
			delete database["servers"][serverUUID];
			fs.writeFileSync('database.json', JSON.stringify(database));
			await interaction.reply({ content: `Deleted server \`${serverUUID}\` from database.`, ephemeral: true });
		} else {
			await interaction.reply({ content: `Server \`${serverUUID}\` does not exist!`, ephemeral: true });
		}
	}
});

// Message from Discord to BDS
client.on("messageCreate", msg => {
	if (msg.author.id !== client.user.id && msg.content !== '') {
		for (const serverUUID in database["servers"]) {
			if (database["servers"][serverUUID].chat.enabled !== true || database["servers"][serverUUID].chat.channels[msg.channelId] !== true) return;
			console.log(`Sending "<${msg.author.username}#${msg.author.discriminator}> ${msg.content}" to ${serverUUID}`);
			database["servers"][serverUUID].queue.push(`tellraw @a {"rawtext":[{"text":"§9<${msg.author.username}#${msg.author.discriminator}>§r ${msg.content}"}]}`);
			fs.writeFileSync('database.json', JSON.stringify(database));
		}
	}
})

client.on("ready", client => console.log(`Logged in as ${client.user.tag}!`));
client.login('MTAzNjY5ODc0ODkzNzU3NjQ1OQ.GmeWCJ.T3TYj9tq6dnEndNF_8AGxwL19k11y7tgTmnXgM').catch(console.error)