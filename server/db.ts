import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'nexus_chat.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    user_email TEXT,
    user_avatar TEXT,
    ip TEXT,
    is_online INTEGER DEFAULT 1,
    unread_admin INTEGER DEFAULT 0,
    unread_user INTEGER DEFAULT 0,
    created_at TEXT,
    last_message_at TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    sender_type TEXT NOT NULL, /* 'user' | 'admin' | 'system' */
    sender_name TEXT NOT NULL,
    sender_email TEXT,
    sender_avatar TEXT,
    message_type TEXT NOT NULL, /* 'text' | 'audio' | 'image' | 'file' | 'call_log' */
    text TEXT,
    media_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY(room_id) REFERENCES rooms(id)
  );

  CREATE TABLE IF NOT EXISTS email_logs (
    id TEXT PRIMARY KEY,
    message_id TEXT,
    room_id TEXT,
    recipient TEXT NOT NULL,
    sender_name TEXT,
    subject TEXT NOT NULL,
    content_preview TEXT,
    status TEXT NOT NULL, /* 'sent' | 'simulated' | 'error' */
    details TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Insert default settings if not exists
const defaultEmail = 'mesakibu4@gmail.com';
const setDef = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
setDef.run('admin_email', defaultEmail);
setDef.run('site_name', 'Sakib Hasan');
setDef.run('smtp_enabled', 'false');
setDef.run('smtp_host', 'smtp.gmail.com');
setDef.run('smtp_port', '587');
setDef.run('smtp_user', '');
setDef.run('smtp_pass', '');
setDef.run('admin_avatar', 'https://api.dicebear.com/7.x/bottts/svg?seed=SakibHasanOfficial');
setDef.run('facebook_url', 'https://facebook.com');
setDef.run('whatsapp_number', '+8801700000000');

export interface Room {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  user_avatar: string;
  ip: string;
  is_online: number;
  unread_admin: number;
  unread_user: number;
  created_at: string;
  last_message_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  sender_type: 'user' | 'admin' | 'system';
  sender_name: string;
  sender_email?: string;
  sender_avatar?: string;
  message_type: 'text' | 'audio' | 'image' | 'file' | 'call_log';
  text?: string;
  media_url?: string;
  file_name?: string;
  file_size?: number;
  created_at: string;
}

export interface EmailLog {
  id: string;
  message_id?: string;
  room_id?: string;
  recipient: string;
  sender_name: string;
  subject: string;
  content_preview: string;
  status: 'sent' | 'simulated' | 'error';
  details?: string;
  created_at: string;
}

export const dbService = {
  getRooms(): Room[] {
    const stmt = db.prepare('SELECT * FROM rooms ORDER BY last_message_at DESC');
    return stmt.all() as Room[];
  },

  getRoom(id: string): Room | undefined {
    const stmt = db.prepare('SELECT * FROM rooms WHERE id = ?');
    return stmt.get(id) as Room | undefined;
  },

  createOrUpdateRoom(room: {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    user_avatar: string;
    ip?: string;
  }): Room {
    const existing = dbService.getRoom(room.id);
    const now = new Date().toISOString();
    if (!existing) {
      const stmt = db.prepare(`
        INSERT INTO rooms (id, user_id, user_name, user_email, user_avatar, ip, is_online, unread_admin, unread_user, created_at, last_message_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?)
      `);
      stmt.run(room.id, room.user_id, room.user_name, room.user_email, room.user_avatar, room.ip || '127.0.0.1', now, now);
    } else {
      const stmt = db.prepare(`
        UPDATE rooms SET user_name = ?, user_email = ?, user_avatar = ?, is_online = 1, last_message_at = ? WHERE id = ?
      `);
      stmt.run(room.user_name, room.user_email, room.user_avatar, now, room.id);
    }
    return dbService.getRoom(room.id)!;
  },

  updateRoomOnline(id: string, is_online: number) {
    const stmt = db.prepare('UPDATE rooms SET is_online = ? WHERE id = ?');
    stmt.run(is_online, id);
  },

  updateRoomAvatar(id: string, avatarUrl: string) {
    const stmt = db.prepare('UPDATE rooms SET user_avatar = ? WHERE id = ?');
    stmt.run(avatarUrl, id);
    // Also update recent messages by this user
    db.prepare('UPDATE messages SET sender_avatar = ? WHERE room_id = ? AND sender_type = "user"').run(avatarUrl, id);
  },

  resetUnread(id: string, role: 'admin' | 'user') {
    if (role === 'admin') {
      db.prepare('UPDATE rooms SET unread_admin = 0 WHERE id = ?').run(id);
    } else {
      db.prepare('UPDATE rooms SET unread_user = 0 WHERE id = ?').run(id);
    }
  },

  getMessages(roomId: string): Message[] {
    const stmt = db.prepare('SELECT * FROM messages WHERE room_id = ? ORDER BY created_at ASC');
    let msgs = stmt.all(roomId) as Message[];

    // Automatic message requirement: "Please ask if you have any questions."
    if (msgs.length === 0) {
      // Ensure room exists first
      const existing = dbService.getRoom(roomId);
      if (!existing) {
        dbService.createOrUpdateRoom({
          id: roomId,
          user_id: 'visitor_' + roomId,
          user_name: 'Visitor',
          user_email: 'visitor@guest.com',
          user_avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${roomId}`
        });
      }

      const welcomeMsg: Message = {
        id: 'msg_auto_' + roomId,
        room_id: roomId,
        sender_type: 'admin',
        sender_name: 'Sakib Hasan',
        sender_email: 'mesakibu4@gmail.com',
        sender_avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=SakibAdmin',
        message_type: 'text',
        text: 'Please ask if you have any questions.',
        created_at: new Date().toISOString()
      };
      dbService.addMessage(welcomeMsg);
      msgs = [welcomeMsg];
    }

    return msgs;
  },

  addMessage(msg: Message): Message {
    // Ensure room exists to satisfy foreign key constraint
    if (!this.getRoom(msg.room_id)) {
      this.createOrUpdateRoom({
        id: msg.room_id,
        user_id: msg.room_id,
        user_name: msg.sender_type === 'user' ? msg.sender_name : 'Visitor',
        user_email: msg.sender_type === 'user' ? (msg.sender_email || 'visitor@guest.com') : 'visitor@guest.com',
        user_avatar: msg.sender_type === 'user' ? (msg.sender_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.room_id}`) : `https://api.dicebear.com/7.x/bottts/svg?seed=${msg.room_id}`
      });
    }

    const stmt = db.prepare(`
      INSERT INTO messages (id, room_id, sender_type, sender_name, sender_email, sender_avatar, message_type, text, media_url, file_name, file_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      msg.id,
      msg.room_id,
      msg.sender_type,
      msg.sender_name,
      msg.sender_email || '',
      msg.sender_avatar || '',
      msg.message_type,
      msg.text || '',
      msg.media_url || '',
      msg.file_name || '',
      msg.file_size || 0,
      msg.created_at
    );

    // Update room's last_message_at and unread counts
    if (msg.sender_type === 'user') {
      db.prepare('UPDATE rooms SET last_message_at = ?, unread_admin = unread_admin + 1 WHERE id = ?').run(msg.created_at, msg.room_id);
    } else {
      db.prepare('UPDATE rooms SET last_message_at = ?, unread_user = unread_user + 1 WHERE id = ?').run(msg.created_at, msg.room_id);
    }

    return msg;
  },

  logEmail(log: EmailLog) {
    const stmt = db.prepare(`
      INSERT INTO email_logs (id, message_id, room_id, recipient, sender_name, subject, content_preview, status, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      log.id,
      log.message_id || '',
      log.room_id || '',
      log.recipient,
      log.sender_name,
      log.subject,
      log.content_preview,
      log.status,
      log.details || '',
      log.created_at
    );
  },

  getEmailLogs(): EmailLog[] {
    const stmt = db.prepare('SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 50');
    return stmt.all() as EmailLog[];
  },

  getSettings(): Record<string, string> {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }
    return map;
  },

  updateSetting(key: string, value: string) {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    stmt.run(key, value);
  },

  getSqlDump(): string {
    const tables = ['settings', 'rooms', 'messages', 'email_logs'];
    let dump = `-- NexusConnect SQLite / MySQL / PostgreSQL Compatible Database Dump
-- Created: ${new Date().toISOString()}
-- Engine: SQLite 3 / Portable SQL

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  user_name VARCHAR(128),
  user_email VARCHAR(128),
  user_avatar TEXT,
  ip VARCHAR(64),
  is_online INT DEFAULT 1,
  unread_admin INT DEFAULT 0,
  unread_user INT DEFAULT 0,
  created_at VARCHAR(64),
  last_message_at VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(64) PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL,
  sender_type VARCHAR(32) NOT NULL,
  sender_name VARCHAR(128) NOT NULL,
  sender_email VARCHAR(128),
  sender_avatar TEXT,
  message_type VARCHAR(32) NOT NULL,
  text TEXT,
  media_url MEDIUMTEXT,
  file_name VARCHAR(255),
  file_size INT,
  created_at VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS email_logs (
  id VARCHAR(64) PRIMARY KEY,
  message_id VARCHAR(64),
  room_id VARCHAR(64),
  recipient VARCHAR(128) NOT NULL,
  sender_name VARCHAR(128),
  subject VARCHAR(255) NOT NULL,
  content_preview TEXT,
  status VARCHAR(32) NOT NULL,
  details TEXT,
  created_at VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL
);

`;

    for (const table of tables) {
      const rows = db.prepare(`SELECT * FROM ${table}`).all() as Record<string, any>[];
      if (rows.length > 0) {
        dump += `\n-- Data for ${table}\n`;
        for (const row of rows) {
          const keys = Object.keys(row);
          const values = keys.map(k => {
            const val = row[k];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number') return val;
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          dump += `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
      }
    }

    return dump;
  },

  getDbFilePath(): string {
    return dbPath;
  }
};
