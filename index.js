const uuid = require("uuid");

const Database = require("@replit/database")
const db = new Database()

const express = require("express")
const app = express()

app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

app.get("/", (req, res) => {
	db.getAll().then(list => {
		res.send(list)
	})
})

let users = {};
let servers = {};
let pending = {};
db.getAll().then(value => {
	if (value["users"]) {
		users = value["users"];
	} else {
		db.set('users', users);
	}
	if (value["servers"]) {
		servers = value["servers"];
	} else {
		db.set('servers', servers);
	}
	if (value["pending"]) {
		pending = value["pending"];
	} else {
		db.set('pending', pending);
	}
})

setInterval(() => {
	// console.log(`Scrubbing pending connections.`)
	Object.keys(pending).forEach(connection => {
		const minutesAgo = (new Date().getTime() - pending[connection].time) / 60000;
		// console.log(`Pending connection for ${connection} created ${minutesAgo} minutes ago.`)
		if (minutesAgo >= 5) {
			// console.log(`Deleting pending connection for ${connection}`)
			delete pending[connection];
			db.set('pending', pending);
		}
	})
}, 30 * 1000)

// Handle HTTP Requests
app.post("/api", async (req, res) => {
	const type = req.header('mc-data-type');

	// Account Linking
	if (type === 'account-link') {
		const code = Math.round(Math.random() * 9999).toString().padStart(4, '0');
		const serverUUID = req.header('server-uuid');
		if (users[req.body.username] !== undefined) {
			if (req.body.hasTag === false) {
				servers[serverUUID].queue.push(
					`tag "${req.body.username}" add linked`
				);
				db.set('servers', servers);
				// console.log(`Updated link status for ${req.body.username} at ${serverUUID}`)
				res.set('Content-Type', 'text/plain').json(`Your link status has been updated on this server!`);
			} else {
				// console.log(`${req.body.username} already linked in ${serverUUID}`)
				res.set('Content-Type', 'text/plain').json(`You have already linked your account with §9${users[req.body.username].username}#${users[req.body.username].discriminator}§r!`);
			}
		} else {
			if (pending[req.body.username] !== undefined) {
				// console.log(`${req.body.username} already had a pending request.`)
				res.set('Content-Type', 'text/plain').json(`You already have a pending request for code §a${pending[req.body.username].code}§r!`);
			} else {
				// console.log(`New request for ${req.body.username} from ${serverUUID}.`)
				pending[req.body.username] = {
					code: code,
					time: new Date().getTime(),
					origin: serverUUID
				}
				db.set('pending', pending);
				res.set('Content-Type', 'text/plain').json(`Use §d/link§r in DMs with the BDS Integration bot using code §a${code}§r to link your Minecraft account with Discord.`);
			}
		}
	}

	// Account Unlinking
	if (type === 'account-unlink') {
		const serverUUID = req.header('server-uuid');
		if (users[req.body.username]) {
			const discordUser = `${users[req.body.username].username}#${users[req.body.username].discriminator}`
			delete users[req.body.username];
			db.set('users', users);
			servers[serverUUID].queue.push(
				`tag "${req.body.username}" remove linked`,
				`tellraw "${req.body.username}" {"rawtext":[{"text":"You have unlinked your account from §9${discordUser}§r."}]}`
			);
		} else {
			servers[serverUUID].queue.push(`tellraw "${req.body.username}" {"rawtext":[{"text":"You haven't linked your account with Discord!"}]}`);
		}
		res.set('Content-Type', 'text/plain').send(`Received`);
	}

	// Chat Message
	if (type === 'chat-message') {
		if (servers[req.header('server-uuid')].chat.enabled === true) {
			Object.keys(servers[req.header('server-uuid')].chat.channels).forEach(channelId => {
				const channel = client.channels.cache.get(channelId);
				channel.send(`<${req.body.username}> ${req.body.message}`);
			})
		}
		res.set('Content-Type', 'text/plain').send(`Received`);
	}

	// Create Voice Group
	if (type === 'voice-group-create') {
		console.log(`Recieving ${type} request from ${req.header('server-uuid')}`)
		console.log(req.body);
		try {
			const serverUUID = req.header('server-uuid');
			const lobby = client.channels.cache.get(servers[serverUUID].voice.channels[0]);
			if (!lobby) return;
			console.log(`New group with id: ${req.body.group}`);
			// Create the new channel
			lobby.parent.children.create({
				name: `MC-${req.body.group}`,
				type: 2
			}).then(channel => {
				channel.setParent(lobby.parentId);
				servers[serverUUID].voice.groups[req.body.group] = channel.id;
				for (const member of lobby.members) {
					req.body.members.forEach(name => {
						try {
							if (users[name].id === member['1'].id) {
								member['1'].voice.setChannel(channel);
							}
						} catch { }
					})
				}
			}).catch(error => {
				console.error(error);
			});
			db.set('servers', servers);
		} catch (error) {
			console.error(error);
		}
		res.set('Content-Type', 'text/plain').send(req.body);
	}

	// Add Player to Voice Group
	if (type === 'voice-group-add') {
		console.log(`Recieving ${type} request from ${req.header('server-uuid')}`)
		console.log(req.body);
		const serverUUID = req.header('server-uuid');
		const lobby = client.channels.cache.get(servers[serverUUID].voice.channels[0]);
		if (!lobby) return;
		const serverGroup = servers[serverUUID].voice.groups[req.body.group];
		console.log(`Group ${req.body.group} gained new member ${req.body.newMember}`);
		const channel = client.channels.cache.get(serverGroup);
		for (const member of lobby.members) {
			try {
				if (users[req.body.newMember].id === member['1'].id) {
					await member['1'].voice.setChannel(channel);
				}
			} catch { }
		}
		res.set('Content-Type', 'text/plain').send(req.body);
	}

	// Remove Player from Voice Group
	if (type === 'voice-group-remove') {
		console.log(`Recieving ${type} request from ${req.header('server-uuid')}`)
		console.log(req.body);
		try {
			const serverUUID = req.header('server-uuid');
			const lobby = client.channels.cache.get(servers[serverUUID].voice.channels[0]);
			if (!lobby) return;
			const serverGroup = servers[serverUUID].voice.groups[req.body.group];
			console.log(`Group ${req.body.group} lost member ${req.body.removedMember}`);
			const channel = await client.channels.fetch(serverGroup).then(channel => { return channel; });
			for (const member of channel.members) {
				try {
					if (users[req.body.removedMember].id === member['1'].id) {
						await member['1'].voice.setChannel(lobby);
					}
				} catch { }
			}
		} catch (error) {
			console.error(error);
		}
		res.set('Content-Type', 'text/plain').send(req.body);
	}

	// Disband Voice Group
	if (type === 'voice-group-disband') {
		console.log(`Recieving ${type} request from ${req.header('server-uuid')}`)
		console.log(req.body);
		try {
			const serverUUID = req.header('server-uuid');
			const lobby = client.channels.cache.get(servers[serverUUID].voice.channels[0]);
			console.log(`Group ${req.body.group} was deleted`);
			const voiceChannel = client.channels.cache.get(servers[serverUUID].voice.groups[req.body.group]);
			delete servers[serverUUID].voice.groups[req.body.group];
			if (!lobby) return;
			if (!voiceChannel) console.log(`No VC?`)
			for (const member of voiceChannel.members) {
				await member['1'].voice.setChannel(lobby);
			}
			voiceChannel.delete();
		} catch (error) {
			console.error(error);
		}
		res.set('Content-Type', 'text/plain').send(req.body);
	}

	// Merge Voice Group
	if (type === 'voice-group-merge') {
		console.log(`Recieving ${type} request from ${req.header('server-uuid')}`)
		console.log(req.body);
		const serverUUID = req.header('server-uuid');
		const deletedGroupId = req.body.deleted;
		const mergedGroupId = req.body.merged;
		try {
			const deletedGroupChannel = client.channels.cache.get(servers[serverUUID].voice.groups[deletedGroupId]);
			const mergedGroupChannel = client.channels.cache.get(servers[serverUUID].voice.groups[mergedGroupId]);
			for (const member of deletedGroupChannel.members) {
				await member['1'].voice.setChannel(mergedGroupChannel);
			}
			delete servers[serverUUID].voice.groups[deletedGroupId];
			console.log(`Group ${deletedGroupId} was deleted`);
			deletedGroupChannel.delete();
		} catch (error) {
			console.error(error);
		}
	}

	// Server Param Sync
	if (type === 'server-init') {
		console.log(`Recieving ${type} request from ${req.header('server-uuid')}`)
		console.log(req.body);
		const validUUID = uuid.validate(req.header('server-uuid'));
		res.set('Content-Type', 'text/plain').json(validUUID);
		if (servers[req.header('server-uuid')]) {
			const serverUUID = req.header('server-uuid');
			servers[serverUUID].chat.enabled = req.body.chat;
			servers[serverUUID].voice.enabled = req.body.voice;
			const lobby = client.channels.cache.get(servers[serverUUID].voice.channels[0]);
			if (!lobby) return;
			for (const id in servers[serverUUID].voice.groups) {
				try {
					console.log(`Group ${id} was deleted`);
					const voiceChannel = client.channels.cache.get(servers[serverUUID].voice.groups[id]);
					if (!voiceChannel) console.log(`No VC?`)
					for (const member of voiceChannel.members) {
						await member['1'].voice.setChannel(lobby);
					}
					voiceChannel.delete();
				} catch (error) {
					console.error(error);
				}
				delete servers[serverUUID].voice.groups[id];
			}
			servers[serverUUID].queue = [];
		} else if (validUUID === true) {
			servers[req.header('server-uuid')] = {
				chat: {
					enabled: req.body.chat,
					channels: {}
				},
				voice: {
					enabled: req.body.voice,
					groups: {},
					channels: []
				},
				queue: []
			}
		}
		db.set('servers', servers);
	}
})

app.get("/api", async (req, res) => {
	const type = req.header('mc-data-type');
	// Server Queue
	if (type === 'server-queue') {
		const serverUUID = req.header('server-uuid');
		if (servers[serverUUID]) {
			res.set('Content-Type', 'text/plain').json(servers[serverUUID].queue);
			// console.log(`Resetting Queue for server ${serverUUID}`)
			servers[serverUUID].queue = [];
			db.set('servers', servers);
		}
	}
})

app.listen(3000, () => {
	console.log(`Websever Started!`)
})

// Discord Integration
const { Client, IntentsBitField } = require("discord.js");
const client = new Client({ intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.GuildVoiceStates, IntentsBitField.Flags.MessageContent], allowedMentions: { parse: [] } });

// Commands
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');
const fs = require('fs');

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

const clientId = '1008548567671119952';

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	commands.push(command.data);
}

const rest = new REST({ version: '10' }).setToken(process.env.token);

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
		Object.keys(pending).forEach(connection => {
			if (code === pending[connection].code) {
				username = connection;
				users[connection] = {
					id: interaction.user.id,
					username: interaction.user.username,
					discriminator: interaction.user.discriminator
				};
				db.set('users', users);
				serverUUID = pending[connection].origin;
				delete pending[connection];
				db.set('pending', pending);
			}
		})
		if (username !== "") {
			servers[serverUUID].queue.push(
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

		if (servers[serverUUID].chat.enabled === false) {
			await interaction.reply({ content: `Chat integration is not enabled for this server!`, ephemeral: true });
		} else {
			if (Object.keys(servers[serverUUID].chat.channels).includes(channel) === false) {
				servers[serverUUID].chat.channels[channel] = allowChannelMessages;
				servers[serverUUID].queue.push(
					`tellraw @a {"rawtext":[{"text":"Server §9${interaction.guild.name}§r subscribed to chat feed in §9#${interaction.channel.name}§r, with §7allow channel messages§r set to §a${allowChannelMessages}§r."}]}`
				);
				db.set('servers', servers);
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
		if (!servers[serverUUID]) {
			await interaction.reply({ content: `Server \`${serverUUID}\` does not exist!`, ephemeral: true });
			return;
		}
		// If server voice is disabled
		if (servers[serverUUID].voice.enabled === false) {
			await interaction.reply({ content: `Voice is not enabled on server \`${serverUUID}\`.`, ephemeral: true });
			return;
		}
		// If server is already subscribed to voice
		if (servers[serverUUID].voice.channels.length === 1) {
			// If the subscribed voice channel is the same as the requested one
			if (servers[serverUUID].voice.channels.includes(channel.id)) {
				await interaction.reply({ content: `Channel ${channel} is already subscribed to server \`${serverUUID}\` proximity chat!`, ephemeral: true });
				return;
			}
			await interaction.reply({ content: `Server \`${serverUUID}\` already has a channel subscribed to proximity chat!`, ephemeral: true });
			return;
		}
		// Else eveything should be valid
		servers[serverUUID].voice.channels.push(channel.id);
		db.set('servers', servers);
		servers[serverUUID].queue.push(
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
			Object.keys(servers).forEach(serverUUID => {
				if (servers[serverUUID].chat.channels[channel] !== undefined) {
					delete servers[serverUUID].chat.channels[channel];
					found = true;
					servers[serverUUID].queue.push(
						`tellraw @a {"rawtext":[{"text":"Server §9${interaction.guild.name}§r unsubscribed §9#${interaction.channel.name}§r from chat feed."}]}`
					);
					interaction.reply({ content: `Unsubscribed channel ${client.channels.cache.get(channel)} from server \`${serverUUID}\` chat feed.`, ephemeral: true });
				}
			})
			if (found === false) {
				await interaction.reply({ content: `This channel isn't subscribed to any chat feeds!`, ephemeral: true });
				return;
			}
			db.set('servers', servers);
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
			Object.keys(servers).forEach(serverUUID => {
				// If server has the channel id
				if (servers[serverUUID].voice.channels.includes(channel.id)) {
					servers[serverUUID].voice.channels.splice(servers[serverUUID].voice.channels.indexOf(channel.id));
					servers[serverUUID].voice.groups = {};
					db.set('servers', servers);
					servers[serverUUID].queue.push(
						`tellraw @a {"rawtext":[{"text":"Server §9${interaction.guild.name}§r unsubscribed §9${channel.name}§r from proximity chat."}]}`
					);
					interaction.reply({ content: `Unsubscribed ${channel} from server \`${serverUUID}\` proximity chat.`, ephemeral: true });
					found = true;
				}
			})
			// If no server was found
			if (found === false) {
				await interaction.reply({ content: `${channel} isn't subscribed to any server's proximity chat!`, ephemeral: true });
			}
		}
	}

	// Delete
	if (interaction.commandName === 'delete') {
		const serverUUID = interaction.options.getString('server-uuid');
		if (servers[serverUUID]) {
			delete servers[serverUUID];
			db.set('servers', servers);
			await interaction.reply({ content: `Deleted server \`${serverUUID}\` from database.`, ephemeral: true });
		} else {
			await interaction.reply({ content: `Server \`${serverUUID}\` does not exist!`, ephemeral: true });
		}
	}
});

// Message from Discord to BDS
client.on("messageCreate", msg => {
	if (msg.author.id !== '1008548567671119952' && msg.content !== '') {
		Object.keys(servers).forEach(serverUUID => {
			if (servers[serverUUID].chat.enabled === true && servers[serverUUID].chat.channels[msg.channelId] === true) {
				// console.log(`Sending "<${msg.author.username}#${msg.author.discriminator}> ${msg.content}" to ${serverUUID}`);
				servers[serverUUID].queue.push(`tellraw @a {"rawtext":[{"text":"§9<${msg.author.username}#${msg.author.discriminator}>§r ${msg.content}"}]}`);
				db.set('servers', servers);
			}
		})
	}
})

client.on("ready", () => {
	// If replit isn't logging in to the bot, navigate to the shell and input "kill 1"
	console.log(`Logged in as ${client.user.tag}!`);
});
client.login(process.env.token).catch(console.error)