import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const frame = (content) =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PromiseProof demo</title><style>body{background:#edf2f8;color:#182b46;font:16px/1.6 system-ui;margin:0;display:grid;place-items:center;min-height:100vh}main{background:white;max-width:640px;width:90%;padding:40px;border-radius:16px;border:1px solid #d5dfec;box-sizing:border-box}h1{line-height:1.2}label{display:block;margin-top:18px}input,select{display:block;width:100%;padding:12px;border:1px solid #a5b4c9;border-radius:6px;box-sizing:border-box;font:inherit}button{background:#365bd9;border:0;border-radius:6px;padding:12px 20px;color:white;font:inherit;margin-top:20px;cursor:pointer}a{color:#365bd9}.mark{color:#365bd9;letter-spacing:2px;font-size:12px;font-weight:800;text-transform:uppercase}[role=status]{color:#08734f;font-weight:700}</style><main><div class="mark">PromiseProof · test fixture</div>${content}</main></html>`;
const form = (broken) =>
  frame(
    `<h1>${broken ? 'The form that lies' : 'A form that saves'}</h1><p>${broken ? 'The UI will claim success. The test API will expose the missing record.' : 'Submit a synthetic contact and independently verify its saved record.'}</p><form><label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label><button>Save contact</button></form><p role="status" id="status">Ready</p><script>document.querySelector('form').addEventListener('submit',async e=>{e.preventDefault();const fields=new FormData(e.target);const response=await fetch('/api/contacts${broken ? '?broken=1' : ''}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(fields))});if(response.ok)document.querySelector('#status').textContent='Success';});</script>`,
  );

export function createDemoServer() {
  const contacts = new Map();
  const invites = new Map();
  const memberships = new Set();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const json = (status, body, headers = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
      res.end(JSON.stringify(body));
    };
    const html = (body, headers = {}) => {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        ...headers,
      });
      res.end(body);
    };
    const cookie = (name) =>
      (req.headers.cookie ?? '')
        .split('; ')
        .find((c) => c.startsWith(`${name}=`))
        ?.slice(name.length + 1);
    try {
      if (url.pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (url.pathname === '/')
        return html(
          frame(
            '<h1>PromiseProof demo</h1><p>Real browser actions. Independent outcome checks.</p><p><a href="/form">Passing form</a> · <a href="/broken">Broken form</a> · <a href="/invite">Invitation workflow</a></p>',
          ),
        );
      if (url.pathname === '/form' || url.pathname === '/broken') {
        const headers = cookie('fixture')
          ? {}
          : {
              'Set-Cookie':
                'fixture=' +
                randomUUID() +
                '; HttpOnly; SameSite=Strict; Path=/',
            };
        return html(form(url.pathname === '/broken'), headers);
      }
      if (url.pathname === '/api/contacts' && req.method === 'POST') {
        const data = JSON.parse(await readBody(req));
        if (!data.name || !data.email || !cookie('fixture'))
          return json(400, { error: 'Name and email required' });
        if (!url.searchParams.has('broken'))
          contacts.set(cookie('fixture') + '|' + data.email, {
            name: data.name,
            email: data.email,
          });
        return json(201, { success: true }); // Intentional bug: broken route omits persistence.
      }
      if (url.pathname === '/api/contacts')
        return json(200, {
          record:
            contacts.get(
              cookie('fixture') + '|' + url.searchParams.get('email'),
            ) ?? null,
        });
      if (url.pathname === '/login')
        return html(
          frame(
            '<h1>Sender test login</h1><p>This is a synthetic, loopback-only account.</p><button>Sign in as sender</button><script>document.querySelector("button").onclick=async()=>{await fetch("/api/login",{method:"POST"});location.href="/invite"}</script>',
          ),
        );
      if (url.pathname === '/api/login' && req.method === 'POST')
        return json(
          200,
          { signedIn: true },
          { 'Set-Cookie': 'sender=demo; HttpOnly; SameSite=Strict; Path=/' },
        );
      if (url.pathname === '/invite') {
        if (cookie('sender') !== 'demo') {
          res.writeHead(302, { Location: '/login' });
          res.end();
          return;
        }
        return html(
          frame(
            '<h1>Invite a teammate</h1><form><label>Teammate email<input type="email" name="email" required></label><button>Invite teammate</button></form><p role="status">Ready</p><script>document.querySelector("form").onsubmit=async e=>{e.preventDefault();const response=await fetch("/api/invites",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});if(response.ok)document.querySelector("[role=status]").textContent="Invitation created"}</script>',
          ),
        );
      }
      if (url.pathname === '/api/invites' && cookie('sender') !== 'demo')
        return json(401, { error: 'Sender test session required' });
      if (url.pathname === '/api/invites' && req.method === 'POST') {
        const { email } = JSON.parse(await readBody(req));
        if (typeof email !== 'string' || !email.endsWith('.test'))
          return json(400, { error: 'Synthetic .test email required' });
        const invitation = { email, accepted: false, token: randomUUID() };
        invites.set(email, invitation);
        return json(201, { created: true });
      }
      if (url.pathname === '/api/invites') {
        const invite = invites.get(url.searchParams.get('email'));
        return json(200, {
          created: Boolean(invite),
          accepted: invite?.accepted ?? false,
          link: invite ? `/accept?token=${invite.token}` : null,
        });
      }
      if (url.pathname === '/accept')
        return html(
          frame(
            '<h1>Accept your invitation</h1><button>Accept invitation</button><p role="status">Pending</p><script>document.querySelector("button").onclick=async()=>{const response=await fetch("/api/accept"+location.search,{method:"POST"});if(response.ok)location.href="/workspace";else document.querySelector("[role=status]").textContent="Acceptance failed"}</script>',
          ),
        );
      if (url.pathname === '/api/accept' && req.method === 'POST') {
        const invite = [...invites.values()].find(
          (i) => i.token === url.searchParams.get('token'),
        );
        if (!invite) return json(404, { error: 'Unknown invitation' });
        invite.accepted = true;
        memberships.add(invite.email);
        return json(
          200,
          { accepted: true },
          {
            'Set-Cookie': `member=${encodeURIComponent(invite.email)}; HttpOnly; SameSite=Strict; Path=/`,
          },
        );
      }
      if (url.pathname === '/workspace')
        return html(
          frame(
            memberships.has(decodeURIComponent(cookie('member') ?? ''))
              ? '<h1>Acme workspace</h1><p role="status">You are a member</p>'
              : '<h1>Access denied</h1>',
          ),
        );
      if (url.pathname === '/api/membership')
        return json(200, {
          member: memberships.has(decodeURIComponent(cookie('member') ?? '')),
          workspace: 'Acme',
        });
      if (url.pathname === '/errors')
        return html(
          frame(
            '<h1>Browser error fixture</h1><script>console.error("Synthetic browser error");throw new Error("Synthetic crash")</script>',
          ),
        );
      if (url.pathname === '/controls')
        return html(
          frame(
            '<h1>Controls</h1><label>Plan<select aria-label="Plan"><option value="free">Free</option><option value="pro">Pro</option></select></label><label><input type="checkbox" aria-label="Accept terms">Accept terms</label><label>Required input<input required></label><p role="status">Pending</p><button onclick="document.querySelector(\'[role=status]\').textContent=\'Done\'">Complete</button>',
          ),
        );
      if (url.pathname === '/redirect-external') {
        res.writeHead(302, { Location: 'http://127.0.0.1:1/forbidden' });
        res.end();
        return;
      }
      return json(404, { error: 'Not found' });
    } catch {
      return json(500, { error: 'Fixture request failed' });
    }
  });
  return server;
}
async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 65536) throw new Error('Fixture body too large');
  }
  return body;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createDemoServer();
  server.listen(Number(process.env.PORT ?? 4173), '127.0.0.1', () =>
    console.log(`PromiseProof demo: http://127.0.0.1:${server.address().port}`),
  );
  const close = () => server.close(() => process.exit(0));
  process.on('SIGTERM', close);
  process.on('SIGINT', close);
}
