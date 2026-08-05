const axios = require('axios');
const config = require('../config');

const FEEDS = {
  local: config.news.feedsLocal,
  internacional: config.news.feedsInternacional,
  cripto: config.news.feedsCripto,
};

let cache = { data: null, timestamp: 0 };

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripHtml(s) {
  return decodeEntities(String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function parseRSS(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title = decodeEntities((block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || '').trim();
    const link = (block.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1] || '';
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';
    const descMatch = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
    const desc = descMatch ? stripHtml(descMatch[1]).slice(0, 180) : '';
    if (!title || !link) continue;
    let fuente = decodeEntities(source.trim());
    if (!fuente) {
      try { fuente = new URL(link).hostname.replace(/^www\./, ''); } catch {}
    }
    items.push({ titulo: title, link, fuente, fecha: pubDate, descripcion: desc });
  }
  return items;
}

async function fetchFeed(url) {
  const { data } = await axios.get(url, { timeout: config.news.timeout, headers: { 'User-Agent': config.news.userAgent } });
  return parseRSS(data);
}

async function refreshNews() {
  const out = { local: [], internacional: [], cripto: [] };
  await Promise.all(Object.entries(FEEDS).map(async ([cat, urls]) => {
    const lists = await Promise.allSettled(urls.map(fetchFeed));
    const seen = new Set();
    for (const r of lists) {
      if (r.status !== 'fulfilled') continue;
      for (const item of r.value) {
        if (seen.has(item.link)) continue;
        seen.add(item.link);
        out[cat].push(item);
      }
    }
    out[cat] = out[cat].slice(0, config.news.perCategory);
  }));
  return out;
}

async function getNoticias() {
  if (cache.data && Date.now() - cache.timestamp < config.news.cacheTtl) {
    return { ...cache.data, cacheado: true };
  }
  try {
    const data = await refreshNews();
    cache = { data, timestamp: Date.now() };
    return { ...data, actualizado: new Date().toISOString(), cacheado: false };
  } catch (err) {
    if (cache.data) return { ...cache.data, cacheado: true };
    return { actualizado: new Date().toISOString(), local: [], internacional: [], cripto: [] };
  }
}

module.exports = { getNoticias };
