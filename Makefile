.PHONY: all clean dev

all:
	tsc *.ts

clean:
	rm *.js

dev:
	tsc -w *.ts
