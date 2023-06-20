publish-docker:
	docker buildx build --platform linux/amd64 -t fancybits/chrome-capture-for-channels:latest --push .

dist/chrome-capture-for-channels-macos: dist/chrome-capture-for-channels-macos-arm64 dist/chrome-capture-for-channels-macos-x64
	lipo $^ -create -output $@
