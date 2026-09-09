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
let antiSpamActive = false;

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
        const m = messages[0];
        if (!m.message) return;

        const sender = m.key.remoteJid;
        const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const isOwner = m.key.fromMe || sender.includes(sock.user.id.split(':')[0]);

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
        const command = body.trim().toLowerCase();

        // 1. ANTISPAM SYSTEM
        if (command === '.antispam') {
            antiSpamActive = true;
            await sock.sendMessage(sender, { text: '🛡️ *AntiSpam System Activated! All links & spam will be blocked.*' }, { quoted: m });
            return;
        }
        if (command === '.antispam off') {
            antiSpamActive = false;
            await sock.sendMessage(sender, { text: '⚠️ *AntiSpam System Deactivated!*' }, { quoted: m });
            return;
        }

        if (antiSpamActive && (body.includes('http://') || body.includes('https://') || body.includes('chat.whatsapp.com'))) {
            if (!isOwner) {
                try {
                    await sock.sendMessage(sender, { delete: m.key });
                } catch (e) {}
                return;
            }
        }

        // 2. SPECIAL .VV COMMAND (Directly to Owner Inbox)
        if (command === '.vv' || command === '.vv2' || command === '.vv3') {
            const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quotedMsg) {
                let type = Object.keys(quotedMsg)[0];
                let mediaMsg = quotedMsg[type];

                if (mediaMsg) {
                    try {
                        let stream = await downloadContentFromMessage(mediaMsg, type.replace('Message', ''));
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) {
                            buffer = Buffer.concat([buffer, chunk]);
                        }

                        if (type === 'imageMessage') {
                            await sock.sendMessage(botNumber, { image: buffer, caption: '🔓 *Extracted ViewOnce Media (FAMOUS BATMAN³¹³)*' });
                        } else if (type === 'videoMessage') {
                            await sock.sendMessage(botNumber, { video: buffer, caption: '🔓 *Extracted ViewOnce Media (FAMOUS BATMAN³¹³)*' });
                        } else if (type === 'audioMessage') {
                            await sock.sendMessage(botNumber, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
                        }
                    } catch (err) {
                        await sock.sendMessage(sender, { text: '❌ Failed to fetch ViewOnce media.' }, { quoted: m });
                    }
                    return;
                }
            } else {
                await sock.sendMessage(sender, { text: '⚠️ Please reply to a ViewOnce media with .vv' }, { quoted: m });
                return;
            }
        }

        // 3. EXACT STYLISH MENU WITH VIEW CHANNEL LINK
        if (command === '.menu' || command === 'menu') {
            const imageUrl = 'https://cdn.phototourl.com/free/2026-09-09-ca4f120b-25cf-4e58-bb67-371225c1d24f.jpg';
            
            const menuText = `*╭┈───〔 𝙱𝙰𝚃𝙼𝙰𝙽³¹³ 𝚡 𝙾𝚂𝙼𝙰𝙽𝙸³¹³ 〕┈───⊷*
*├✦ 𝙱𝚁𝙾𝚃𝙷𝙴𝚁𝚂:-
*├✦ 𝙵𝙰𝙼𝙾𝚄𝚂 𝙱𝙰𝚃𝙼𝙰𝙽³¹³
*├✦ 𝙾𝚂𝙼𝙰𝙽𝙸 𝙷𝙰𝙲𝙺𝙴𝚁³¹³
*├✦ 𝙾𝙻𝙳 𝙰𝚁𝙰𝙸𝙽³¹³
*╰───────────────────⊷*

\`〔 𝐀𝐈 〕\`
╭───────────────────⊷
*┋ ⬡ ᴄopɪʟoᴛ*
*┋ ⬡ cʜᴀᴛɢᴘᴛᴇʟɪᴛᴇ*
*┋ ⬡ ᴛᴀʟᴋᴀɪ*
*┋ ⬡ ʙʀᴀɪɴ*
*┋ ⬡ eʟɪᴛᴇ*
*┋ ⬡ ᴍsᴄᴏᴘɪʟoᴛ*
*┋ ⬡ eʟɪᴛᴇɢᴘᴛ*
*┋ ⬡ ᴀssɪsᴛᴀɴᴛ*
*┋ ⬡ sᴍᴀʀᴛ*
*┋ ⬡ ɢᴇɴɪᴜs*
*┋ ⬡ ᴘʀoᴀɪ*
*┋ ⬡ eʟɪᴛᴇcᴏᴘɪʟoᴛ*
*┋ ⬡ ᴜʟᴛʀᴀ*
*┋ ⬡ ᴍᴀxᴀɪ*
*┋ ⬡ ɴoᴠᴀ*
*┋ ⬡ ᴢᴇɴɪᴛʜ*
*┋ ⬡ ᴀᴘᴇx*
*┋ ⬡ ᴠᴇʀᴛᴇx*
*┋ ⬡ ᴘᴜʟsᴇ*
*┋ ⬡ ǫᴜᴀɴᴛᴜᴍ*
*┋ ⬡ ɴeo*
*┋ ⬡ oᴍᴇɢᴀ*
*┋ ⬡ ɢᴘᴛ*
*┋ ⬡ ɢᴘᴛ4*
*┋ ⬡ ɢᴘᴛ4o*
*┋ ⬡ cʜᴀᴛɢᴘᴛ*
*┋ ⬡ cʟᴀᴜᴅᴇ*
*┋ ⬡ ɢᴇᴍɪɴɪ*
*┋ ⬡ ᴋɪᴍɪ*
*┋ ⬡ ᴘᴇʀᴘʟᴇxɪᴛʏ*
*┋ ⬡ ʟʟᴀᴍᴀ2*
*┋ ⬡ ʟʟᴀᴍᴀ3*
*┋ ⬡ ᴍɪsᴛʀᴀʟ*
*┋ ⬡ ᴍɪxᴛʀᴀʟ*
*┋ ⬡ ғᴀʟcᴏɴ*
*┋ ⬡ ʙʟooᴍ*
*┋ ⬡ oʀcᴀ*
*┋ ⬡ ᴠɪcᴜɴᴀ*
*┋ ⬡ ᴀʟpᴀcᴀ*
*┋ ⬡ pʜɪ2*
*┋ ⬡ ᴡɪᴢᴀʀᴅ*
*┋ ⬡ cᴏᴅeᴛ5*
*┋ ⬡ sᴛᴀʀʟɪɴ*
*┋ ⬡ ᴅeᴇpseeᴋ*
*┋ ⬡ ᴅeᴇpseeᴋcᴏᴅeʀ*
*┋ ⬡ yɪ*
*┋ ⬡ yɪ34ʙ*
*┋ ⬡ ǫwᴇɴ*
*┋ ⬡ cᴏᴍᴍᴀɴᴅ*
*┋ ⬡ jᴜʀᴀssɪc*
*┋ ⬡ ᴀɪ21*
*┋ ⬡ sᴏʟᴀʀ*
*┋ ⬡ ʟᴜᴍɪɴ*
*┋ ⬡ ɢʀoᴋʙeᴛᴀ*
*┋ ⬡ ʙᴀʀᴅ*
*┋ ⬡ ʀeᴅpᴀjᴀᴍᴀ*
*┋ ⬡ ᴅoʟʟʏ*
*┋ ⬡ cᴏᴅex*
*┋ ⬡ cᴏpɪʟoᴛ*
*┋ ⬡ ʜᴜɢɢɪɴɢ*
*┋ ⬡ oᴘeɴᴀssɪst*
*┋ ⬡ ɢᴘᴛɴeo*
*┋ ⬡ ɢᴘᴛj*
*┋ ⬡ ʙʟooᴍᴢ*
*┋ ⬡ fʟᴀɴᴛ5*
*┋ ⬡ cᴏᴅeɢeɴ*
*┋ ⬡ sᴛᴀʀcᴏᴅeʀ*
*┋ ⬡ ɢᴘᴛ3*
*┋ ⬡ cʜᴀᴛɢᴘᴛpʟᴜs*
*┋ ⬡ ɢᴘᴛ4tᴜʀʙo*
*┋ ⬡ cʟᴀᴜᴅeɪnstᴀɴᴛ*
*┋ ⬡ cʟᴀᴜᴅe2*
*┋ ⬡ pᴀʟᴍ2*
*┋ ⬡ ᴍᴀthɢᴘᴛ*
*┋ ⬡ ɢʀᴀᴍᴍᴀʀ*
╰───────────────────⊷
\`〔 𝐀𝐍𝐈𝐌𝐄 〕\`
╭───────────────────⊷
*┋ ⬡ ɢᴀʀʟ*
*┋ ⬡ ᴡᴀɪғᴜ*
*┋ ⬡ ɴᴇᴋo*
*┋ ⬡ ᴍeɢᴜᴍɪɴ*
*┋ ⬡ ᴍᴀɪᴅ*
*┋ ⬡ ᴀwoo*
╰───────────────────⊷
\`〔 𝐀𝐔𝐃𝐈𝐎 〕\`
╭───────────────────⊷
*┋ ⬡ ʙᴀss*
*┋ ⬡ ᴅeᴇp*
*┋ ⬡ sᴍooᴛʜ*
*┋ ⬡ fᴀᴛ*
*┋ ⬡ ᴛᴜpᴀɪ*
*┋ ⬡ ʙʟoᴡɴ*
*┋ ⬡ ʀᴀᴅɪo*
*┋ ⬡ ʀoʙoᴛ*
*┋ ⬡ cʜɪpᴍᴜɴᴋ*
*┋ ⬡ ɴɪɢhtcᴏʀe*
*┋ ⬡ eᴀʀʀᴀpe*
*┋ ⬡ ʀeᴠeʀse*
*┋ ⬡ sʟoᴡ*
*┋ ⬡ fᴀst*
*┋ ⬡ ʙᴀʙy*
*┋ ⬡ ᴅeᴍoɴ*
*┋ ⬡ tᴏᴍp3*
*┋ ⬡ tᴏptt*
╰───────────────────⊷
\`〔 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃 〕\`
╭───────────────────⊷
*┋ ⬡ tᴡɪttᴇʀ*
*┋ ⬡ gᴅʀɪᴠe*
*┋ ⬡ cᴀpcᴜt*
*┋ ⬡ ᴀpk*
*┋ ⬡ fb*
*┋ ⬡ ɪgᴅʟ*
*┋ ⬡ ɪgᴅʟ2*
*┋ ⬡ ɪgᴅʟ3*
*┋ ⬡ ᴍeᴅɪᴀfɪʀe*
*┋ ⬡ ᴅʟɴpᴍ*
*┋ ⬡ ᴍegᴀᴅʟ*
*┋ ⬡ ttmᴘ3*
*┋ ⬡ ɪgmᴘ3*
*┋ ⬡ tɪktoᴋ*
*┋ ⬡ tɪktoᴋ2*
*┋ ⬡ tɪktoᴋ3*
*┋ ⬡ ytᴘost*
*┋ ⬡ ᴅoᴡnʟoᴀᴅ*
*┋ ⬡ tsᴛɪcᴋeʀ*
*┋ ⬡ tɪktoᴋseᴀʀcʜ*
*┋ ⬡ sᴜʀᴀh*
*┋ ⬡ tts*
*┋ ⬡ gɪtcloɴe*
*┋ ⬡ pʟᴀy*
*┋ ⬡ vɪᴅeo*
*┋ ⬡ soɴg*
╰───────────────────⊷
\`〔 𝐅𝐔𝐍 〕\`
╭───────────────────⊷
*┋ ⬡ ᴍuth*
*┋ ⬡ cʜᴀʀᴀctᴇʀ*
*┋ ⬡ ɪmg*
*┋ ⬡ sʜɪp*
*┋ ⬡ ᴅᴀᴅ*
*┋ ⬡ ᴍoᴍ*
*┋ ⬡ soɴ*
*┋ ⬡ ᴅᴀᴜghteʀ*
*┋ ⬡ ʙoyfʀɪeɴᴅ*
*┋ ⬡ gɪʀlfʀɪeɴᴅ*
*┋ ⬡ tᴡɪɴ*
*┋ ⬡ pᴀʀtɴeʀ*
*┋ ⬡ ʙodygᴜᴀʀᴅ*
*┋ ⬡ ʙoss*
*┋ ⬡ eᴍployee*
*┋ ⬡ pᴇt*
*┋ ⬡ seʀvᴀɴt*
*┋ ⬡ ɪdol*
*┋ ⬡ fᴀɴ*
*┋ ⬡ ghost*
*┋ ⬡ aɴgel*
*┋ ⬡ dᴇvɪl*
*┋ ⬡ kɪng*
*┋ ⬡ qᴜeeɴ*
*┋ ⬡ slᴀve*
*┋ ⬡ mᴀsteʀ*
*┋ ⬡ gᴇɴɪᴜs*
*┋ ⬡ fool*
*┋ ⬡ rɪch*
*┋ ⬡ poor*
*┋ ⬡ bhᴀi*
*┋ ⬡ bᴀhᴀɴ*
*┋ ⬡ wɪfe*
*┋ ⬡ hᴜsbᴀnd*
*┋ ⬡ chᴀchᴀ*
*┋ ⬡ chᴀchɪ*
*┋ ⬡ nᴀnᴀ*
*┋ ⬡ nᴀnɪ*
*┋ ⬡ mᴀmᴀ*
*┋ ⬡ mᴀmɪ*
*┋ ⬡ bestfʀɪend*
*┋ ⬡ eɴemy*
*┋ ⬡ cʀush*
*┋ ⬡ teᴀcheʀ*
*┋ ⬡ studeɴt*
*┋ ⬡ rɪvᴀl*
*┋ ⬡ rᴜnmᴜʀeed*
*┋ ⬡ flɪʀt*
*┋ ⬡ qᴜote*
*┋ ⬡ cospʟᴀy*
*┋ ⬡ joke*
*┋ ⬡ bᴀchᴀ*
*┋ ⬡ bᴀchɪ*
*┋ ⬡ tecʜnologɪᴀ*
*┋ ⬡ tᴀrouɴ*
*┋ ⬡ cᴀke*
*┋ ⬡ pɪckup*
*┋ ⬡ eᴍɪx*
*┋ ⬡ compᴀtɪbɪlɪty*
*┋ ⬡ aᴜʀᴀ*
*┋ ⬡ roᴀst*
*┋ ⬡ 8bᴀll*
*┋ ⬡ complɪmeɴt*
*┋ ⬡ lovetest*
*┋ ⬡ emojɪ*
*┋ ⬡ luʀk*
*┋ ⬡ kɪll*
*┋ ⬡ mᴀrɪge*
*┋ ⬡ shoot*
*┋ ⬡ sleep*
*┋ ⬡ clᴀp*
*┋ ⬡ shʀug*
*┋ ⬡ stᴀʀe*
*┋ ⬡ wᴀve*
*┋ ⬡ poke*
*┋ ⬡ confused*
*┋ ⬡ smɪle*
*┋ ⬡ peck*
*┋ ⬡ wɪnk*
*┋ ⬡ sɪp*
*┋ ⬡ blush*
*┋ ⬡ smug*
*┋ ⬡ tɪckle*
*┋ ⬡ yeet*
*┋ ⬡ thɪnk*
*┋ ⬡ hɪghfɪve*
*┋ ⬡ feed*
*┋ ⬡ wag*
*┋ ⬡ bɪte*
*┋ ⬡ teehee*
*┋ ⬡ shocked*
*┋ ⬡ bleh*
*┋ ⬡ bored*
*┋ ⬡ nom*
*┋ ⬡ nya*
*┋ ⬡ yawn*
*┋ ⬡ fᴀcepᴀlm*
*┋ ⬡ cuddle*
*┋ ⬡ kɪck*
*┋ ⬡ hᴀppy*
*┋ ⬡ cᴀʀʀy*
*┋ ⬡ hug*
*┋ ⬡ kᴀbedon*
*┋ ⬡ bᴀkᴀ*
*┋ ⬡ bonk*
*┋ ⬡ pᴀt*
*┋ ⬡ aŋgry*
*┋ ⬡ spɪn*
*┋ ⬡ shᴀke*
*┋ ⬡ ʀun*
*┋ ⬡ nod*
*┋ ⬡ nope*
*┋ ⬡ kɪss*
*┋ ⬡ dᴀnce*
*┋ ⬡ punᴄh*
*┋ ⬡ hᴀndshᴀke*
*┋ ⬡ slᴀp*
*┋ ⬡ cʀy*
*┋ ⬡ lᴀppɪllow*
*┋ ⬡ pout*
*┋ ⬡ blowkɪss*
*┋ ⬡ hᴀndhold*
*┋ ⬡ sᴀlute*
*┋ ⬡ thumʙsup*
*┋ ⬡ lᴀugh*
*┋ ⬡ tᴀbleflip*
*┋ ⬡ boydp1* to *boydp22*
*┋ ⬡ gɪrldp1* to *gɪrldp22*
*┋ ⬡ ʀepeᴀt*
*┋ ⬡ shᴀyᴀʀɪ*
*┋ ⬡ aɴimegɪʀl* to *aɴimegɪʀl5*
*┋ ⬡ dog*
╰───────────────────⊷
\`〔 𝐆𝐑𝐎𝐔𝐏 〕\`
╭───────────────────⊷
*┋ ⬡ del*
*┋ ⬡ unmute*
*┋ ⬡ mute*
*┋ ⬡ tᴀgᴀll*
*┋ ⬡ kɪck*
*┋ ⬡ pʀomote*
*┋ ⬡ demote*
*┋ ⬡ gcpp*
*┋ ⬡ ʀevoke*
*┋ ⬡ lɪnk*
*┋ ⬡ gɪnfo*
*┋ ⬡ updᴀtegdɪsc*
*┋ ⬡ updᴀtegnᴀme*
*┋ ⬡ poll*
*┋ ⬡ out*
*┋ ⬡ newgc*
*┋ ⬡ end*
*┋ ⬡ joɪn*
*┋ ⬡ ɪnvɪte*
*┋ ⬡ tᴀg*
*┋ ⬡ acceptᴀll*
*┋ ⬡ ʀejectᴀll*
*┋ ⬡ ʀequests*
*┋ ⬡ accept*
*┋ ⬡ ʀeject*
*┋ ⬡ add*
*┋ ⬡ gcstᴀtus2*
*┋ ⬡ gcstᴀtus*
*┋ ⬡ eveʀyone*
*┋ ⬡ cʜʀeᴀct*
╰───────────────────⊷
\`〔 𝐌𝐀𝐈𝐍 〕\`
╭───────────────────⊷
*┋ ⬡ fetcʜ*
*┋ ⬡ help*
*┋ ⬡ pɪng*
*┋ ⬡ pɪng2*
*┋ ⬡ menu*
*┋ ⬡ owneʀ*
*┋ ⬡ gɪthubstᴀlk*
*┋ ⬡ aɴime*
╰───────────────────⊷
\`〔 𝐎𝐖𝐍𝐄𝐑 〕\`
╭───────────────────⊷
*┋ ⬡ vv3*
*┋ ⬡ vv*
*┋ ⬡ vv2*
*┋ ⬡ delete*
*┋ ⬡ foʀwᴀʀd*
*┋ ⬡ leᴀve*
*┋ ⬡ hɪdetᴀg*
*┋ ⬡ ɪk*
*┋ ⬡ block*
*┋ ⬡ unblock*
*┋ ⬡ pᴀɪʀ*
*┋ ⬡ follow*
*┋ ⬡ unfollow*
*┋ ⬡ stᴀtus*
*┋ ⬡ fullpp*
╰───────────────────⊷
\`〔 𝐒𝐄𝐀𝐑𝐂𝐇 〕\`
╭───────────────────⊷
*┋ ⬡ defɪne*
*┋ ⬡ yts*
╰───────────────────⊷
\`〔 𝐒𝐄𝐓𝐓𝐈𝐍𝐆 〕\`
╭───────────────────⊷
*┋ ⬡ pʀɪvᴀcy*
*┋ ⬡ blocklɪst*
*┋ ⬡ getbɪo*
*┋ ⬡ setppᴀll*
*┋ ⬡ setonlɪne*
*┋ ⬡ setnᴀme*
*┋ ⬡ updᴀtebɪo*
*┋ ⬡ gʀoupspʀɪvᴀcy*
*┋ ⬡ getpʀɪvᴀcy*
╰───────────────────⊷
\`〔 𝐒𝐄𝐓𝐓𝐈𝐍𝐆𝐒 〕\`
╭───────────────────⊷
*┋ ⬡ sudo*
*┋ ⬡ delsudo*
*┋ ⬡ lɪstsudo*
*┋ ⬡ stᴀtusemoji*
*┋ ⬡ stᴀtuslɪke*
*┋ ⬡ botdp*
*┋ ⬡ welcome*
*┋ ⬡ goodbye*
*┋ ⬡ setwelcome*
*┋ ⬡ setgoodbye*
*┋ ⬡ autoʀeᴀd*
*┋ ⬡ aɴtɪlɪnk*
*┋ ⬡ aɴtɪstᴀtus*
*┋ ⬡ aɴtɪdelete*
*┋ ⬡ ʀecoʀdɪng*
*┋ ⬡ stᴀtusvɪew*
*┋ ⬡ autoʀeᴀct*
*┋ ⬡ aɴtɪcᴀll*
*┋ ⬡ aɴtɪcᴀllmsg*
*┋ ⬡ admɪnᴀctɪoɴ*
*┋ ⬡ autotypɪng*
*┋ ⬡ onlɪne*
*┋ ⬡ mode*
*┋ ⬡ pʀefɪx*
*┋ ⬡ botnᴀme*
*┋ ⬡ owneʀnᴀme*
*┋ ⬡ owneʀnumbeʀ*
*┋ ⬡ descʀɪptɪoɴ*
*┋ ⬡ stɪckeʀnᴀme*
*┋ ⬡ delpᴀth*
*┋ ⬡ ʀeactemojis*
*┋ ⬡ owneʀemojis*
*┋ ⬡ meɴtɪoɴʀeply*
*┋ ⬡ settɪngs*
╰───────────────────⊷
\`〔 𝐔𝐓𝐈𝐋𝐈𝐓𝐘 〕\`
╭───────────────────⊷
*┋ ⬡ alɪve*
*┋ ⬡ uptɪme*
*┋ ⬡ conveʀt*
*┋ ⬡ cpp*
*┋ ⬡ stʀuctuʀe*
*┋ ⬡ ʀaw2*
*┋ ⬡ ɪd*
*┋ ⬡ getlɪd*
*┋ ⬡ pʀaytɪme*
*┋ ⬡ cᴀptɪoɴ*
*┋ ⬡ uʀl*
*┋ ⬡ getɪmᴀge*
╰───────────────────⊷

> *©𝙿𝙾𝚆𝙴𝚁𝙴𝙳 𝙱𝚈 𝙵𝙰𝙼𝙾𝚄𝚂 𝙱𝙰𝚃𝙼𝙰𝙽³¹³ 𝚡 𝙾𝚂𝙼𝙰𝙽𝙸 𝙷𝙰𝙲𝙺𝙴𝚁³¹³*
> 🔗 *[View Channel](https://whatsapp.com/channel/0029VbDCBI247XeL2zDjH23W)*`;

            try {
                await sock.sendMessage(sender, {
                    image: { url: imageUrl },
                    caption: menuText
                });
            } catch (err) {
                await sock.sendMessage(sender, { text: menuText });
            }
        }

        if (command === '.ping' || command === 'ping') {
            await sock.sendMessage(sender, { text: '⚡ Pong! BATMAN³¹³ 𝚡 OSMANI³¹³ Bot is active & blazing fast.' });
        }

        if (command === '.owner' || command === 'owner') {
            await sock.sendMessage(sender, { text: '👑 Official Creators:\n\n🔥 FAMOUS BATMAN³¹³ X OSMANI HACKER³¹³' });
        }
    });
}

startBot();
