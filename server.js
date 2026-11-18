#!/usr/bin/env node
/*
 * Runner local pour l'agent (Termux / PC) — aucune dépendance.
 *
 * Il sert l'interface (index.html) et expose les quelques routes dont
 * l'application a besoin pour piloter une quête make.fun depuis un téléphone :
 * lire/écrire des fichiers du dossier de travail, lancer les commandes du kit,
 * créer la paire de clés, télécharger un kit, et relayer l'API make.fun.
 *
 * Lancement :
 *   node server.js                      -> http://127.0.0.1:8787 (téléphone = même appareil)
 *   HOST=0.0.0.0 RUNNER_TOKEN=secret node server.js   -> accessible depuis le réseau local
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = path.resolve(process.env.WORKSPACE || path.join(ROOT, 'workspace'));
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const TOKEN = process.env.RUNNER_TOKEN || '';
const ORIGIN = 'https://make.fun';
const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const COMMANDS = new Set(['node', 'npm', 'npx', 'git', 'tar', 'curl', 'ls', 'cat', 'pwd', 'bash']);
const SKIP_DIRS = new Set(['node_modules', '.git', '.cache', 'kits']);

fs.mkdirSync(WORKSPACE, { recursive: true });

/* ---------------------------------------------------------------- utilitaires */

function safePath(input) {
  const rel = String(input || '').replace(/\\/g, '/');
  const abs = path.resolve(WORKSPACE, '.' + (rel.startsWith('/') ? rel : '/' + rel));
  if (abs !== WORKSPACE && !abs.startsWith(WORKSPACE + path.sep)) throw new Error('chemin hors du dossier de travail');
  return abs;
}

function send(res, status, body, headers = {}) {
  const isText = typeof body === 'string' || Buffer.isBuffer(body);
  const payload = isText ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': isText ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers
  });
  res.end(payload);
}

const json = (res, status, body) => send(res, status, body);

function readBody(req, limit = 64 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('corps de requête trop volumineux'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString('utf8')); } catch { throw new Error('JSON invalide'); }
}

function cors(req, res) {
  const origin = req.headers.origin || '';
  if (/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'origin');
    res.setHeader('access-control-allow-headers', 'content-type, x-runner-token');
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-private-network', 'true');
  }
}

function authorized(req) {
  if (!TOKEN) return true;
  const given = req.headers['x-runner-token'] || '';
  return given.length === TOKEN.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(TOKEN));
}

/* ---------------------------------------------------------------- workspace */

async function listFiles() {
  const out = [];
  async function walk(dir, prefix, depth) {
    if (depth > 4 || out.length > 600) return;
    let entries = [];
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (out.length > 600) return;
      if (entry.name.startsWith('.') && entry.name !== '.makefun') continue;
      const rel = prefix ? prefix + '/' + entry.name : entry.name;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(path.join(dir, entry.name), rel, depth + 1);
      } else if (entry.isFile()) {
        let size = 0;
        try { size = (await fsp.stat(path.join(dir, entry.name))).size; } catch { }
        out.push({ path: rel, size });
      }
    }
  }
  await walk(WORKSPACE, '', 0);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

async function findKits() {
  const kits = [];
  const entries = await fsp.readdir(WORKSPACE, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const rules = path.join(WORKSPACE, entry.name, 'RULES.txt');
    const cli = path.join(WORKSPACE, entry.name, 'cli', 'makefun.mjs');
    if (fs.existsSync(rules) || fs.existsSync(cli)) {
      kits.push({ dir: entry.name, slug: entry.name.replace(/-kit$/, '') });
    }
  }
  return kits;
}

async function currentKit(preferred) {
  const kits = await findKits();
  if (preferred) {
    const hit = kits.find((k) => k.dir === preferred || k.slug === preferred);
    if (hit) return hit;
  }
  return kits[0] || null;
}

async function exec(command, args, cwd) {
  if (!COMMANDS.has(command)) throw new Error('commande non autorisée: ' + command);
  const workdir = cwd ? safePath(cwd) : WORKSPACE;
  if (!fs.existsSync(workdir)) throw new Error('dossier introuvable: ' + (cwd || '.'));
  const result = spawnSync(command, args, {
    cwd: workdir,
    encoding: 'utf8',
    timeout: 5 * 60 * 1000,
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
  });
  const stdout = (result.stdout || '').slice(-60000);
  const stderr = (result.stderr || '').slice(-30000);
  const code = typeof result.status === 'number' ? result.status : 1;
  return { ok: code === 0, code, command: command + ' ' + args.join(' '), cwd: cwd || '.', stdout, stderr };
}

/* ---------------------------------------------------------------- make.fun */

async function makefun(pathname, init) {
  const res = await fetch(ORIGIN + pathname, {
    ...init,
    headers: { accept: 'application/json', 'user-agent': 'ai-agent-multi-model (phone runner)', ...(init?.headers || {}) }
  });
  const text = await res.text();
  if (!res.ok) throw new Error('make.fun HTTP ' + res.status + ' : ' + text.slice(0, 300));
  return JSON.parse(text);
}

function compactQuest(item) {
  return {
    slug: item.slug || item.id,
    title: item.title || item.slug,
    reward: item.rewardAmount ?? item.reward ?? null,
    deadline: item.deadline || null,
    entries: item.submissionCount ?? null,
    category: item.category || null,
    url: item.url ? ORIGIN + item.url : ORIGIN + '/bounty/' + (item.slug || item.id),
    summary: (item.description || '').slice(0, 600)
  };
}

async function downloadKit(slug) {
  if (!SLUG_RE.test(slug)) throw new Error('slug invalide');
  const archive = path.join(WORKSPACE, 'kits', slug + '.tar.gz');
  await fsp.mkdir(path.dirname(archive), { recursive: true });
  const response = await fetch(ORIGIN + '/c/' + encodeURIComponent(slug) + '/kit', {
    headers: { 'user-agent': 'ai-agent-multi-model (phone runner)' }
  });
  if (!response.ok) throw new Error('kit HTTP ' + response.status);
  await fsp.writeFile(archive, Buffer.from(await response.arrayBuffer()));
  const result = spawnSync('tar', ['xzf', archive, '-C', WORKSPACE], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('extraction impossible : ' + (result.stderr || 'tar'));
  const kit = await currentKit(slug + '-kit');
  return { ok: true, slug, archive: path.relative(WORKSPACE, archive), kit: kit ? kit.dir : null };
}

/* ---------------------------------------------------------------- routes */

const server = http.createServer(async (req, res) => {
  cors(req, res);
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (!url.pathname.startsWith('/api/')) {
    if (url.pathname === '/' || url.pathname === '/index.html') {
      try {
        const html = await fsp.readFile(path.join(ROOT, 'index.html'));
        return send(res, 200, html, { 'content-type': 'text/html; charset=utf-8' });
      } catch {
        return send(res, 404, 'index.html manquant à côté de server.js');
      }
    }
    return send(res, 404, 'introuvable');
  }

  if (!authorized(req)) return json(res, 401, { ok: false, error: 'jeton du runner invalide' });

  try {
    /* --- état / fichiers --- */
    if (url.pathname === '/api/runner/status' && req.method === 'GET') {
      const kits = await findKits();
      return json(res, 200, {
        ok: true,
        workspace: WORKSPACE,
        platform: process.platform,
        node: process.version,
        token_required: !!TOKEN,
        keypair: fs.existsSync(path.join(WORKSPACE, 'makefun-keypair.json')),
        kits
      });
    }

    if (url.pathname === '/api/runner/list') {
      return json(res, 200, { ok: true, files: await listFiles() });
    }

    if (url.pathname === '/api/runner/read' && req.method === 'POST') {
      const { path: rel } = await readJson(req);
      const abs = safePath(rel);
      const content = await fsp.readFile(abs, 'utf8');
      return json(res, 200, { ok: true, path: rel, content });
    }

    if (url.pathname === '/api/runner/write' && req.method === 'POST') {
      const { path: rel, content } = await readJson(req);
      const abs = safePath(rel);
      await fsp.mkdir(path.dirname(abs), { recursive: true });
      await fsp.writeFile(abs, String(content ?? ''), 'utf8');
      return json(res, 200, { ok: true, path: rel });
    }

    /* --- exécution --- */
    if (url.pathname === '/api/runner/exec' && req.method === 'POST') {
      const { command, args = [], cwd } = await readJson(req);
      return json(res, 200, await exec(String(command || ''), Array.isArray(args) ? args.map(String) : [], cwd));
    }

    /* --- paire de clés Solana (format solana-keygen) --- */
    if (url.pathname === '/api/runner/keypair' && req.method === 'POST') {
      const file = path.join(WORKSPACE, 'makefun-keypair.json');
      if (fs.existsSync(file)) {
        const bytes = JSON.parse(fs.readFileSync(file, 'utf8'));
        return json(res, 200, { ok: true, existed: true, wallet: base58(Buffer.from(bytes.slice(32, 64))) });
      }
      const { privateKey } = crypto.generateKeyPairSync('ed25519');
      const jwk = privateKey.export({ format: 'jwk' });
      const secret = Buffer.from(jwk.d, 'base64url');
      const publicKey = Buffer.from(jwk.x, 'base64url');
      const bytes = [...secret, ...publicKey];
      fs.writeFileSync(file, JSON.stringify(bytes), { mode: 0o600, flag: 'wx' });
      return json(res, 200, { ok: true, existed: false, wallet: base58(publicKey) });
    }

    /* --- kit --- */
    if (url.pathname === '/api/runner/kit' && req.method === 'POST') {
      const { slug } = await readJson(req);
      return json(res, 200, await downloadKit(String(slug || '')));
    }

    if (url.pathname === '/api/runner/upload-kit' && req.method === 'POST') {
      const name = path.basename(url.searchParams.get('name') || 'kit.tar.gz');
      if (!/\.tar\.gz$/i.test(name)) throw new Error('archive .tar.gz attendue');
      const archive = path.join(WORKSPACE, 'kits', name);
      await fsp.mkdir(path.dirname(archive), { recursive: true });
      await fsp.writeFile(archive, await readBody(req));
      const result = spawnSync('tar', ['xzf', archive, '-C', WORKSPACE], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error('extraction impossible : ' + (result.stderr || 'tar'));
      const slug = name.replace(/\.tar\.gz$/i, '');
      const kit = await currentKit(slug + '-kit');
      return json(res, 200, { ok: true, filename: name, slug, extracted: !!kit, kit: kit ? kit.dir : null });
    }

    /* --- relais API make.fun (évite les blocages CORS du navigateur) --- */
    if (url.pathname === '/api/makefun/competitions' && req.method === 'GET') {
      const status = url.searchParams.get('status') || 'open';
      const data = await makefun('/api/competitions?status=' + encodeURIComponent(status));
      const items = (data.items || data.competitions || []).map(compactQuest);
      return json(res, 200, { ok: true, items });
    }

    if (url.pathname === '/api/makefun/requirements' && req.method === 'GET') {
      const slug = url.searchParams.get('slug') || '';
      if (!SLUG_RE.test(slug)) throw new Error('slug invalide');
      const data = await makefun('/api/competitions/' + encodeURIComponent(slug) + '/requirements');
      return json(res, 200, { ok: true, requirements: data });
    }

    if (url.pathname === '/api/makefun/competition' && req.method === 'GET') {
      const slug = url.searchParams.get('slug') || '';
      if (!SLUG_RE.test(slug)) throw new Error('slug invalide');
      return json(res, 200, { ok: true, quest: compactQuest(await makefun('/api/competitions/' + encodeURIComponent(slug))) });
    }

    return json(res, 404, { ok: false, error: 'route inconnue' });
  } catch (error) {
    return json(res, 400, { ok: false, error: error.message || String(error) });
  }
});

function base58(buffer) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = 0n;
  for (const byte of buffer) value = value * 256n + BigInt(byte);
  let text = '';
  while (value > 0n) {
    text = alphabet[Number(value % 58n)] + text;
    value /= 58n;
  }
  for (const byte of buffer) {
    if (byte !== 0) break;
    text = '1' + text;
  }
  return text;
}

server.listen(PORT, HOST, () => {
  const urls = ['http://127.0.0.1:' + PORT];
  if (HOST !== '127.0.0.1' && HOST !== 'localhost') {
    for (const list of Object.values(os.networkInterfaces())) {
      for (const net of list || []) {
        if (net.family === 'IPv4' && !net.internal) urls.push('http://' + net.address + ':' + PORT);
      }
    }
  }
  console.log('Runner prêt. Dossier de travail : ' + WORKSPACE);
  console.log('Ouvre dans le navigateur du téléphone : ' + urls.join('  ou  '));
  if (TOKEN) console.log('Jeton exigé : celui de RUNNER_TOKEN (à saisir dans l’app, onglet Quête).');
});
