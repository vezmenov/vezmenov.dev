# vezmenov.dev

Static one-page business card (Vite).

## Local

```bash
nvm use  # optional (uses .nvmrc)
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

## Deploy (Cloudflare Pages)

Recommended: connect the GitHub repo in Cloudflare Pages.

1. Cloudflare Dashboard -> Pages -> Create a project -> Connect to Git.
2. Pick this repo.
3. Build settings:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Deploy.
5. Add a custom domain:
   - `vezmenov.dev` (apex)
   - optional: `www.vezmenov.dev` -> redirect to apex (a redirect rule also exists in `public/_redirects`)

## Deploy (GitHub Actions, optional)

If you prefer to deploy from GitHub Actions, set these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Then adjust the Cloudflare Pages project name in `.github/workflows/deploy.yml` if needed.
(The workflow is automatically skipped until the secrets exist.)

## Content

Edit copy/links in:

- `index.html`
