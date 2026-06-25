/**
 * session-store.js
 * Reads Claude Code sessions from ~/.claude/projects/
 */

const fs = require('fs');
const path = require('path');

/**
 * Encode current directory path to Claude Code project folder format.
 * E.g., /Users/congdau/Projects -> -Users-congdau-Projects
 * @param {string} cwd
 * @returns {string}
 */
function encodePath(cwd) {
  if (!cwd) return '';
  return cwd.replace(/\//g, '-');
}

/**
 * Extract the first user prompt from a session JSONL file to use as the title.
 * @param {string} filePath
 * @returns {string}
 */
function extractTitle(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === 'user' && event.message && event.message.content) {
          return event.message.content;
        }
      } catch (e) {
        // Skip JSON parse errors on partial or corrupted lines
      }
    }
  } catch (err) {
    console.error(`[session-store] Error reading session file ${filePath}:`, err.message);
  }
  return 'Untitled Session';
}

/**
 * List recent Claude CLI sessions for a given working directory.
 * @param {string} cwd - Workspace directory path
 * @param {number} limit - Max number of sessions to return
 * @returns {Array<{sessionId: string, title: string, mtime: Date}>}
 */
function listSessions(cwd, limit = 10) {
  const encoded = encodePath(cwd);
  if (!encoded) return [];

  const homeDir = process.env.HOME || '/Users/congdau';
  const projectsDir = path.join(homeDir, '.claude', 'projects', encoded);

  if (!fs.existsSync(projectsDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(projectsDir);
    const sessions = [];

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const filePath = path.join(projectsDir, file);
      
      try {
        const stat = fs.statSync(filePath);
        const sessionId = path.basename(file, '.jsonl');
        const rawTitle = extractTitle(filePath);
        // Truncate title if too long
        const title = rawTitle.length > 50 ? rawTitle.substring(0, 47) + '...' : rawTitle;

        sessions.push({
          sessionId,
          title,
          mtime: stat.mtime
        });
      } catch (e) {
        // Skip files that cannot be read
      }
    }

    // Sort by modification time descending (newest first)
    sessions.sort((a, b) => b.mtime - a.mtime);

    return sessions.slice(0, limit);
  } catch (err) {
    console.error(`[session-store] Error listing sessions for ${cwd}:`, err.message);
    return [];
  }
}

/**
 * Get the session ID of the latest active session.
 * @param {string} cwd
 * @returns {string|null}
 */
function getLatestSessionId(cwd) {
  const sessions = listSessions(cwd, 1);
  return sessions.length > 0 ? sessions[0].sessionId : null;
}

/**
 * Format date into a relative time string in Vietnamese.
 * @param {Date} date
 * @returns {string}
 */
function formatRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHr < 24) return `${diffHr} giờ trước`;
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return `${diffDays} ngày trước`;
  
  // Format as DD/MM/YYYY
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

module.exports = {
  encodePath,
  listSessions,
  getLatestSessionId,
  formatRelativeTime
};
