package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
)

type Token struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
}

type Reminder struct {
	ChannelIds       []string `json:"channelIds"`
	Cron             string   `json:"cron"`
	Timezone         string   `json:"timezone"`
	SenderId         string   `json:"senderId"`
	TextMessage      string   `json:"textMessage"`
	UseAnnouncements bool     `json:"useAnnouncements"`
}

type ChatMessagePayload struct {
	BroadcasterId string `json:"broadcaster_id"`
	SenderId      string `json:"sender_id"`
	Message       string `json:"message"`
	ForSourceOnly bool   `json:"for_source_only"`
}

type ChatAnnouncementPayload struct {
	Message       string `json:"message"`
	Color         string `json:"color,omitempty"`
	ForSourceOnly bool   `json:"for_source_only"`
}

var token Token

func init() {
	godotenv.Load()
}

// convertCronExpression converts 6-field cron (second-precision) to 5-field (minute-precision)
// by removing the seconds field
func convertCronExpression(expr string) string {
	fields := strings.Fields(expr)
	if len(fields) == 6 {
		// node-cron uses: second minute hour day month weekday
		// Go cron uses: minute hour day month weekday
		// Remove the first field (seconds)
		return strings.Join(fields[1:], " ")
	}
	return expr
}

func getToken() error {
	clientID := os.Getenv("TWITCH_CLIENT_ID")
	clientSecret := os.Getenv("TWITCH_CLIENT_SECRET")

	params := url.Values{}
	params.Add("client_id", clientID)
	params.Add("client_secret", clientSecret)
	params.Add("grant_type", "client_credentials")

	resp, err := http.PostForm("https://id.twitch.tv/oauth2/token", params)
	if err != nil {
		return fmt.Errorf("failed to get token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to get token: %d %s", resp.StatusCode, string(body))
	}

	err = json.NewDecoder(resp.Body).Decode(&token)
	if err != nil {
		return fmt.Errorf("failed to parse token response: %w", err)
	}

	return nil
}

func sendChatMessage(broadcasterId, senderId, message string) bool {
	payload := ChatMessagePayload{
		BroadcasterId: broadcasterId,
		SenderId:      senderId,
		Message:       message,
		ForSourceOnly: false,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal payload: %v\n", err)
		return false
	}

	req, err := http.NewRequest("POST", "https://api.twitch.tv/helix/chat/messages", bytes.NewBuffer(body))
	if err != nil {
		log.Printf("Failed to create request: %v\n", err)
		return false
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token.AccessToken))
	req.Header.Set("Client-ID", os.Getenv("TWITCH_CLIENT_ID"))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to send message: %v\n", err)
		return false
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var respJSON interface{}
	json.Unmarshal(respBody, &respJSON)
	respFormatted, _ := json.MarshalIndent(respJSON, "", "  ")

	log.Printf("%d: %s -> %s\n%s\n", resp.StatusCode, senderId, broadcasterId, string(respFormatted))

	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

func sendChatAnnouncement(broadcasterId, senderId, message, color string) bool {
	payload := ChatAnnouncementPayload{
		Message:       message,
		Color:         color,
		ForSourceOnly: false,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal payload: %v\n", err)
		return false
	}

	params := url.Values{}
	params.Add("broadcaster_id", broadcasterId)
	params.Add("moderator_id", senderId)

	req, err := http.NewRequest(
		"POST",
		fmt.Sprintf("https://api.twitch.tv/helix/chat/announcements?%s", params.Encode()),
		bytes.NewBuffer(body),
	)
	if err != nil {
		log.Printf("Failed to create request: %v\n", err)
		return false
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token.AccessToken))
	req.Header.Set("Client-ID", os.Getenv("TWITCH_CLIENT_ID"))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to send announcement: %v\n", err)
		return false
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	log.Printf("%d: %s -> %s\n%s\n", resp.StatusCode, senderId, broadcasterId, string(respBody))

	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

func handleReminder(channelIds []string, senderId, textMessage string, useAnnouncements bool) {
	err := getToken()
	if err != nil {
		log.Printf("Failed to get token: %v\n", err)
		return
	}

	for _, channelId := range channelIds {
		if useAnnouncements {
			sendChatAnnouncement(channelId, senderId, textMessage, "")
		} else {
			sendChatMessage(channelId, senderId, textMessage)
		}
	}
}

func main() {
	configData, err := os.ReadFile(".config.json")
	if err != nil {
		log.Fatalf("Failed to read config file: %v\n", err)
	}

	var reminders []Reminder
	err = json.Unmarshal(configData, &reminders)
	if err != nil {
		log.Fatalf("Failed to parse config file: %v\n", err)
	}

	for _, reminder := range reminders {
		log.Printf("Schedule job: %+v\n", reminder)

		loc, err := time.LoadLocation(reminder.Timezone)
		if err != nil {
			log.Printf("Failed to load timezone %s: %v\n", reminder.Timezone, err)
			continue
		}

		cr := cron.New(cron.WithLocation(loc))

		rem := reminder
		cronExpr := convertCronExpression(rem.Cron)
		_, err = cr.AddFunc(cronExpr, func() {
			handleReminder(rem.ChannelIds, rem.SenderId, rem.TextMessage, rem.UseAnnouncements)
		})
		if err != nil {
			log.Printf("Failed to add cron job: %v\n", err)
			continue
		}

		cr.Start()
	}

	select {}
}
