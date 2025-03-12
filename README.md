# Docker Run API

Executes `docker run` via an API. This is particularly useful for application that only has a CLI command but not an API.

## Usage
### Upload Multiple Files (optional)
```
curl -X POST "http://localhost:5000/run" \
     -H "Content-Type: multipart/form-data" \
     -F "file1=@/path/to/localfile.jpg" \
     -F "command=docker run --rm -v {file1}:/tmp/img.jpg jitesoft/tesseract-ocr /tmp/img.jpg stdout"
```

### Provide a Remote File (URL)
```
curl -X POST "http://localhost:5000/run" \
     -H "Content-Type: application/json" \
     -d '{
           "file1": "https://example.com/sample.pdf",
           "command": "docker run --rm -v {file1}:/tmp/img.jpg jitesoft/tesseract-ocr /tmp/img.jpg stdout"
         }'

```