package httpx

import (
	"net/http"
	"strconv"
)

// ParsePaging reads page/page_size query params with the CONTRACT.md
// defaults: page defaults to 1 (1-based), page_size defaults to 20, capped
// at 100. Invalid values fall back to the defaults rather than erroring.
func ParsePaging(r *http.Request) (page, pageSize int) {
	page = 1
	pageSize = 20
	if v := r.URL.Query().Get("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			page = n
		}
	}
	if v := r.URL.Query().Get("page_size"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			pageSize = n
		}
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func Offset(page, pageSize int) int {
	return (page - 1) * pageSize
}
