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

type Token struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
}

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

func getToken() (*Token, error) {
	clientID := os.Getenv("TWITCH_CLIENT_ID")
	clientSecret := os.Getenv("TWITCH_CLIENT_SECRET")

	params := url.Values{}
	params.Add("client_id", clientID)
	params.Add("client_secret", clientSecret)
	params.Add("grant_type", "client_credentials")

	resp, err := http.PostForm("https://id.twitch.tv/oauth2/token", params)
	if err != nil {
		return nil, fmt.Errorf("failed to get token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get token: %d %s", resp.StatusCode, string(body))
	}

	var token Token
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, fmt.Errorf("failed to parse token response: %w", err)
	}

	return &token, nil
}

func getUser(accessToken, login string) (*User, error) {
	clientID := os.Getenv("TWITCH_CLIENT_ID")

	apiURL := fmt.Sprintf("https://api.twitch.tv/helix/users?login=%s", login)

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

func promptUser(prompt string) (string, error) {
	reader := bufio.NewReader(os.Stdin)
	fmt.Print(prompt)
	input, err := reader.ReadString('\n')
	if err != nil {
		if err == io.EOF {
			return "", fmt.Errorf("input cancelled")
		}
		return "", err
	}
	return strings.TrimSpace(input), nil
}

func main() {
	log.SetFlags(log.Lshortfile)

	if err := checkEnv(); err != nil {
		log.Fatalf("Environment check failed: %v\n", err)
	}

	var username string
	if len(os.Args) > 1 {
		username = os.Args[1]
	} else {
		var err error
		username, err = promptUser("Enter the User whose Data you want to retrieve: ")
		if err != nil {
			if err.Error() == "input cancelled" {
				return
			}
			log.Fatalf("Failed to read input: %v\n", err)
		}
	}

	if username == "" {
		fmt.Println("No username provided")
		os.Exit(1)
	}

	token, err := getToken()
	if err != nil {
		log.Fatalf("Failed to get token: %v\n", err)
	}

	userData, err := getUser(token.AccessToken, strings.ToLower(username))
	if err != nil {
		log.Fatalf("Failed to get user: %v\n", err)
	}

	output, err := json.MarshalIndent(userData, "", "  ")
	if err != nil {
		log.Fatalf("Failed to marshal user data: %v\n", err)
	}

	fmt.Println(string(output))
}
