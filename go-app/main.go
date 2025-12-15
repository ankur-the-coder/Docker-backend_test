package main

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"os"
	"runtime"
	"time"

	"github.com/gofiber/fiber/v2"
	_ "github.com/go-sql-driver/mysql"
)

type User struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

/* ---------------- CPU PRIME LOGIC ---------------- */
// No changes to logic, just pure raw execution power.
func isPrime(num int) bool {
	if num <= 1 {
		return false
	}
	// Optimization: Only check up to sqrt, skip even numbers after 2
	if num == 2 {
		return true
	}
	if num%2 == 0 {
		return false
	}
	limit := int(math.Sqrt(float64(num)))
	for i := 3; i <= limit; i += 2 {
		if num%i == 0 {
			return false
		}
	}
	return true
}

func compute10kPrime() int {
	count := 0
	num := 2
	for count < 10000 {
		if isPrime(num) {
			count++
		}
		num++
	}
	return num - 1
}

/* ---------------- MAIN ---------------- */

func main() {
	// 1. Maximize CPU usage
	runtime.GOMAXPROCS(runtime.NumCPU())

	/* ---- DB CONFIGURATION ---- */
	dsn := fmt.Sprintf("%s:%s@tcp(%s:3306)/%s",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASS"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_NAME"),
	)

	// retry connection logic for docker startup race conditions
	var db *sql.DB
	var err error
	for i := 0; i < 10; i++ {
		db, err = sql.Open("mysql", dsn)
		if err == nil && db.Ping() == nil {
			break
		}
		time.Sleep(2 * time.Second)
	}
	if err != nil {
		log.Fatal(err)
	}

	// 2. Optimization: Increase Connection Pool
	// 10 was too low for 2000 VUs. 50 fits well within 100MB RAM limits 
	// while allowing high IO throughput.
	db.SetMaxOpenConns(50)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	/* ---- FIBER APP ---- */
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
		// Optimization: fast pre-allocation for high throughput
		Concurrency: 256 * 1024, 
	})

	/* ---------------- I/O ENDPOINT ---------------- */
	app.Get("/db/:id", func(c *fiber.Ctx) error {
		id := c.Params("id")
		var user User
		// QueryRow is efficient and releases connection immediately
		err := db.QueryRow(
			"SELECT id, name, email FROM users WHERE id = ?",
			id,
		).Scan(&user.ID, &user.Name, &user.Email)

		if err != nil {
			return c.SendStatus(404) // Return 404 instead of 500 for missing ID
		}
		return c.JSON(user)
	})

	/* ---------------- CPU ENDPOINT ---------------- */
	app.Get("/calc", func(c *fiber.Ctx) error {
		// 3. Optimization: Native Goroutines
		// We removed the Worker Pool. Go spawns a lightweight Goroutine 
		// for every request. The Runtime Scheduler automatically timeslices 
		// these across your 4 CPUs. 
		// This eliminates the "Queue Full" (HTTP 429) errors entirely.
		result := compute10kPrime()
		return c.JSON(fiber.Map{"result": result})
	})

	log.Fatal(app.Listen(":8080"))
}