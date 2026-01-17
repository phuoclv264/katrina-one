# Running the dev server over HTTPS (local)

This project includes a convenient npm script to run the Next.js dev server over HTTPS.

## 1) New npm script (already added)

Run with:

```
npm run dev:https
```

This runs `next dev --https --ssl-cert ./certs/localhost.pem --ssl-key ./certs/localhost-key.pem -p 9002`.

## 2) Create and trust a local certificate (recommended)

Install mkcert (Windows):
- With Chocolatey: `choco install mkcert` (run from elevated shell)
- Or download the mkcert binary from https://github.com/FiloSottile/mkcert/releases and add it to your PATH

Generate and store cert/key in `./certs/` (from project root):

```
mkdir certs
mkcert -cert-file certs/localhost.pem -key-file certs/localhost-key.pem localhost 127.0.0.1 ::1
```

Trust the CA (mkcert typically runs `mkcert -install` automatically; if not, run it once):

```
mkcert -install
```

Now run the HTTPS dev server:

```
npm run dev:https
```

Open: https://localhost:9002


## 3) If `next dev --https` isn't available (fallbacks)

A) ngrok (fast & easy):

1. Start the normal dev server: `npm run dev`
2. Open a tunnel: `ngrok http 9002`
3. Use the `https://...` url ngrok prints.

B) local-ssl-proxy (proxy with cert/key):

1. `npm i -D local-ssl-proxy`
2. Generate certs as above
3. Run: `local-ssl-proxy --source 3443 --target 9002 --cert ./certs/localhost.pem --key ./certs/localhost-key.pem`
4. Visit https://localhost:3443


## Notes & troubleshooting
- Your browser may still block mixed content or cached HSTS settings; clear site data if switching schemes.
- Ensure the paths `./certs/localhost.pem` and `./certs/localhost-key.pem` match the files you generated.
- The repo `.gitignore` already ignores `*.pem` files so certs won't be committed.

If you want, I can add a small script to auto-run mkcert or add a `README` section — tell me which option you prefer.