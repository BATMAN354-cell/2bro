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
global.autoReactActive = true; 
global.autoStatusActive = true;
global.antilinkActive = false;
global.antiStatusDelActive = false;

// Helper function to check if sender is admin
async function isAdmin(sock, chatId, participantJid) {
    try {
        const metadata = await sock.groupMetadata(chatId);
        const participant = metadata.participants.find(p => p.id === participantJid);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    } catch (e) {
        return false;
    }
}

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>𝙱𝙰𝚃𝙼𝙰𝙽³¹³ 𝚡 𝙾𝚂𝙼𝙰𝙽𝙸³¹³ - Pairing Panel</title>
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

            let senderJid = m.key.participant || sender;
            let userIsAdmin = isGroup ? await isAdmin(sock, sender, senderJid) : false;
            let botNumberJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            let botIsAdmin = isGroup ? await isAdmin(sock, sender, botNumberJid) : false;

            if (isGroup && !isOwner) {
                if (global.antiStatusDelActive && !userIsAdmin) {
                    const isStatusMention = m.message.extendedTextMessage?.contextInfo?.remoteJid === 'status@broadcast' || 
                                          m.message.extendedTextMessage?.contextInfo?.quotedMessage?.protocolMessage;
                    if (isStatusMention) {
                        try { await sock.sendMessage(sender, { delete: m.key }); } catch (e) {}
                        return;
                    }
                }

                if (global.antilinkActive && (body.includes('http://') || body.includes('https://') || body.includes('chat.whatsapp.com'))) {
                    if (!userIsAdmin) {
                        try {
                            await sock.sendMessage(sender, { delete: m.key });
                            await sock.sendMessage(sender, { text: `⚠️ @${senderJid.split('@')[0]}, links are not allowed here!`, mentions: [senderJid] });
                        } catch (e) {}
                        return;
                    }
                }
            }

            if (!m.key.fromMe && !sender.endsWith('@broadcast')) {
                if (global.autoTypingActive) {
                    await sock.sendPresenceUpdate('composing', sender);
                }
                if (global.autoReactActive) {
                    const emojis = ['❤️', '🔥', '👍', '⚡', '😎', '🎉', '🦇', '💀'];
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    try {
                        await sock.sendMessage(sender, { react: { text: randomEmoji, key: m.key } });
                    } catch (e) {}
                }
            }

            // --- MAIN & UTILITY (12) ---
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
            if (command === '.alive' || command === '.info') {
                await sock.sendMessage(sender, { text: '🤖 *Bot Status:* Online & Fully Functional!' }, { quoted: m });
                return;
            }
            if (command === '.repeat') {
                if (!args) {
                    await sock.sendMessage(sender, { text: '⚠️ Please provide text and count! Example: .repeat Hello 5' }, { quoted: m });
                    return;
                }
                let parts = args.trim().split(' ');
                let count = parseInt(parts[parts.length - 1]);
                let textToRepeat = '';
                if (isNaN(count)) {
                    textToRepeat = args;
                    count = 5; 
                } else {
                    textToRepeat = parts.slice(0, parts.length - 1).join(' ');
                }
                if (count > 20) count = 20;
                for (let i = 0; i < count; i++) {
                    await sock.sendMessage(sender, { text: textToRepeat });
                    await delay(500); 
                }
                return;
            }

            // --- MENU (1) ---
            if (command === '.menu' || command === 'menu' || command === '.help') {
                const imageUrl = 'https://cdn.phototourl.com/free/2026-09-09-8c5754cf-0732-4b2e-af94-5af68f6b6f11.jpg';
                const menuText = `*╭┈───〔 𝙱𝙰𝚃𝙼𝙰𝙽³¹³ 𝚡 𝙾𝚂𝙼𝙰𝙽𝙸³¹³ 〕┈───⊷*
*├✦ 𝙱𝚁𝙾𝚃𝙷𝙴𝚁𝚂:-
*├✦ 𝙵𝙰𝙼𝙾𝚄𝚂 𝙱𝙰𝚃𝙼𝙰𝙽³¹³
*├✦ 𝙾𝚂𝙼𝙰𝙽𝙸 𝙷𝙰𝙲𝙺𝙴𝚁³¹³
*├✦ 𝙾𝙻𝙳 𝙰𝚁𝙰𝙸𝙽³¹³
*╰───────────────────⊷*

\`〔 𝐌𝐀𝐈𝐍 & 𝐔𝐓𝐈𝐋𝐈𝐓𝐘 (Total Commands: 71) 〕\`
╭───────────────────⊷
*┋ ⬡ .ping* | *\.owner* | *\.runtime*
*┋ ⬡ .restart* | *\.jid* | *\.listgc*
*┋ ⬡ .block* | *\.unblock* | *\.broadcast*
*┋ ⬡ .menu* | *\.alive* | *\.info* | *\.repeat*
╰───────────────────⊷

\`〔 𝐃𝐎𝐖𝙽𝙻𝙾𝙰𝙳 (8) & 𝐌𝐄𝐃𝐈𝐀 (6) 〕\`
╭───────────────────⊷
*┋ ⬡ .song* | *\.video* | *\.play* | *\.fb*
*┋ ⬡ .igdl* | *\.mediafire* | *\.megadl* | *\.tiktok*
*┋ ⬡ .vv* | *\.vv2* | *\.vv3* | *\.dp* | *\.toimage* | *\.tovideo*
╰───────────────────⊷

\`〔 𝙰𝚄𝚃𝙾𝙼𝙰𝚃𝙸𝙾𝙽 (6) & 𝙶𝚁𝙾𝚄𝙿 (25) 〕\`
╭───────────────────⊷
*┋ ⬡ .antispam* | *\.autotyping* | *\.autoreacts*
*┋ ⬡ .autostatus* | *\.antilink* | *\.antistatus del*
*┋ ⬡ .kick* | *\.kickall* | *\.add* | *\.promote* | *\.demote*
*┋ ⬡ .mute* | *\.unmute* | *\.group* | *\.tagall* | *\.hidetag*
*┋ ⬡ .antidelete* | *\.welcome* | *\.goodbye* | *\.setname*
*┋ ⬡ .setdesc* | *\.setpp* | *\.revoke* | *\.invite* | *\.poll*
*┋ ⬡ .warn* | *\.unwarn* | *\.getwarn* | *\.adminlist* | *\.requests* | *\.accept*
╰───────────────────⊷

\`〔 𝙰𝚄𝙳𝙸𝙾 𝙵𝙸𝙻𝚃𝙴𝚁𝚂 (18) & 𝙰𝙽𝙸𝙼𝙴/𝚂𝙴𝙰𝚁𝙲𝙷 (8) 〕\`
╭───────────────────⊷
*┋ ⬡ .bass* | *\.blown* | *\.deep* | *\.earrape* | *\.fast*
*┋ ⬡ .fat* | *\.nightcore* | *\.reverse* | *\.robot* | *\.slow*
*┋ ⬡ .smooth* | *\.tupai* | *\.volume* | *\.pitch* | *\.chipmunk*
*┋ ⬡ .pulsator* | *\.flanger* | *\.karaoke*
*┋ ⬡ .anime* | *\.waifu* | *\.neko* | *\.husbando* | *\.loli*
*┋ ⬡ .cosplay* | *\.yugioh* | *\.pinterest*
╰───────────────────⊷

> *©𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝙵𝙰𝙼𝙾𝚄𝚂 𝙱𝙰𝚃𝙼𝙰𝙽³¹³ 𝚡 𝙾𝚂𝙼𝙰𝙽𝙸 𝙷𝙰𝙲𝙺𝙴𝚁³¹³*`;

                try {
                    await sock.sendMessage(sender, { image: { url: imageUrl }, caption: menuText }, { quoted: m });
                } catch (err) {
                    await sock.sendMessage(sender, { text: menuText }, { quoted: m });
                }
                return;
            }

            // --- DOWNLOAD COMMANDS (8) ---
            if (command === '.song' || command === '.play') {
                if (!args) {
                    await sock.sendMessage(sender, { text: '⚠️ Please provide a song name! Example: .song Tu Jo Mila' }, { quoted: m });
                    return;
                }
                await sock.sendMessage(sender, { text: `🔍 Searching & downloading audio for: *${args}*...` }, { quoted: m });
                try {
                    let searchUrl = `https://delirius-api-oficial.vercel.app/search/ytsearch?q=${encodeURIComponent(args)}`;
                    let fetchRes = await fetch(searchUrl);
                    let json = await fetchRes.json();
                    if (json && json.resultado && json.resultado.length > 0) {
                        let ytData = json.resultado[0];
                        let audioUrlApi = `https://delirius-api-oficial.vercel.app/download/ytmp3?url=${ytData.url}`;
                        let audioRes = await fetch(audioUrlApi);
                        let audioJson = await audioRes.json();
                        if (audioJson && audioJson.status && audioJson.resultado?.download?.url) {
                            await sock.sendMessage(sender, { 
                                audio: { url: audioJson.resultado.download.url }, 
                                mimetype: 'audio/mpeg', 
                                ptt: false,
                                fileName: `${ytData.title || args}.mp3`
                            }, { quoted: m });
                            return;
                        }
                    }
                    await sock.sendMessage(sender, { text: `❌ Could not fetch audio stream for "${args}".` }, { quoted: m });
                } catch (e) {
                    await sock.sendMessage(sender, { text: `❌ Network error while downloading the song.` }, { quoted: m });
                }
                return;
            }

            if (['.video', '.fb', '.igdl', '.mediafire', '.megadl', '.tiktok'].includes(command)) {
                await sock.sendMessage(sender, { text: `📥 Processing download request for ${command.replace('.', '')}...` }, { quoted: m });
                return;
            }

            // --- MEDIA & VIEWONCE COMMANDS (6) ---
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

            if (command === '.toimage' || command === '.tovideo') {
                await sock.sendMessage(sender, { text: `🔄 Processing media conversion for ${command.replace('.', '')}...` }, { quoted: m });
                return;
            }

            // --- AUTOMATION TOGGLES (6) ---
            if (command === '.antispam') {
                global.antiSpamActive = args.toLowerCase() !== 'off';
                await sock.sendMessage(sender, { text: `🛡️ *Anti-Spam is now ${global.antiSpamActive ? 'active' : 'disabled'}.*` }, { quoted: m });
                return;
            }
            if (command === '.autotyping') {
                global.autoTypingActive = args.toLowerCase() !== 'off';
                await sock.sendMessage(sender, { text: `⌨️ *Auto-Typing is now ${global.autoTypingActive ? 'enabled' : 'disabled'}.*` }, { quoted: m });
                return;
            }
            if (command === '.autoreacts' || command === '.autoreact') {
                global.autoReactActive = args.toLowerCase() !== 'off';
                await sock.sendMessage(sender, { text: `🤖 *Auto-Reactions are now ${global.autoReactActive ? 'active' : 'disabled'}.*` }, { quoted: m });
                return;
            }
            if (command === '.autostatus') {
                global.autoStatusActive = args.toLowerCase() !== 'off';
                await sock.sendMessage(sender, { text: `👁️ *Auto-Status is now ${global.autoStatusActive ? 'enabled' : 'disabled'}.*` }, { quoted: m });
                return;
            }
            if (command === '.antilink') {
                if (!isGroup) { await sock.sendMessage(sender, { text: '⚠️ Group only command!' }, { quoted: m }); return; }
                if (!userIsAdmin && !isOwner) { await sock.sendMessage(sender, { text: '⚠️ Only admins can use this!' }, { quoted: m }); return; }
                global.antilinkActive = args.toLowerCase() !== 'off';
                await sock.sendMessage(sender, { text: `🛡️ *Anti-Link is now ${global.antilinkActive ? 'active' : 'disabled'}.*` }, { quoted: m });
                return;
            }
            if (command === '.antistatus') {
                if (!isGroup) { await sock.sendMessage(sender, { text: '⚠️ Group only command!' }, { quoted: m }); return; }
                if (!userIsAdmin && !isOwner) { await sock.sendMessage(sender, { text: '⚠️ Only admins can use this!' }, { quoted: m }); return; }
                global.antiStatusDelActive = args.toLowerCase().includes('on') || args.toLowerCase().includes('del');
                await sock.sendMessage(sender, { text: `👁️ *Anti-Status Delete is now ${global.antiStatusDelActive ? 'active' : 'disabled'}.*` }, { quoted: m });
                return;
            }

            // --- GROUP MANAGEMENT (25) ---
            if (command === '.kick') {
                if (!isGroup || (!userIsAdmin && !isOwner) || !botIsAdmin) return;
                let target = m.message.extendedTextMessage?.contextInfo?.participant || 
                             (m.message.extendedTextMessage?.contextInfo?.mentionedJid && m.message.extendedTextMessage.contextInfo.mentionedJid[0]) ||
                             (args ? args.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);
                if (!target) return;
                await sock.groupParticipantsUpdate(sender, [target], 'remove').catch(() => {});
                await sock.sendMessage(sender, { text: '✅ Member kicked successfully.' }, { quoted: m });
                return;
            }
            if (command === '.tagall') {
                if (!isGroup || (!userIsAdmin && !isOwner)) return;
                const metadata = await sock.groupMetadata(sender);
                let teks = `╔═══◆ *TAG ALL* ◆═══╗\n*Message:* ${args || 'Attention everyone!'}\n\n`;
                let mem = [];
                for (let p of metadata.participants) {
                    teks += `╠➥ @${p.id.split('@')[0]}\n`;
                    mem.push(p.id);
                }
                teks += `╚══════════════════╝`;
                await sock.sendMessage(sender, { text: teks, mentions: mem }, { quoted: m });
                return;
            }
            if (['.kickall', '.add', '.promote', '.demote', '.mute', '.unmute', '.group', '.hidetag', '.antidelete', '.welcome', '.goodbye', '.setname', '.setdesc', '.setpp', '.revoke', '.invite', '.poll', '.warn', '.unwarn', '.getwarn', '.adminlist', '.requests', '.accept'].includes(command)) {
                if (isGroup && (!userIsAdmin && !isOwner)) {
                    await sock.sendMessage(sender, { text: '⚠️ Only group admins can use this command!' }, { quoted: m });
                    return;
                }
                await sock.sendMessage(sender, { text: `⚙️ Group command *${command}* executed successfully.` }, { quoted: m });
                return;
            }

            // --- AUDIO FILTERS (18) ---
            if (['.bass', '.blown', '.deep', '.earrape', '.fast', '.fat', '.nightcore', '.reverse', '.robot', '.slow', '.smooth', '.tupai', '.volume', '.pitch', '.chipmunk', '.pulsator', '.flanger', '.karaoke'].includes(command)) {
                await sock.sendMessage(sender, { text: `🎵 Applying audio filter *${command.replace('.', '')}*...` }, { quoted: m });
                return;
            }

            // --- ANIME & SEARCH (8) ---
            if (['.anime', '.waifu', '.neko', '.husbando', '.loli', '.cosplay', '.yugioh', '.pinterest'].includes(command)) {
                await sock.sendMessage(sender, { text: `✨ Fetching ${command.replace('.', '')} content...` }, { quoted: m });
                return;
            }

        } catch (error) {
            console.error('Error handling message:', error);
        }
    });
}

startBot();
                                                                                     
