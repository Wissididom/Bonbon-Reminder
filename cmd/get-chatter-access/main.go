package main

import (
	"bufio"
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
)

type UserResponse struct {
	Data []User `json:"data"`
}

type User struct {
	ID          string `json:"id"`
	Login       string `json:"login"`
	DisplayName string `json:"display_name"`
}

type DeviceCodeFlow struct {
	DeviceCode      string `json:"device_code"`
	UserCode        string `json:"user_code"`
	VerificationURI string `json:"verification_uri"`
	ExpiresIn       int    `json:"expires_in"`
	Interval        int    `json:"interval"`
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

var token TokenResponse

func init() {
	godotenv.Load()
}

func checkEnv() error {
	clientID := os.Getenv("TWITCH_CLIENT_ID")
	clientSecret := os.Getenv("TWITCH_CLIENT_SECRET")

	if clientID == "" || clientSecret == "" {
		return fmt.Errorf("TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET env vars are required")
	}
	return nil
}

func getUser(accessToken, login string) (*User, error) {
	clientID := os.Getenv("TWITCH_CLIENT_ID")

	apiURL := "https://api.twitch.tv/helix/users"
	if login != "" {
		apiURL = fmt.Sprintf("https://api.twitch.tv/helix/users?login=%s", login)
	}

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Client-ID", clientID)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", accessToken))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user: %w", err)
	}
	defer resp.Body.Close()

	var userResp UserResponse
	if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
		return nil, fmt.Errorf("failed to parse user response: %w", err)
	}

	if len(userResp.Data) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	return &userResp.Data[0], nil
}

func getAccountAccess(chatter, announcements bool) error {
	if err := checkEnv(); err != nil {
		return err
	}

	clientID := os.Getenv("TWITCH_CLIENT_ID")

	var scopes string
	if chatter {
		if announcements {
			scopes = "user:write:chat user:bot moderator:manage:announcements"
		} else {
			scopes = "user:write:chat user:bot"
		}
	} else {
		scopes = "channel:bot"
	}

	encodedScopes := url.QueryEscape(scopes)
	fmt.Printf("Scopes: %s\n", encodedScopes)

	// Request device code
	dcfURL := fmt.Sprintf(
		"https://id.twitch.tv/oauth2/device?client_id=%s&scopes=%s",
		clientID,
		encodedScopes,
	)

	resp, err := http.Post(dcfURL, "application/x-www-form-urlencoded", nil)
	if err != nil {
		return fmt.Errorf("failed to request device code: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to request device code: %d %s", resp.StatusCode, string(body))
	}

	var dcf DeviceCodeFlow
	if err := json.NewDecoder(resp.Body).Decode(&dcf); err != nil {
		return fmt.Errorf("failed to parse device code response: %w", err)
	}

	fmt.Printf("Open %s in a browser and enter %s there!\n", dcf.VerificationURI, dcf.UserCode)

	// Poll for token
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	timeout := time.After(time.Duration(dcf.ExpiresIn) * time.Second)

	for {
		select {
		case <-ticker.C:
			tokenURL := fmt.Sprintf(
				"https://id.twitch.tv/oauth2/token?client_id=%s&scopes=%s&device_code=%s&grant_type=urn:ietf:params:oauth:grant-type:device_code",
				clientID,
				encodedScopes,
				dcf.DeviceCode,
			)

			tokenResp, err := http.Post(tokenURL, "application/x-www-form-urlencoded", nil)
			if err != nil {
				continue
			}

			if tokenResp.StatusCode == 400 {
				tokenResp.Body.Close()
				continue
			}

			if tokenResp.StatusCode >= 200 && tokenResp.StatusCode < 300 {
				if err := json.NewDecoder(tokenResp.Body).Decode(&token); err != nil {
					tokenResp.Body.Close()
					return fmt.Errorf("failed to parse token response: %w", err)
				}
				tokenResp.Body.Close()

				user, err := getUser(token.AccessToken, "")
				if err != nil {
					return fmt.Errorf("failed to get user info: %w", err)
				}

				userType := "Chatter"
				if !chatter {
					userType = "Streamer"
				}
				fmt.Printf("Got Device Code Flow Tokens for %s %s (%s)\n", userType, user.DisplayName, user.Login)
				return nil
			}

			tokenResp.Body.Close()

		case <-timeout:
			return fmt.Errorf("device code flow timed out")
		}
	}
}

func promptBool(prompt string) bool {
	reader := bufio.NewReader(os.Stdin)
	fmt.Print(prompt + " (yes/no): ")
	response, _ := reader.ReadString('\n')
	response = strings.ToLower(strings.TrimSpace(response))
	return response == "yes" || response == "y"
}

func main() {
	log.SetFlags(log.Lshortfile)

	announcements := promptBool("Do you want to be able to send announcements with this authorization?")
	if err := getAccountAccess(true, announcements); err != nil {
		log.Fatalf("Failed to get chatter access: %v\n", err)
	}
}
