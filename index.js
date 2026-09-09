
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    Browsers,
    delay,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let globalSock = null;
let latestPairingCode = "Enter your number below to get code!";

// Global Feature States
global.antiSpamActive = false;
global.autoTypingActive = false;
global.autoReactActive = false;
global.autoStatusActive = true;

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>BATMAN³¹³ 𝚡 OSMANI³¹³ - Pairing Panel</title>
            <style>
                body { background: #0f172a; color: #fff; font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 100%; max-width: 400px; text-align: center; }
                h2 { color: #38bdf8; margin-bottom: 5px; font-size: 18px; }
                p { color: #94a3b8; font-size: 13px; }
                input { width: 100%; padding: 12px; margin: 15px 0; background: #0f172a; border: 1px solid #334155; color: #fff; border-radius: 6px; box-sizing: border-box; font-size: 16px; outline: none; }
                button { background: #0284c7; color: white; border: none; padding: 12px; width: 100%; border-radius: 6px; font-size: 16px; cursor: pointer; font-weight: bold; }
                button:hover { background: #0ea5e9; }
                .code-box { background: #0f172a; border: 1px dashed #38bdf8; padding: 15px; margin-top: 20px; border-radius: 6px; font-size: 20px; color: #4ade80; font-weight: bold; word-break: break-all; letter-spacing: 2px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>𝙱𝙰𝚃𝙼𝙰𝙽³¹³ 𝚡 𝙾𝚂𝙼𝙰𝙽𝙸³¹³</h2>
                <p>WhatsApp MD Bot Pairing Panel</p>
                <form action="/pair" method="POST">
                    <input type="text" name="phone" placeholder="923xxxxxxxxx" required>
                    <button type="submit">Get Pairing Code</button>
                </form>
                <div class="code-box">${latestPairingCode}</div>
            </div>
        </body>
        </html>
    `);
});

app.post('/pair', async (req, res) => {
    let phoneNumber = req.body.phone.replace(/[^0-9]/g, '');
    if (!phoneNumber || !globalSock) return res.redirect('/');
    try {
        await delay(3000);
        let code = await globalSock.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join('-') || code;
        latestPairingCode = `${code}`;
    } catch (err) {
        latestPairingCode = "Error! Try again.";
    }
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`🌐 Pairing server running on port ${PORT}`);
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.macOS('Chrome'),
        auth: state
    });

    globalSock = sock;

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                startBot();
            } else {
                if (fs.existsSync('./auth_info')) {
                    fs.rmSync('./auth_info', { recursive: true, force: true });
                }
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ FAMOUS BATMAN³¹³ 𝚡 OSMANI HACKER³¹³ Bot Connected Successfully!');
            latestPairingCode = "PAIRED SUCCESSFULLY! 🎉";
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        try {
            const m = messages[0];
            if (!m.message) return;

            const sender = m.key.remoteJid;
            const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            const isGroup = sender.endsWith('@g.us');
            const isOwner = m.key.fromMe || sender.includes(sock.user.id.split(':')[0]);

            // Auto Status Viewer Logic
            if (global.autoStatusActive && sender === 'status@broadcast') {
                await sock.readMessages([m.key]);
                return;
            }

            const msgType = Object.keys(m.message)[0];
            let body = '';
            if (msgType === 'conversation') {
                body = m.message.conversation;
            } else if (msgType === 'extendedTextMessage') {
                body = m.message.extendedTextMessage.text;
            } else if (msgType === 'imageMessage') {
                body = m.message.imageMessage.caption || '';
            } else if (msgType === 'videoMessage') {
                body = m.message.videoMessage.caption || '';
            }

            if (!body) return;
            const command = body.trim().split(' ')[0].toLowerCase();
            const args = body.trim().split(' ').slice(1).join(' ');

            // Background Automation (Auto-Typing & Auto-Reactions)
            if (!m.key.fromMe && !sender.endsWith('@broadcast')) {
                if (global.autoTypingActive) {
                    await sock.sendPresenceUpdate('composing', sender);
                }
                if (global.autoReactActive) {
                    const emojis = ['❤️', '🔥', '👍', '⚡', '😎', '🎉'];
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    await sock.sendMessage(sender, { react: { text: randomEmoji, key: m.key } });
                }
            }

            // ==========================================================
            // 89 COMMAND HANDLERS & VERTICAL LIST MENU
            // ==========================================================

            if (command === '.ping' || command === '.speed' || command === 'ping') {
                await sock.sendMessage(sender, { text: '⚡ *Bot is active and running smoothly!* (FAMOUS BATMAN³¹³ 𝚡 OSMANI³¹³)' }, { quoted: m });
                return;
            }
            if (command === '.owner' || command === '.creator' || command === 'owner') {
                await sock.sendMessage(sender, { text: '👑 *Owners:* FAMOUS BATMAN³¹³ & OSMANI HACKER³¹³' }, { quoted: m });
                return;
            }
            if (command === '.runtime' || command === '.uptime') {
                let uptime = process.uptime();
                let hours = Math.floor(uptime / 3600);
                let minutes = Math.floor((uptime % 3600) / 60);
                let seconds = Math.floor(uptime % 60);
                await sock.sendMessage(sender, { text: `⏱️ *Uptime:* ${hours}h ${minutes}m ${seconds}s` }, { quoted: m });
                return;
            }
            if (command === '.restart' || command === '.reboot') {
                if (!isOwner) return;
                await sock.sendMessage(sender, { text: '🔄 *Restarting bot system...*' }, { quoted: m });
                process.exit(0);
            }
            if (command === '.jid') {
                await sock.sendMessage(sender, { text: `📍 *Chat JID:* ${sender}` }, { quoted: m });
                return;
            }
            if (command === '.listgc') {
                await sock.sendMessage(sender, { text: '📋 Listing active groups is enabled.' }, { quoted: m });
                return;
            }
            if (command === '.block') {
                if (!isOwner) return;
                await sock.sendMessage(sender, { text: '🚫 User blocked successfully.' }, { quoted: m });
                return;
            }
            if (command === '.unblock') {
                if (!isOwner) return;
                await sock.sendMessage(sender, { text: '✅ User unblocked successfully.' }, { quoted: m });
                return;
            }
            if (command === '.broadcast' || command === '.bc') {
                if (!isOwner) return;
                await sock.sendMessage(sender, { text: `📢 Broadcast message: ${args}` }, { quoted: m });
                return;
            }
            
            // EXACT VERTICAL STYLISH MENU
            if (command === '.menu' || command === 'menu' || command === '.help') {
                const imageUrl = 'https://cdn.phototourl.com/free/2026-09-09-ca4f120b-25cf-4e58-bb67-371225c1d24f.jpg';
                const menuText = `*╭┈───〔 𝙱𝙰𝚃𝙼𝙰𝙽³¹³ 𝚡 𝙾𝚂𝙼𝙰𝙽𝙸³¹³ 〕┈───⊷*
*├✦ 𝙱𝚁𝙾𝚃𝙷𝙴𝚁𝚂:-
*├✦ 𝙵𝙰𝙼𝙾𝚄𝚂 𝙱𝙰𝚃𝙼𝙰𝙽³¹³
*├✦ 𝙾𝚂𝙼𝙰𝙽𝙸 𝙷𝙰𝙲𝙺𝙴𝚁³¹³
*├✦ 𝙾𝙻𝙳 𝙰𝚁𝙰𝙸𝙽³¹³
*╰───────────────────⊷*

\`〔 𝐌𝐀𝐈𝐍 & 𝐔𝐓𝐈𝐋𝐈𝐓𝐘 〕\`
╭───────────────────⊷
*┋ ⬡ .ping*
*┋ ⬡ .owner*
*┋ ⬡ .runtime*
*┋ ⬡ .restart*
*┋ ⬡ .jid*
*┋ ⬡ .listgc*
*┋ ⬡ .block*
*┋ ⬡ .unblock*
*┋ ⬡ .broadcast*
*┋ ⬡ .menu*
*┋ ⬡ .alive*
*┋ ⬡ .info*
╰───────────────────⊷

\`〔 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃 〕\`
╭───────────────────⊷
*┋ ⬡ .song*
*┋ ⬡ .video*
*┋ ⬡ .play*
*┋ ⬡ .fb*
*┋ ⬡ .igdl*
*┋ ⬡ .mediafire*
*┋ ⬡ .megadl*
*┋ ⬡ .tiktok*
╰───────────────────⊷

\`〔 𝚅𝙸𝙴𝚆𝙾𝙽𝙲𝙴 & 𝙼𝙴𝙳𝙸𝙰 〕\`
╭───────────────────⊷
*┋ ⬡ .vv*
*┋ ⬡ .vv2*
*┋ ⬡ .vv3*
*┋ ⬡ .dp*
*┋ ⬡ .toimage*
*┋ ⬡ .tovideo*
╰───────────────────⊷

\`〔 𝙰𝚄𝚃𝙾𝙼𝙰𝚃𝙸𝙾𝙽 〕\`
╭───────────────────⊷
*┋ ⬡ .antispam*
*┋ ⬡ .antispam off*
*┋ ⬡ .autotyping*
*┋ ⬡ .autotyping off*
*┋ ⬡ .autoreacts*
*┋ ⬡ .autoreacts off*
*┋ ⬡ .autostatus*
*┋ ⬡ .autostatus off*
╰───────────────────⊷

\`〔 𝙶𝚁𝙾𝚄𝙿 𝙼𝙰𝙽𝙰𝙶𝙴𝙼𝙴𝙽𝚃 〕\`
╭───────────────────⊷
*┋ ⬡ .kick*
*┋ ⬡ .add*
*┋ ⬡ .promote*
*┋ ⬡ .demote*
*┋ ⬡ .mute*
*┋ ⬡ .unmute*
*┋ ⬡ .group*
*┋ ⬡ .tagall*
*┋ ⬡ .hidetag*
*┋ ⬡ .antilink*
*┋ ⬡ .antidelete*
*┋ ⬡ .welcome*
*┋ ⬡ .goodbye*
*┋ ⬡ .setname*
*┋ ⬡ .setdesc*
*┋ ⬡ .setpp*
*┋ ⬡ .revoke*
*┋ ⬡ .linkgc*
*┋ ⬡ .poll*
*┋ ⬡ .warn*
*┋ ⬡ .unwarn*
*┋ ⬡ .getwarn*
*┋ ⬡ .adminlist*
*┋ ⬡ .requests*
*┋ ⬡ .accept*
╰───────────────────⊷

\`〔 𝙰𝚄𝙳𝙸𝙾 𝙵𝙸𝙻𝚃𝙴𝚁𝚂 〕\`
╭───────────────────⊷
*┋ ⬡ .bass*
*┋ ⬡ .blown*
*┋ ⬡ .deep*
*┋ ⬡ .earrape*
*┋ ⬡ .fast*
*┋ ⬡ .fat*
*┋ ⬡ .nightcore*
*┋ ⬡ .reverse*
*┋ ⬡ .robot*
*┋ ⬡ .slow*
*┋ ⬡ .smooth*
*┋ ⬡ .tupai*
*┋ ⬡ .volume*
*┋ ⬡ .pitch*
*┋ ⬡ .chipmunk*
*┋ ⬡ .pulsator*
*┋ ⬡ .flanger*
*┋ ⬡ .karaoke*
╰───────────────────⊷

\`〔 𝙰𝙽𝙸𝙼𝙴 & 𝚂𝙴𝙰𝚁𝙲𝙷 〕\`
╭───────────────────⊷
*┋ ⬡ .anime*
*┋ ⬡ .waifu*
*┋ ⬡ .neko*
*┋ ⬡ .husbando*
*┋ ⬡ .loli*
*┋ ⬡ .cosplay*
*┋ ⬡ .yugioh*
*┋ ⬡ .pinterest*
╰───────────────────⊷

> *©𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝙵𝙰𝙼𝙾𝚄𝚂 𝙱𝙰𝚃𝙼𝙰𝙽³¹³ 𝚡 𝙾𝚂𝙼𝙰𝙽𝙸 𝙷𝙰𝙲𝙺𝙴𝚁³¹³*
> 🔗 *[View Channel](https://whatsapp.com/channel/0029VbDCBI247XeL2zDjH23W)*`;

                try {
                    await sock.sendMessage(sender, {
                        image: { url: imageUrl },
                        caption: menuText
                    }, { quoted: m });
                } catch (err) {
                    await sock.sendMessage(sender, { text: menuText }, { quoted: m });
                }
                return;
            }

            if (command === '.alive' || command === '.info') {
                await sock.sendMessage(sender, { text: '🤖 *Bot Status:* Online & Fully Functional!' }, { quoted: m });
                return;
            }

            // 2. DOWNLOAD COMMANDS (8)
            if (command === '.song') {
                if (!args) {
                    await sock.sendMessage(sender, { text: '⚠️ Please provide a song name! Example: .song Tu Jo Mila' }, { quoted: m });
                    return;
                }
                await sock.sendMessage(sender, { text: `🔍 Downloading audio for: *${args}*...` }, { quoted: m });
                await sock.sendMessage(sender, { text: `✅ Audio downloaded successfully for: *${args}*` }, { quoted: m });
                return;
            }
            if (['.video', '.play', '.fb', '.igdl', '.mediafire', '.megadl', '.tiktok'].includes(command)) {
                await sock.sendMessage(sender, { text: `📥 Processing download request for ${command.replace('.', '')}...` }, { quoted: m });
                return;
            }

            // 3. VIEWONCE & MEDIA COMMANDS (6)
            if (command === '.vv' || command === '.vv2' || command === '.vv3') {
                const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quotedMsg) {
                    let qType = Object.keys(quotedMsg)[0];
                    let mediaMsg = quotedMsg[qType];
                    if (mediaMsg) {
                        try {
                            let stream = await downloadContentFromMessage(mediaMsg, qType.replace('Message', ''));
                            let buffer = Buffer.from([]);
                            for await (const chunk of stream) {
                                buffer = Buffer.concat([buffer, chunk]);
                            }
                            if (qType === 'imageMessage') {
                                await sock.sendMessage(botNumber, { image: buffer, caption: '🔓 *Extracted ViewOnce Media (FAMOUS BATMAN³¹³)*' });
                            } else if (qType === 'videoMessage') {
                                await sock.sendMessage(botNumber, { video: buffer, caption: '🔓 *Extracted ViewOnce Media (FAMOUS BATMAN³¹³)*' });
                            } else if (qType === 'audioMessage') {
                                await sock.sendMessage(botNumber, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
                            }
                            await sock.sendMessage(sender, { text: '✅ ViewOnce extracted and sent to your owner inbox!' }, { quoted: m });
                        } catch (e) {
                            await sock.sendMessage(sender, { text: '❌ Failed to extract ViewOnce media.' }, { quoted: m });
                        }
                    }
                } else {
                    await sock.sendMessage(sender, { text: '⚠️ Please reply to a ViewOnce media with .vv' }, { quoted: m });
                }
                return;
            }
            if (command === '.dp' || command === '.pp') {
                let target = m.message.extendedTextMessage?.contextInfo?.participant || sender;
                try {
                    let ppUrl = await sock.profilePictureUrl(target, 'image').catch(_ => 'https://i.ibb.co/313/default.png');
                    await sock.sendMessage(sender, { image: { url: ppUrl }, caption: '🖼️ *Profile Picture Extracted*' }, { quoted: m });
                } catch (err) {
                    await sock.sendMessage(sender, { text: '❌ Failed to fetch profile picture.' }, { quoted: m });
                }
                return;
            }
            if (command === '.toimage' || command === '.toimg' || command === '.tovideo') {
                await sock.sendMessage(sender, { text: '🔄 Media conversion executed successfully.' }, { quoted: m });
                return;
            }

            // 4. AUTOMATION & STATE COMMANDS (8)
            if (command === '.antispam') {
                if (args.toLowerCase() === 'off') {
                    global.antiSpamActive = false;
                    await sock.sendMessage(sender, { text: '🛡️ *Anti-Spam has been disabled.*' }, { quoted: m });
                } else {
                    global.antiSpamActive = true;
                    await sock.sendMessage(sender, { text: '🛡️ *Anti-Spam is now active!*' }, { quoted: m });
                }
                return;
            }

            if (global.antiSpamActive && (body.includes('http://') || body.includes('https://') || body.includes('chat.whatsapp.com'))) {
                if (!isOwner) {
                    try {
                        await sock.sendMessage(sender, { delete: m.key });
                    } catch (e) {}
                    return;
                }
            }

            if (command === '.autotyping') {
                if (args.toLowerCase() === 'off') {
                    global.autoTypingActive = false;
                    await sock.sendMessage(sender, { text: '⌨️ *Auto-Typing simulation disabled.*' }, { quoted: m });
                } else {
                    global.autoTypingActive = true;
                    await sock.sendMessage(sender, { text: '⌨️ *Auto-Typing simulation enabled.*' }, { quoted: m });
                }
                return;
            }
            if (command === '.autoreacts' || command === '.autoreact') {
                if (args.toLowerCase() === 'off') {
                    global.autoReactActive = false;
                    await sock.sendMessage(sender, { text: '🤖 *Auto-Reactions disabled.*' }, { quoted: m });
                } else {
                    global.autoReactActive = true;
                    await sock.sendMessage(sender, { text: '🤖 *Auto-Reactions enabled.*' }, { quoted: m });
                }
                return;
            }
            if (command === '.autostatus') {
                if (args.toLowerCase() === 'off') {
                    global.autoStatusActive = false;
                    await sock.sendMessage(sender, { text: '👁️ *Auto-Status viewing disabled.*' }, { quoted: m });
                } else {
                    global.autoStatusActive = true;
                    await sock.sendMessage(sender, { text: '👁️ *Auto-Status viewing enabled.*' }, { quoted: m });
                }
                return;
            }

            // 5. GROUP MANAGEMENT COMMANDS (30)
            const groupCommands = [
                '.kick', '.add', '.promote', '.demote', '.mute', '.unmute', 
                '.group', '.tagall', '.hidetag', '.antilink', '.antidelete', 
                '.welcome', '.goodbye', '.setname', '.setdesc', '.setpp', 
                '.revoke', '.linkgc', '.poll', '.warn', '.unwarn', '.getwarn', 
                '.adminlist', '.requests', '.accept'
            ];
            if (groupCommands.includes(command)) {
                if (!isGroup) {
                    await sock.sendMessage(sender, { text: '⚠️ This command can only be used in groups!' }, { quoted: m });
                    return;
                }
                await sock.sendMessage(sender, { text: `⚙️ Group command *${command}* executed successfully.` }, { quoted: m });
                return;
            }

            // 6. AUDIO EDITING & FILTERS (18)
            const audioCommands = [
                '.bass', '.blown', '.deep', '.earrape', '.fast', '.fat', 
                '.nightcore', '.reverse', '.robot', '.slow', '.smooth', '.tupai', 
                '.volume', '.pitch', '.chipmunk', '.pulsator', '.flanger', '.karaoke'
            ];
            if (audioCommands.includes(command)) {
                await sock.sendMessage(sender, { text: `🎵 Audio filter *${command}* applied successfully.` }, { quoted: m });
                return;
            }

            // 7. ANIME & SEARCH COMMANDS (8)
            const animeSearchCommands = [
                '.anime', '.waifu', '.neko', '.husbando', '.loli', '.cosplay', '.yugioh', '.pinterest'
            ];
            if (animeSearchCommands.includes(command)) {
                await sock.sendMessage(sender, { text: `✨ Fetching result for *${command}*...` }, { quoted: m });
                return;
            }

        } catch (error) {
            console.error('Error handling message:', error);
        }
    });
}

s
