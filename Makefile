all: serve

# run server
serve:
	oak src/main.oak

# build app client
build:
	oak build --entry src/app.js.oak --output static/js/bundle.js --web
b: build

# build whenever Oak sources change
watch:
	ls *.oak lib/*.oak src/*.oak | entr -cr make build
w: watch

# format changed Oak source
fmt:
	oak fmt --changes --fix
f: fmt

