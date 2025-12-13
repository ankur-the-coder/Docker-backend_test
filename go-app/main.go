package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"time" // Added for calculation timing

	"github.com/gofiber/fiber/v2"
	_ "github.com/go-sql-driver/mysql"
)

// Global DB connection pool
var db *sql.DB

func main() {
	// Connect to DB
	dsn := fmt.Sprintf("%s:%s@tcp(%s:3306)/%s",
		os.Getenv("DB_USER"), os.Getenv("DB_PASS"), os.Getenv("DB_HOST"), os.Getenv("DB_NAME"))

	var err error
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Error connecting to database: %v", err)
	}
	// Ping the DB to ensure connection is live
	if err = db.Ping(); err != nil {
		log.Fatalf("Error pinging database: %v", err)
	}
	db.SetMaxOpenConns(10) // Match Node.js pool size

	app := fiber.New()

	// --- 1. Original Endpoint (I/O Stress) ---
	app.Get("/users/:id", handleGetUsers)

	// --- 2. New Complex Endpoint (CPU + I/O Stress) ---
	app.Get("/complex/:n", handleComplex)

	log.Fatal(app.Listen(":8080"))
}

// Complex Fibonacci function (CPU-intensive)
func fib(n int) int {
	if n <= 1 {
		return n
	}
	return fib(n-1) + fib(n-2)
}

// Handles the /users/:id route
func handleGetUsers(c *fiber.Ctx) error {
	id := c.Params("id")
	// Perform a simple I/O operation (DB Query)
	var name string
	err := db.QueryRow("SELECT name FROM users WHERE id = ?", id).Scan(&name)

	if err == sql.ErrNoRows {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	} else if err != nil {
		log.Printf("DB Error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "database error"})
	}

	return c.JSON(fiber.Map{"id": id, "name": name})
}

// Handles the /complex/:n route
func handleComplex(c *fiber.Ctx) error {
	// 1. CPU-intensive calculation
	nStr := c.Params("n")
	n, err := strconv.Atoi(nStr)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid N parameter"})
	}

	start := time.Now()
	result := fib(n) // High complexity calculation
	duration := time.Since(start).Milliseconds()

	// 2. I/O operation (DB Query)
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	if err != nil {
		log.Printf("DB Count Error: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "database error"})
	}

	// 3. Return results including the calculation time (for metric extraction)
	return c.JSON(fiber.Map{
		"fib_input": n,
		"fib_result": result,
		"calc_time_ms": duration, // New metric
		"db_rows": count,
		"language": "Go",
	})
}