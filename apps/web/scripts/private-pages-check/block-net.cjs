// Preloaded into the dev server run.mjs starts: no host name outside this
// machine resolves, so nothing the site fetches (Sanity, Supabase, Resend)
// leaves the machine; each such fetch fails and the site uses its fallback.
const dns = require("node:dns");
const local = (h) => /^(localhost|127\.0\.0\.1|::1|\[::1\])$/i.test(String(h));
const fail = (host) => Object.assign(new Error(`blocked by private-pages-check: ${host}`), { code: "ENOTFOUND" });
const lookup = dns.lookup;
dns.lookup = function (host, opts, cb) {
  if (!local(host)) {
    const done = typeof opts === "function" ? opts : cb;
    process.nextTick(() => done(fail(host)));
    return {};
  }
  return lookup.apply(this, arguments);
};
const plookup = dns.promises.lookup;
dns.promises.lookup = (host, ...rest) => (local(host) ? plookup(host, ...rest) : Promise.reject(fail(host)));
