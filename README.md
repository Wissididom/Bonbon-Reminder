# Bonbon Reminder

A Twitch bot reminder tool that sends scheduled chat messages and announcements using Twitch's app access tokens.

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

## API Reference

The tool uses the Twitch Helix API:
- [Send Chat Message](https://dev.twitch.tv/docs/api/reference/#send-chat-message)
- [Send Chat Announcement](https://dev.twitch.tv/docs/api/reference/#send-chat-announcement)
- [OAuth Token Generation](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow)
