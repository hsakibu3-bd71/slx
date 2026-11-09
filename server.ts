import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dbService, Message, Room } from './server/db.js';
import { sendEmailNotification } from './server/email.js';
import { generatePhpBundle } from './server/php_generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload directory exists
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
// Enhanced uploads handler with intelligent MIME detection (crucial for iOS/Safari WebM vs MP4 voice notes)
app.use('/uploads', (req, res, next) => {
  const requestedFile = path.basename(req.path);
  let filePath = path.join(uploadsDir, requestedFile);

  if (!fs.existsSync(filePath)) {
    const lastDot = requestedFile.lastIndexOf('.');
    if (lastDot > 0) {
      const baseWithoutExt = requestedFile.substring(0, lastDot);
      const possibleExts = ['.mp4', '.webm', '.wav', '.mp3', '.ogg', '.m4a'];
      for (const altExt of possibleExts) {
        const candidate = path.join(uploadsDir, baseWithoutExt + altExt);
        if (fs.existsSync(candidate)) {
          filePath = candidate;
          break;
        }
      }
    }
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return next();
  }

  try {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);

    // If file has 'ftyp' at offset 4..8, it is ISO Media / MP4 / M4A (Safari iOS/macOS voice note)
    if (header.subarray(4, 8).toString('ascii') === 'ftyp') {
      res.setHeader('Content-Type', 'audio/mp4');
    } else if (header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
      res.setHeader('Content-Type', 'audio/webm');
    } else if (header.subarray(0, 4).toString('ascii') === 'RIFF') {
      res.setHeader('Content-Type', 'audio/wav');
    } else if (header.subarray(0, 3).toString('ascii') === 'ID3' || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)) {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (header.subarray(0, 4).toString('ascii') === 'OggS') {
      res.setHeader('Content-Type', 'audio/ogg');
    }
  } catch (e) {}

  res.sendFile(filePath);
});

export function getClientIp(req: express.Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string') {
    const firstIp = xForwardedFor.split(',')[0].trim();
    return firstIp.replace(/^::ffff:/, '');
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp.trim().replace(/^::ffff:/, '');
  }
  const remoteAddress = req.socket?.remoteAddress || '';
  return remoteAddress.replace(/^::ffff:/, '') || '127.0.0.1';
}

// WebSocket Client tracking
interface ClientConnection {
  ws: WebSocket;
  id: string;
  roomId?: string;
  role: 'user' | 'admin';
  name: string;
  email: string;
  avatar?: string;
}

const clients = new Map<WebSocket, ClientConnection>();

const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastToRoom(roomId: string, data: any, excludeWs?: WebSocket) {
  const json = JSON.stringify(data);
  for (const [ws, client] of clients.entries()) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      // Send if client is in the room or is an admin monitoring all rooms
      if (client.roomId === roomId || (client.role === 'admin' && data.type !== 'webrtc_offer' && data.type !== 'webrtc_answer' && data.type !== 'webrtc_candidate')) {
        ws.send(json);
      }
    }
  }
}

function broadcastToAdmins(data: any) {
  const json = JSON.stringify(data);
  for (const [ws, client] of clients.entries()) {
    if (client.role === 'admin' && ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  }
}

wss.on('connection', (ws: WebSocket, req) => {
  const clientId = 'conn_' + Math.random().toString(36).substring(2, 9);
  const clientInfo: ClientConnection = {
    ws,
    id: clientId,
    role: 'user',
    name: 'Visitor',
    email: 'guest@visitor.com'
  };
  clients.set(ws, clientInfo);

  ws.on('message', async (messageRaw) => {
    try {
      const payload = JSON.parse(messageRaw.toString());
      const { type } = payload;

      switch (type) {
        case 'identify': {
          clientInfo.role = payload.role === 'admin' ? 'admin' : 'user';
          clientInfo.name = payload.name || clientInfo.name;
          clientInfo.email = payload.email || clientInfo.email;
          clientInfo.avatar = payload.avatar;
          if (payload.roomId) {
            clientInfo.roomId = payload.roomId;
            if (clientInfo.role === 'user') {
              dbService.createOrUpdateRoom({
                id: payload.roomId,
                user_id: clientInfo.id,
                user_name: clientInfo.name,
                user_email: clientInfo.email,
                user_avatar: clientInfo.avatar || '',
              });
            }
          }

          // Send confirmation
          ws.send(JSON.stringify({
            type: 'identified',
            clientId: clientInfo.id,
            role: clientInfo.role,
            roomId: clientInfo.roomId
          }));

          // Notify admins of updated room status
          broadcastToAdmins({
            type: 'room_status_changed',
            rooms: dbService.getRooms()
          });
          break;
        }

        case 'join_room': {
          clientInfo.roomId = payload.roomId;
          if (payload.role) clientInfo.role = payload.role;
          if (payload.name) clientInfo.name = payload.name;
          if (payload.email) clientInfo.email = payload.email;

          if (clientInfo.role === 'user' && clientInfo.roomId) {
            dbService.createOrUpdateRoom({
              id: clientInfo.roomId,
              user_id: clientInfo.id,
              user_name: clientInfo.name,
              user_email: clientInfo.email,
              user_avatar: clientInfo.avatar || '',
            });
            dbService.updateRoomOnline(clientInfo.roomId, 1);
          }

          // Reset unread for this role
          if (clientInfo.roomId) {
            dbService.resetUnread(clientInfo.roomId, clientInfo.role);
          }

          // Send back message history
          if (clientInfo.roomId) {
            const messages = dbService.getMessages(clientInfo.roomId);
            ws.send(JSON.stringify({
              type: 'room_history',
              roomId: clientInfo.roomId,
              messages
            }));
          }

          broadcastToAdmins({
            type: 'room_status_changed',
            rooms: dbService.getRooms()
          });
          break;
        }

        case 'chat_message': {
          const roomId = payload.roomId || clientInfo.roomId;
          if (!roomId) return;

          const newMsg: Message = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            room_id: roomId,
            sender_type: payload.sender_type || clientInfo.role,
            sender_name: payload.sender_name || clientInfo.name,
            sender_email: payload.sender_email || clientInfo.email,
            sender_avatar: payload.sender_avatar || clientInfo.avatar,
            message_type: payload.message_type || 'text',
            text: payload.text || '',
            media_url: payload.media_url,
            file_name: payload.file_name,
            file_size: payload.file_size,
            created_at: new Date().toISOString()
          };

          dbService.addMessage(newMsg);

          // Broadcast to everyone in room and all admins
          const broadcastPayload = {
            type: 'new_message',
            message: newMsg,
            roomId
          };

          for (const [targetWs, targetClient] of clients.entries()) {
            if (targetWs.readyState === WebSocket.OPEN) {
              if (targetClient.roomId === roomId || targetClient.role === 'admin') {
                targetWs.send(JSON.stringify(broadcastPayload));
              }
            }
          }

          // Two-way mail-to-mail transmission for all message types (text, voice, photo, file):
          // 1) Visitor message -> emails Sakib Hasan (mesakibu4@gmail.com)
          // 2) Sakib Hasan (admin) message -> emails visitor
          const room = dbService.getRoom(roomId);
          sendEmailNotification(newMsg, room ? { user_name: room.user_name, user_email: room.user_email } : undefined)
            .then(res => {
              broadcastToAdmins({
                type: 'email_dispatched',
                roomId,
                messageId: newMsg.id,
                status: res.status
              });
            })
            .catch(err => {
              console.error('Email dispatch error:', err);
            });
          break;
        }

        case 'typing': {
          const roomId = payload.roomId || clientInfo.roomId;
          if (!roomId) return;
          broadcastToRoom(roomId, {
            type: 'typing',
            roomId,
            userId: clientInfo.id,
            userName: clientInfo.name,
            isTyping: !!payload.isTyping
          }, ws);
          break;
        }

        case 'update_avatar': {
          const roomId = payload.roomId || clientInfo.roomId;
          const newAvatar = payload.avatarUrl;
          if (roomId && newAvatar) {
            dbService.updateRoomAvatar(roomId, newAvatar);
            // Broadcast avatar update to all room participants and admins
            const avatarBroadcast = {
              type: 'avatar_updated',
              roomId,
              avatarUrl: newAvatar,
              updatedBy: clientInfo.role
            };
            for (const [targetWs, targetClient] of clients.entries()) {
              if (targetWs.readyState === WebSocket.OPEN) {
                if (targetClient.roomId === roomId || targetClient.role === 'admin') {
                  targetWs.send(JSON.stringify(avatarBroadcast));
                }
              }
            }
          }
          break;
        }

        // WebRTC Signaling: Calls, Offers, Answers, ICE Candidates
        case 'call_request': {
          const roomId = payload.roomId || clientInfo.roomId;
          if (!roomId) return;

          const callSignal = {
            type: 'incoming_call',
            roomId,
            callType: payload.callType || 'video', // 'audio' | 'video'
            fromRole: clientInfo.role,
            fromName: clientInfo.name,
            fromAvatar: clientInfo.avatar,
            timestamp: Date.now()
          };

          // Route to the peer in the room
          for (const [targetWs, targetClient] of clients.entries()) {
            if (targetWs !== ws && targetWs.readyState === WebSocket.OPEN) {
              if (targetClient.roomId === roomId || (clientInfo.role === 'user' && targetClient.role === 'admin')) {
                targetWs.send(JSON.stringify(callSignal));
              }
            }
          }
          break;
        }

        case 'call_response': {
          const roomId = payload.roomId || clientInfo.roomId;
          if (!roomId) return;

          const responseSignal = {
            type: 'call_response',
            roomId,
            accepted: !!payload.accepted,
            callType: payload.callType,
            responderName: clientInfo.name,
            fromRole: clientInfo.role
          };

          // If call ended/rejected, record a system message in room
          if (!payload.accepted) {
            dbService.addMessage({
              id: 'call_' + Date.now(),
              room_id: roomId,
              sender_type: 'system',
              sender_name: 'Call System',
              message_type: 'call_log',
              text: `Call declined by ${clientInfo.name}`,
              created_at: new Date().toISOString()
            });
          }

          for (const [targetWs, targetClient] of clients.entries()) {
            if (targetWs !== ws && targetWs.readyState === WebSocket.OPEN) {
              if (targetClient.roomId === roomId || targetClient.role === 'admin') {
                targetWs.send(JSON.stringify(responseSignal));
              }
            }
          }
          break;
        }

        case 'call_end': {
          const roomId = payload.roomId || clientInfo.roomId;
          if (!roomId) return;

          dbService.addMessage({
            id: 'call_' + Date.now(),
            room_id: roomId,
            sender_type: 'system',
            sender_name: 'Call System',
            message_type: 'call_log',
            text: `Call ended (${payload.duration || '00:00'})`,
            created_at: new Date().toISOString()
          });

          broadcastToRoom(roomId, {
            type: 'call_ended',
            roomId,
            endedBy: clientInfo.name
          });
          break;
        }

        case 'webrtc_offer':
        case 'webrtc_answer':
        case 'webrtc_candidate': {
          const roomId = payload.roomId || clientInfo.roomId;
          if (!roomId) return;

          // Forward peer signaling payload across room participants and operator admin
          for (const [targetWs, targetClient] of clients.entries()) {
            if (targetWs !== ws && targetWs.readyState === WebSocket.OPEN) {
              const isSameRoom = targetClient.roomId === roomId;
              const isUserToAdmin = clientInfo.role === 'user' && targetClient.role === 'admin';
              const isAdminToRoom = clientInfo.role === 'admin' && (targetClient.roomId === roomId || targetClient.role === 'user');
              if (isSameRoom || isUserToAdmin || isAdminToRoom) {
                targetWs.send(JSON.stringify(payload));
              }
            }
          }
          break;
        }
      }
    } catch (err: any) {
      console.error('WS Message parsing error:', err.message);
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client && client.roomId && client.role === 'user') {
      dbService.updateRoomOnline(client.roomId, 0);
      broadcastToAdmins({
        type: 'room_status_changed',
        rooms: dbService.getRooms()
      });
    }
    clients.delete(ws);
  });
});

// REST API Endpoints

// 1. App status & stats
app.get('/api/status', (req, res) => {
  const rooms = dbService.getRooms();
  const onlineCount = rooms.filter(r => r.is_online === 1).length;
  const settings = dbService.getSettings();
  res.json({
    status: 'online',
    activeConnections: clients.size,
    totalRooms: rooms.length,
    onlineVisitors: onlineCount,
    adminEmail: settings.admin_email || 'mesakibu4@gmail.com',
    sqliteFile: 'nexus_chat.sqlite',
    time: new Date().toISOString()
  });
});

// IP Firewall Status & Management
app.get('/api/admin/ip-status', (req, res) => {
  const clientIp = getClientIp(req);
  const isAllowed = dbService.isIpAllowed(clientIp);
  const allowedIps = dbService.getAllowedIps();
  res.json({
    clientIp,
    isAllowed,
    allowedIps,
    primaryIp: '59.152.5.2'
  });
});

app.post('/api/admin/allowed-ips', (req, res) => {
  const { ip, action } = req.body;
  if (!ip || typeof ip !== 'string') {
    return res.status(400).json({ error: 'IP address is required' });
  }

  let updatedIps: string[];
  if (action === 'remove') {
    updatedIps = dbService.removeAllowedIp(ip);
  } else {
    updatedIps = dbService.addAllowedIp(ip);
  }

  res.json({
    success: true,
    allowedIps: updatedIps,
    clientIp: getClientIp(req)
  });
});

// 2. Room management
app.get('/api/rooms', (req, res) => {
  const rooms = dbService.getRooms();
  res.json({ rooms });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const room = dbService.getRoom(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  const messages = dbService.getMessages(req.params.roomId);
  res.json({ room, messages });
});

app.get('/api/rooms/:roomId/messages', (req, res) => {
  const messages = dbService.getMessages(req.params.roomId);
  res.json({ messages });
});

app.post('/api/rooms/:roomId/avatar', (req, res) => {
  const { avatarUrl } = req.body;
  if (!avatarUrl) {
    return res.status(400).json({ error: 'avatarUrl is required' });
  }
  dbService.updateRoomAvatar(req.params.roomId, avatarUrl);
  res.json({ success: true, avatarUrl });
});

app.post('/api/admin/avatar', (req, res) => {
  const { avatarUrl } = req.body;
  if (!avatarUrl) {
    return res.status(400).json({ error: 'avatarUrl is required' });
  }
  dbService.updateSetting('admin_avatar', avatarUrl);

  const broadcastPayload = {
    type: 'admin_avatar_updated',
    avatarUrl
  };
  for (const [targetWs] of clients.entries()) {
    if (targetWs.readyState === WebSocket.OPEN) {
      targetWs.send(JSON.stringify(broadcastPayload));
    }
  }

  res.json({ success: true, avatarUrl });
});

// 3. Send message via HTTP
app.post('/api/messages', async (req, res) => {
  const { roomId, senderType, senderName, senderEmail, senderAvatar, messageType, text, mediaUrl, fileName, fileSize } = req.body;
  if (!roomId) {
    return res.status(400).json({ error: 'roomId is required' });
  }

  const newMsg: Message = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    room_id: roomId,
    sender_type: senderType || 'user',
    sender_name: senderName || 'Visitor',
    sender_email: senderEmail,
    sender_avatar: senderAvatar,
    message_type: messageType || 'text',
    text: text || '',
    media_url: mediaUrl,
    file_name: fileName,
    file_size: fileSize,
    created_at: new Date().toISOString()
  };

  dbService.addMessage(newMsg);

  // Broadcast to WS clients
  const broadcastPayload = {
    type: 'new_message',
    message: newMsg,
    roomId
  };
  for (const [targetWs, targetClient] of clients.entries()) {
    if (targetWs.readyState === WebSocket.OPEN) {
      if (targetClient.roomId === roomId || targetClient.role === 'admin') {
        targetWs.send(JSON.stringify(broadcastPayload));
      }
    }
  }

  // Two-way mail-to-mail transmission for all message types
  const room = dbService.getRoom(roomId);
  sendEmailNotification(newMsg, room ? { user_name: room.user_name, user_email: room.user_email } : undefined);

  res.json({ success: true, message: newMsg });
});

// 4. File / Image / Audio upload endpoint
app.post('/api/upload', (req, res) => {
  try {
    const { base64Data, fileName, mimeType } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'No data provided' });
    }

    // Clean base64 string
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer: Buffer;
    let ext = '.bin';

    if (matches && matches.length === 3) {
      buffer = Buffer.from(matches[2], 'base64');
      const detectedMime = matches[1].toLowerCase();
      if (detectedMime.includes('audio/webm')) ext = '.webm';
      else if (detectedMime.includes('audio/mp4') || detectedMime.includes('audio/m4a') || detectedMime.includes('audio/aac')) ext = '.mp4';
      else if (detectedMime.includes('audio/wav') || detectedMime.includes('audio/x-wav')) ext = '.wav';
      else if (detectedMime.includes('audio/mp3') || detectedMime.includes('audio/mpeg')) ext = '.mp3';
      else if (detectedMime.includes('audio/ogg')) ext = '.ogg';
      else if (detectedMime.includes('image/png')) ext = '.png';
      else if (detectedMime.includes('image/jpeg')) ext = '.jpg';
      else if (detectedMime.includes('image/webp')) ext = '.webp';
      else if (detectedMime.includes('application/pdf')) ext = '.pdf';
    } else {
      buffer = Buffer.from(base64Data, 'base64');
    }

    if (fileName && fileName.includes('.')) {
      ext = path.extname(fileName);
    }

    // Sniff buffer magic bytes to ensure exact format (e.g. Safari MP4 audio vs Chrome WebM)
    if (buffer.length >= 8 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
      ext = '.mp4';
    } else if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
      ext = '.webm';
    } else if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'RIFF') {
      ext = '.wav';
    }

    const uniqueName = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + ext;
    const savePath = path.join(uploadsDir, uniqueName);
    fs.writeFileSync(savePath, buffer);

    const fileUrl = `/uploads/${uniqueName}`;
    res.json({
      success: true,
      url: fileUrl,
      fileName: fileName || uniqueName,
      fileSize: buffer.length
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// 4b. Gemini AI Photo Editing endpoint
app.post('/api/gemini/edit-image', async (req, res) => {
  try {
    const { imageBase64, prompt, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image base64 data is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in server secrets' });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType || 'image/jpeg',
            },
          },
          {
            text: prompt || 'Transform and enhance this portrait photo with professional studio lighting, clean background, sharp details, and artistic avatar retouching.',
          },
        ],
      },
    });

    let generatedImageUrl: string | null = null;
    let descriptionText = '';

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const detectedMime = part.inlineData.mimeType ?? 'image/png';
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        const ext = detectedMime.includes('png') ? '.png' : detectedMime.includes('webp') ? '.webp' : '.jpg';
        const uniqueName = 'ai_photo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + ext;
        const savePath = path.join(uploadsDir, uniqueName);
        fs.writeFileSync(savePath, buffer);
        generatedImageUrl = `/uploads/${uniqueName}`;
        break;
      } else if (part.text) {
        descriptionText += part.text;
      }
    }

    if (generatedImageUrl) {
      res.json({
        success: true,
        imageUrl: generatedImageUrl,
        description: descriptionText,
      });
    } else {
      res.status(500).json({
        error: 'AI did not return an image output: ' + (descriptionText || 'No image output received'),
      });
    }
  } catch (err: any) {
    console.error('Gemini image edit error:', err);
    res.status(500).json({ error: err.message || 'Gemini editing failed' });
  }
});

// 5. Settings management
app.get('/api/settings', (req, res) => {
  const settings = dbService.getSettings();
  res.json({ settings });
});

app.post('/api/settings', (req, res) => {
  const { settings } = req.body;
  if (settings && typeof settings === 'object') {
    for (const [key, val] of Object.entries(settings)) {
      dbService.updateSetting(key, String(val));
    }
  }
  res.json({ success: true, settings: dbService.getSettings() });
});

// 6. Email test endpoint
app.post('/api/email/test', async (req, res) => {
  const settings = dbService.getSettings();
  const testMsg: Message = {
    id: 'test_' + Date.now(),
    room_id: 'test_system',
    sender_type: 'user',
    sender_name: 'NexusConnect System Tester',
    sender_email: 'test@nexusconnect.dev',
    message_type: 'text',
    text: 'Hello! This is a test message to verify your instant email alert pipeline. Every visitor message is routed to ' + (settings.admin_email || 'mesakibu4@gmail.com') + '.',
    created_at: new Date().toISOString()
  };

  const result = await sendEmailNotification(testMsg);
  res.json({ success: true, result, logs: dbService.getEmailLogs() });
});

app.get('/api/email/logs', (req, res) => {
  const logs = dbService.getEmailLogs();
  res.json({ logs });
});

// 7. Light SQL / SQLite Database Export
app.get('/api/db/export-sql', (req, res) => {
  const sql = dbService.getSqlDump();
  res.setHeader('Content-Type', 'application/sql');
  res.setHeader('Content-Disposition', 'attachment; filename="nexus_chat_dump.sql"');
  res.send(sql);
});

app.get('/api/db/export-sqlite', (req, res) => {
  const dbFile = dbService.getDbFilePath();
  if (fs.existsSync(dbFile)) {
    res.download(dbFile, 'nexus_chat.sqlite');
  } else {
    res.status(404).json({ error: 'Database file not found' });
  }
});

// 8. PHP Standalone Package Export
app.get('/api/php-bundle', (req, res) => {
  const settings = dbService.getSettings();
  const bundle = generatePhpBundle(settings.admin_email || 'mesakibu4@gmail.com');
  res.json(bundle);
});

// Serve frontend: Vite middleware in dev, static files in prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {}
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`NexusConnect Server running on port ${port}`);
    console.log(`WebSocket server mounted on /ws`);
    console.log(`Admin operator hub available at http://localhost:${port}/join`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
