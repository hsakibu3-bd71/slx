export function generatePhpBundle(adminEmail: string = 'mesakibu4@gmail.com') {
  const schemaSql = `-- NexusConnect Portable Light SQL Schema
-- Compatible with SQLite3, MySQL, MariaDB, PostgreSQL
CREATE TABLE IF NOT EXISTS rooms (
  id VARCHAR(64) PRIMARY KEY,
  user_name VARCHAR(128) NOT NULL,
  user_email VARCHAR(128) NOT NULL,
  user_avatar TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(64) PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL,
  sender_type VARCHAR(32) NOT NULL, /* 'user' or 'admin' */
  sender_name VARCHAR(128) NOT NULL,
  sender_email VARCHAR(128),
  message_type VARCHAR(32) NOT NULL, /* 'text', 'audio', 'image', 'file', 'call' */
  text TEXT,
  media_url MEDIUMTEXT,
  file_name VARCHAR(255),
  file_size INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS signaling (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL,
  sender VARCHAR(64) NOT NULL,
  target VARCHAR(64) NOT NULL,
  type VARCHAR(64) NOT NULL,
  payload LONGTEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

  const apiPhp = `<?php
/**
 * NexusConnect PHP Backend API
 * Uses Native PHP PDO with SQLite database (portable, no install needed)
 * Email alerts to: ${adminEmail}
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Origin, Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dbPath = __DIR__ . '/database.sqlite';
$adminEmail = '${adminEmail}';

try {
    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Initialize tables
    $db->exec("
        CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            user_name TEXT,
            user_email TEXT,
            user_avatar TEXT,
            created_at TEXT,
            last_message_at TEXT
        );
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            room_id TEXT,
            sender_type TEXT,
            sender_name TEXT,
            sender_email TEXT,
            message_type TEXT,
            text TEXT,
            media_url TEXT,
            file_name TEXT,
            file_size INTEGER,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS signaling (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id TEXT,
            sender TEXT,
            type TEXT,
            payload TEXT,
            created_at TEXT
        );
    ");
} catch (Exception $e) {
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    exit;
}

$action = $_GET['action'] ?? '';

// 1. Get Room Messages
if ($action === 'get_messages') {
    $roomId = $_GET['room_id'] ?? '';
    $since = $_GET['since'] ?? '';
    
    if ($since) {
        $stmt = $db->prepare("SELECT * FROM messages WHERE room_id = ? AND created_at > ? ORDER BY created_at ASC");
        $stmt->execute([$roomId, $since]);
    } else {
        $stmt = $db->prepare("SELECT * FROM messages WHERE room_id = ? ORDER BY created_at ASC");
        $stmt->execute([$roomId]);
    }
    echo json_encode(['messages' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    exit;
}

// 2. Send Message
if ($action === 'send_message' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        echo json_encode(['error' => 'Invalid JSON']);
        exit;
    }

    $id = 'msg_' . time() . '_' . bin2hex(random_bytes(4));
    $roomId = $data['room_id'] ?? '';
    $senderType = $data['sender_type'] ?? 'user';
    $senderName = $data['sender_name'] ?? 'Visitor';
    $senderEmail = $data['sender_email'] ?? '';
    $messageType = $data['message_type'] ?? 'text';
    $text = $data['text'] ?? '';
    $mediaUrl = $data['media_url'] ?? '';
    $fileName = $data['file_name'] ?? '';
    $fileSize = $data['file_size'] ?? 0;
    $now = date('c');

    // Ensure room exists
    $rStmt = $db->prepare("INSERT OR IGNORE INTO rooms (id, user_name, user_email, user_avatar, created_at, last_message_at) VALUES (?, ?, ?, ?, ?, ?)");
    $rStmt->execute([$roomId, $senderName, $senderEmail, $data['sender_avatar'] ?? '', $now, $now]);
    
    $updStmt = $db->prepare("UPDATE rooms SET last_message_at = ? WHERE id = ?");
    $updStmt->execute([$now, $roomId]);

    // Insert message
    $mStmt = $db->prepare("INSERT INTO messages (id, room_id, sender_type, sender_name, sender_email, message_type, text, media_url, file_name, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $mStmt->execute([$id, $roomId, $senderType, $senderName, $senderEmail, $messageType, $text, $mediaUrl, $fileName, $fileSize, $now]);

    // Send email alert to admin if from visitor
    if ($senderType === 'user' && !empty($adminEmail)) {
        $subject = "New {$messageType} message from {$senderName} ({$senderEmail})";
        $headers = "From: noreply@" . ($_SERVER['SERVER_NAME'] ?? 'nexusconnect.site') . "\\r\\n";
        $headers .= "Reply-To: {$senderEmail}\\r\\n";
        $headers .= "MIME-Version: 1.0\\r\\n";
        $headers .= "Content-Type: text/html; charset=UTF-8\\r\\n";
        
        $body = "<h2>New Chat Message on Website</h2>";
        $body .= "<p><strong>Sender:</strong> {$senderName} ({$senderEmail})</p>";
        $body .= "<p><strong>Type:</strong> {$messageType}</p>";
        $body .= "<p><strong>Message:</strong> " . nl2br(htmlspecialchars($text)) . "</p>";
        $body .= "<p><a href='https://" . ($_SERVER['SERVER_NAME'] ?? 'localhost') . "/join?room={$roomId}'>Open /join to reply</a></p>";
        
        @mail($adminEmail, $subject, $body, $headers);
    }

    echo json_encode(['success' => true, 'id' => $id, 'created_at' => $now]);
    exit;
}

// 3. WebRTC Signaling (Poll or Push)
if ($action === 'signal') {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $db->prepare("INSERT INTO signaling (room_id, sender, type, payload, created_at) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$data['room_id'], $data['sender'], $data['type'], json_encode($data['payload']), date('c')]);
        echo json_encode(['success' => true]);
        exit;
    } else {
        $roomId = $_GET['room_id'] ?? '';
        $excludeSender = $_GET['exclude_sender'] ?? '';
        $stmt = $db->prepare("SELECT * FROM signaling WHERE room_id = ? AND sender != ? ORDER BY id DESC LIMIT 10");
        $stmt->execute([$roomId, $excludeSender]);
        echo json_encode(['signals' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        exit;
    }
}

// 4. List all active rooms for /join operator
if ($action === 'list_rooms') {
    $stmt = $db->query("SELECT * FROM rooms ORDER BY last_message_at DESC");
    echo json_encode(['rooms' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    exit;
}

echo json_encode(['status' => 'NexusConnect PHP + SQLite API Active', 'db' => 'SQLite 3']);
`;

  return {
    schemaSql,
    apiPhp,
    readme: `# NexusConnect - PHP + SQLite Deployment Guide
## Deploying to any PHP + SQLite Web Server (Apache, Nginx, cPanel, LiteSpeed)

1. Upload \`chat_api.php\` to your public_html or website folder.
2. Ensure PHP has SQLite3 extension enabled (enabled by default on 99.9% of hosting providers).
3. The database file \`database.sqlite\` will be created automatically with read/write permissions.
4. All messages, voice notes, photos, and calls will persist in SQLite.
5. Instant email notifications are routed directly to: ${adminEmail}
`
  };
}
