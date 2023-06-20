publish-docker:
	docker buildx build --platform linux/amd64 -t fancybits/chrome-capture-for-channels:latest --push .
