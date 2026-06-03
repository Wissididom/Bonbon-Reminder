# Bonbon Reminder

A Twitch bot reminder tool that sends scheduled chat messages and announcements using Twitch's app access tokens.

## Migration to Go

This project has been migrated from Deno/TypeScript to Go while maintaining **exact functional parity**:

### Key Features
- **Cron scheduling**: Schedule reminders at specific times and timezones
- **Chat messages**: Send regular messages to Twitch chat
- **Announcements**: Send highlighted announcements to Twitch channels
- **Multi-channel support**: Send reminders to multiple channels simultaneously
- **Timezone aware**: Run jobs in specified timezones using the IANA timezone database

### Technical Details
- **Language**: Go 1.21+
- **Scheduler**: `github.com/robfig/cron/v3` (cron expression library)
- **Authentication**: Twitch OAuth app access tokens (client credentials grant flow)
- **Configuration**: JSON-based config with environment variables

## Configuration

### Environment Variables
Create a `.env` file with:
```
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
```

### Config File
Create a `.config.json` file with reminder definitions:
```json
[
  {
    "channelIds": ["123456789"],
    "cron": "0 0 7 * * *",
    "timezone": "Europe/Berlin",
    "senderId": "987654321",
    "textMessage": "@User Your reminder message",
    "useAnnouncements": false
  }
]
```

#### Configuration Options
- **channelIds**: Array of Twitch channel IDs to send reminders to
- **cron**: Cron expression (6-field format with seconds support, auto-converted to 5-field for Go)
- **timezone**: IANA timezone for scheduling (e.g., "Europe/Berlin", "America/New_York")
- **senderId**: Twitch user ID of the bot account
- **textMessage**: Message content to send
- **useAnnouncements**: Boolean - use chat announcement endpoint if true, regular message if false

## Running

### Build
```bash
go build -o bonbon-reminder .
```

### Run
```bash
./bonbon-reminder
```

### Docker
```bash
docker-compose up
```

## Building Docker Image
```bash
docker build -t bonbon-reminder .
```

## Migration Notes

- **Cron Format**: Automatically converts 6-field cron expressions (node-cron format) to 5-field (Go cron format) by removing the seconds field
- **Dependencies**: Replaced `node-cron` with `github.com/robfig/cron/v3` and `dotenv` with `github.com/joho/godotenv`
- **Binary Size**: Single executable, no runtime dependencies required
- **Performance**: Improved startup time and lower memory footprint compared to Deno runtime

## API Reference

The tool uses the Twitch Helix API:
- [Send Chat Message](https://dev.twitch.tv/docs/api/reference/#send-chat-message)
- [Send Chat Announcement](https://dev.twitch.tv/docs/api/reference/#send-chat-announcement)
- [OAuth Token Generation](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow)
