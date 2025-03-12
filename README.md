# Docker Run API

Executes `docker run` via an API. This is particularly useful for application that only has a CLI command but not an API.

## Usage
### When there is an image hosted on Docker Hub
#### Upload Multiple Files (optional)
```
curl -X POST "http://localhost:5000/run" \
     -H "Content-Type: multipart/form-data" \
     -F "file1=@/path/to/localfile.jpg" \
     -F "command=docker run --rm -v {file1}:/tmp/img.jpg jitesoft/tesseract-ocr /tmp/img.jpg stdout"
```

#### Provide a Remote File (URL)
```
curl -X POST "http://localhost:5000/run" \
     -H "Content-Type: application/json" \
     -d '{
           "file1": "https://example.com/sample.pdf",
           "command": "docker run --rm -v {file1}:/tmp/img.jpg jitesoft/tesseract-ocr /tmp/img.jpg stdout"
         }'
```

### With a custom Dockerfile
```
curl --location 'http://localhost:3002/run' \
--form 'file1="https://url-to-file.pdf"' \
--form 'command="docker run --rm -v {file1}:{file1} pdfminer python /usr/local/bin/pdf2txt.py {file1}
"' \
--form 'dockerfile="\# Use an official Python image as a base image
FROM python:3.9-slim

\# Set the working directory in the container
WORKDIR /app

\# Install necessary dependencies and pdfminer
RUN pip install --no-cache-dir pdfminer.six

\# Copy your application code (if any) into the container
COPY . ."' \
--form 'docker_image_name="pdfminer"' \
--form 'file_extensions="{\"file1\": \"pdf\"}"'
```

:::note
`file_extensions` is used when the URL does not have the extension
:::