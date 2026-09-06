# Custom Emoji ID Extractor Bot

A Telegram bot built on the **Telegram Serverless (`tgcloud`)** platform. The bot allows users to extract the ID, button code, and caption code of any Premium Custom Emoji sent to it.

## Features
- **Emoji Extraction**: Forwards or direct messages containing custom emojis are processed to extract useful IDs and HTML snippet codes.
- **Inline Buttons**: Returns a neat list of emojis with inline buttons for 1-tap copying of the IDs and codes.
- **User Tracking (DB)**: Stores all interacting users in a SQLite database, tracking their `first_name`, `username`, `language_code`, premium status, and `last_active` timestamp.
- **Admin Stats Panel**: Displays total bot statistics (total users, premium count, top languages) formatted nicely via the `/stats` command.
- **Admin JSON Export**: Exports the complete user list as a clean JSON file via the `/export` command.

## Tech Stack
- Platform: Telegram Serverless (`@tgcloud/bot`)
- Database: Built-in Drizzle-like SDK (`sdk/db`)
- API Wrapper: Built-in Native SDK (`sdk/api`)
- Language: Modern ES6 JavaScript

## Commands
### User Commands
- `/start` or `/test` - Welcome message & bot instructions.

### Admin Commands
- `/stats` - View total users, premium users, and top languages.
- `/export` - Download the database of all users as a `users_export.json` file.

## Setup & Deployment
To run or deploy this project locally, make sure you have linked it to your bot token via the `tgcloud` CLI.

```bash
# Login to your bot
npx tgcloud login

# Push code to the cloud
npm run deploy

# Migrate database (if schema changed)
npx tgcloud migrate

# Check status
npm run status
```

*Developed as a clean, serverless port of a legacy Python bot.*
