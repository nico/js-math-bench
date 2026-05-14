bench-libm: bench-libm.c bench-libm-data.inc
	$(CC) -O2 bench-libm.c -lm -o bench-libm

v8_ieee754.o:
	$(CXX) -c -O2 v8_ieee754.cc -std=c++23

bench-libm-fdlibm: bench-libm.c bench-libm-data.inc v8_ieee754.o
	$(CC) -O2 bench-libm.c v8_ieee754.o -lm -o bench-libm-fdlibm

bench-libm-data.inc: ../test_data.json generate-libm-bench.js
	node generate-libm-bench.js > bench-libm-data.inc

clean:
	rm -f bench-libm bench-libm-fdlibm bench-libm-data.inc

.PHONY: clean
