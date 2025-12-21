package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type User struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

/* ---------- PRIME ---------- */

func isPrime(num int) bool {
	if num <= 1 {
		return false
	}
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
	count, num := 0, 2
	for count < 10000 {
		if isPrime(num) {
			count++
		}
		num++
	}
	return num - 1
}

/* ---------- MAIN ---------- */

func main() {
	// IMPORTANT: Respect Docker CPU quota
	runtime.GOMAXPROCS(runtime.NumCPU())

	dsn := fmt.Sprintf("%s:%s@tcp(%s:3306)/%s",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASS"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_NAME"),
	)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal(err)
	}

	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	http.HandleFunc("/db/", func(w http.ResponseWriter, r *http.Request) {
		idStr := r.URL.Path[len("/db/"):]
		id, _ := strconv.Atoi(idStr)

		var u User
		err := db.QueryRow(
			"SELECT id, name, email FROM users WHERE id = ?",
			id,
		).Scan(&u.ID, &u.Name, &u.Email)

		if err != nil {
			w.WriteHeader(http.StatusNotFound)
			return
		}

		json.NewEncoder(w).Encode(u)
	})

	http.HandleFunc("/calc", func(w http.ResponseWriter, r *http.Request) {
		result := compute10kPrime()
		json.NewEncoder(w).Encode(map[string]int{"result": result})
	})

	log.Println("Go server on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
