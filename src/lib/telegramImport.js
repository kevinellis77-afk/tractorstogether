'use strict';

const fs = require('fs');
const path = require('path');
const { scoreSentiment } = require('./sentiment');

const DEFAULTS = {
  rawPath: '/data/result.json',
  enrichedPath: '/data/messages_enriched.json',
  statePath: '/data/import_state.json'
};

function resolvePath(preferred, fallbackRelative) {
  return fs.existsSync(preferred) ? preferred : fallbackRelative;
}

function resolveRawPath(preferredAbsolute, repoDataDir) {
  const candidates = [
    preferredAbsolute,
    preferredAbsolute.replace(/result\.json$/i, 'Results.json'),
    preferredAbsolute.replace(/result\.json$/i, 'results.json'),
    preferredAbsolute.replace(/result\.json$/i, 'RESULTS.json'),
    path.join(repoDataDir, 'result.json'),
    path.join(repoDataDir, 'Results.json'),
    path.join(repoDataDir, 'results.json'),
    path.join(repoDataDir, 'RESULTS.json')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(repoDataDir, 'result.json');
}

const SWEARS = ['shit','shite','fuck','fucking','bollocks','bugger','cunt','crap','prick','cock','bastard','piss','dogshit'];
const STOP_WORDS = new Set(['the','and','for','that','with','have','this','from','your','just','what','when','they','them','were','will','would','there','about','been','into','then','than','their','dont','you','are','its','im','ive','our','not','all','too','out','but','can','get','got','one','how','why','who','did','had','has','his','her','she','him','was','off','any','now','day','bit','still']);

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) { return fallback; }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function normalizeText(raw) {
  if (typeof raw === 'string') return raw.trim();
  if (!Array.isArray(raw)) return '';
  return raw.map((part) => {
    if (typeof part === 'string') return part;
    if (part && typeof part === 'object' && typeof part.text === 'string') return part.text;
    return '';
  }).join('').trim();
}

function isProcessableMessage(msg) {
  if (!msg || msg.type !== 'message') return false;
  const text = normalizeText(msg.text);
  const hasMedia = Boolean(msg.photo || msg.file || msg.mime_type || msg.media_type);
  if (!text && hasMedia) return false;
  return Boolean(text);
}

function toRow(msg) {
  const text = normalizeText(msg.text);
  const iso = msg.date || '';
  const [d, timePart = '00:00:00'] = iso.split('T');
  const t = timePart.slice(0, 5);
  const s = scoreSentiment(text);
  return {
    id: msg.id,
    d,
    t,
    u: msg.from || msg.from_id || 'Unknown',
    fromId: msg.from_id || null,
    unix: Number(msg.date_unixtime || 0),
    replyTo: msg.reply_to_message_id || null,
    reactions: Array.isArray(msg.reactions) ? msg.reactions : [],
    x: text,
    sentimentLabel: s.sentimentLabel,
    sentimentScore: s.sentimentScore,
    s: s.sentimentScore
  };
}

function aggregate(rows) {
  const byUser = new Map();
  const byDay = new Map();
  const byHour = Array(24).fill(0);
  const sentCounts = { positive: 0, neutral: 0, negative: 0 };
  const wordCounts = new Map();
  const emojiCounts = new Map();
  const swearCounts = new Map();
  const swearByUser = new Map();
  let sentimentTotal = 0;

  for (const m of rows) {
    sentimentTotal += m.sentimentScore;
    sentCounts[m.sentimentLabel] += 1;
    byDay.set(m.d, (byDay.get(m.d) || 0) + 1);
    const hour = Number((m.t || '00:00').split(':')[0]);
    if (!Number.isNaN(hour) && hour >= 0 && hour < 24) byHour[hour] += 1;

    const user = byUser.get(m.u) || { name: m.u, msgs: 0, words: 0, days: new Set(), q: 0, links: 0, media: 0, replies: 0, swears: 0, react: 0, sentSum: 0 };
    user.msgs += 1;
    const words = (m.x.match(/\b[\p{L}\p{N}']+\b/gu) || []);
    user.words += words.length;
    user.days.add(m.d);
    user.q += (m.x.match(/\?/g) || []).length;
    user.links += /https?:\/\//i.test(m.x) ? 1 : 0;
    user.replies += m.replyTo ? 1 : 0;
    user.react += (m.reactions || []).reduce((n, r) => n + (Number(r.count) || 0), 0);
    user.sentSum += m.sentimentScore;

    for (const token of words.map((w) => w.toLowerCase())) {
      if (token.length < 3 || STOP_WORDS.has(token)) continue;
      wordCounts.set(token, (wordCounts.get(token) || 0) + 1);
      if (SWEARS.includes(token)) {
        swearCounts.set(token, (swearCounts.get(token) || 0) + 1);
        swearByUser.set(`${token}::${m.u}`, (swearByUser.get(`${token}::${m.u}`) || 0) + 1);
        user.swears += 1;
      }
    }

    for (const r of (m.reactions || [])) {
      if (r.emoji) emojiCounts.set(r.emoji, (emojiCounts.get(r.emoji) || 0) + (Number(r.count) || 0));
    }

    byUser.set(m.u, user);
  }

  const members = [...byUser.values()].map((u) => ({
    name: u.name,
    msgs: u.msgs,
    words: u.words,
    days: u.days.size,
    q: u.q,
    links: u.links,
    media: u.media,
    replies: u.replies,
    swears: u.swears,
    react: u.react,
    avg: Math.round(u.words / Math.max(u.msgs, 1)),
    sent: Number((u.sentSum / Math.max(u.msgs, 1)).toFixed(3))
  })).sort((a, b) => b.msgs - a.msgs);

  const topWordUsers = new Map();
  for (const [k, c] of swearByUser.entries()) {
    const [w, u] = k.split('::');
    const prev = topWordUsers.get(w);
    if (!prev || c > prev.count) topWordUsers.set(w, { user: u, count: c });
  }

  const swearWords = [...swearCounts.entries()].map(([word, count]) => ({ word, count, topUser: (topWordUsers.get(word) || {}).user || 'Unknown' })).sort((a, b) => b.count - a.count);
  const dayActivity = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ label: new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }), date, count }));
  const topWords = [...wordCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([word, count]) => ({ word, count }));
  const reactionEmojis = [...emojiCounts.entries()].sort((a, b) => b[1] - a[1]).map(([e, c]) => ({ e, c }));
  const DAYS = dayActivity.map((d) => d.date);
  const DAY_LABELS = dayActivity.map((d) => d.label);
  const groupSentByDay = DAYS.map((d) => {
    const dayRows = rows.filter((r) => r.d === d);
    if (!dayRows.length) return 0;
    return Number((dayRows.reduce((n, r) => n + r.sentimentScore, 0) / dayRows.length).toFixed(3));
  });

  return {
    members,
    dayActivity,
    hourActivity: byHour,
    swearWords,
    topWords,
    reactionEmojis,
    DAYS,
    DAY_LABELS,
    groupSentByDay,
    sentimentCounts: sentCounts,
    topPosters: members.slice(0, 10).map((m) => ({ name: m.name, count: m.msgs })),
    avgSentiment: Number((sentimentTotal / Math.max(rows.length, 1)).toFixed(3))
  };
}

function runTelegramImport(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const repoDataDir = path.resolve(process.cwd(), 'data');
  cfg.rawPath = resolveRawPath(cfg.rawPath, repoDataDir);
  cfg.enrichedPath = (cfg.enrichedPath.startsWith('/data/') && !fs.existsSync('/data')) ? path.resolve(process.cwd(), 'data/messages_enriched.json') : cfg.enrichedPath;
  cfg.statePath = (cfg.statePath.startsWith('/data/') && !fs.existsSync('/data')) ? path.resolve(process.cwd(), 'data/import_state.json') : cfg.statePath;
  const raw = readJson(cfg.rawPath, { messages: [] });
  const state = readJson(cfg.statePath, {
    highestProcessedMessageId: 0,
    latestProcessedUnix: 0,
    lastImportTimestamp: null,
    latestRunNewMessages: 0
  });
  const existing = readJson(cfg.enrichedPath, { messages: [] });
  const existingMessages = Array.isArray(existing.messages) ? existing.messages : [];
  const seen = new Set(existingMessages.map((m) => m.id));

  const rawMessages = Array.isArray(raw.messages) ? raw.messages : [];
  const processable = rawMessages.filter(isProcessableMessage);

  let newRows = 0;
  let duplicatesSkipped = 0;
  const merged = [...existingMessages];

  for (const msg of processable) {
    const msgId = Number(msg.id || 0);
    const ts = Number(msg.date_unixtime || 0);
    if (seen.has(msgId)) {
      duplicatesSkipped += 1;
      continue;
    }
    const row = toRow(msg);
    merged.push(row);
    seen.add(msgId);
    newRows += 1;
  }

  merged.sort((a, b) => (a.id - b.id));
  const agg = aggregate(merged);
  const latest = merged[merged.length - 1] || null;
  const now = new Date().toISOString();

  const output = {
    schemaVersion: 1,
    generatedAt: now,
    importStats: {
      totalProcessedMessages: merged.length,
      lastImportTimestamp: now,
      newMessagesProcessed: newRows,
      duplicatesSkipped,
      rawMessageCount: rawMessages.length,
      processableMessageCount: processable.length,
      sentimentCounts: agg.sentimentCounts,
      topPosters: agg.topPosters
    },
    summary: {
      totalMessages: merged.length,
      activeSenders: agg.members.length,
      totalMembers: agg.members.length,
      avgSentiment: agg.avgSentiment
    },
    aggregates: agg,
    messages: merged
  };

  writeJson(cfg.enrichedPath, output);

  const nextState = {
    highestProcessedMessageId: Math.max(state.highestProcessedMessageId || 0, latest ? latest.id : 0),
    latestProcessedUnix: Math.max(state.latestProcessedUnix || 0, latest ? latest.unix : 0),
    lastImportTimestamp: now,
    latestRunNewMessages: newRows
  };
  writeJson(cfg.statePath, nextState);

  return {
    rawMessageCount: rawMessages.length,
    processableMessageCount: processable.length,
    newlyImportedCount: newRows,
    duplicatesSkipped,
    sentimentBreakdown: agg.sentimentCounts,
    highestProcessedMessageId: nextState.highestProcessedMessageId,
    latestProcessedUnix: nextState.latestProcessedUnix
  };
}

module.exports = { runTelegramImport };
