bench-libm: bench-libm.c bench-libm-data.inc
	$(CC) -O2 bench-libm.c -lm -o bench-libm

bench-libm-data.inc: ../test_data.json generate-libm-bench.js
	node generate-libm-bench.js > bench-libm-data.inc

clean:
	rm -f bench-libm bench-libm-data.inc

.PHONY: clean
