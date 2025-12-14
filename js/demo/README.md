# Hackathon Shinanigans: E2B Sandbox & Vercel Deploy

A demo application showcasing:
1. Running code in E2B sandboxes
2. Deploying files to Vercel with custom subdomains

wip
<img width="970" height="362" alt="Screenshot 2025-12-13 at 6 53 54 PM" src="https://github.com/user-attachments/assets/35e71588-8883-47b4-b10c-9947af003d83" />

## Environment Variables

Create a `.env` file in the repository root or in the `js/` directory:

```bash
# E2B Sandbox
E2B_API_KEY=your_e2b_api_key_here

# Vercel Deployment
VERCEL_API_KEY=your_vercel_token_here
VERCEL_TEAM_ID=team_xxxxxxxxxxxxx
VERCEL_ROOT_DOMAIN=yourdomain.com
```

### Where to get these:

- **E2B_API_KEY**: Get from [e2b.dev](https://e2b.dev)
- **VERCEL_API_KEY**: Generate at [vercel.com/account/tokens](https://vercel.com/account/tokens)
- **VERCEL_TEAM_ID**: Find in your team settings URL: `vercel.com/teams/[TEAM_ID]/settings`
- **VERCEL_ROOT_DOMAIN**: this is the triky bit. need to follow vercel wildcard rules: https://vercel.com/blog/wildcard-domains. You have to add the wildcard to ANY project i think so you end up with like a default project; not actually sure on this one, spent way too much time bashing head into this one.

## Installation & Running

```bash
cd js/demo
npm install
npm start
```

Server runs on `http://localhost:3000`

## Usage

### Vercel Deployment (Simplified)

1. Go to "Vercel project" tab → "Deploy files" section
2. Enter a **Name** (e.g., `test1`) - used for subdomain and deployment title
3. Optionally enter a **Message** - custom text displayed on the page
4. Click "Deploy files"

**Result**: Deploys to `test1.yourdomain.com` with your custom message

**Subsequent deployments**: Just change the name to deploy another subdomain - the frontend automatically reuses the project and team ID.

## How It Works

- **Root domain**: Must be added to Vercel account first (one-time setup)
- **Subdomains**: Created automatically when you deploy
- **No alias needed**: Adding the domain to the project makes it available automatically

## next: 
can i hack it into the sandbox
