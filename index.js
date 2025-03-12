const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const url = require('url')

const app = express();
const port = process.env.PORT || 3002;
const upload = multer({ dest: "/tmp" });

app.use(express.json());

// Function to generate a unique filename while keeping the original name & extension
const generateUniqueFilename = (originalName, extension) => {
    const ext = path.extname(originalName) || `.${extension}`;
    let name = path.basename(originalName, ext);

    // Replace invalid characters (anything that doesn't match the regex) with an underscore
    name = name.replace(/[^a-zA-Z0-9_.-]/g, '_');

    // Ensure the filename starts with an alphanumeric character
    if (!/^[a-zA-Z0-9]/.test(name)) {
        name = 'file_' + name; // Add a prefix if it doesn't start with a valid character
    }

    const newFileName = `${name}-${uuidv4()}${ext}`

    const parsedFileName = url.parse(newFileName);

    return parsedFileName.pathname;
};

// Function to download a file from a URL
const downloadFile = async (url, extension, destFolder) => {
    const filename = generateUniqueFilename(path.basename(url), extension);
    const filePath = path.join(destFolder, filename);

    const response = await axios({ url, responseType: "stream" });
    const writer = fs.createWriteStream(filePath);

    return new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on("finish", () => resolve(filePath));
        writer.on("error", reject);
    });
};

// POST /run -> Accepts Dockerfile instructions (optional) & executes Docker build/run
app.post("/run", upload.any(), async (req, res) => {
    let { command, dockerfile, docker_image_name = "custom-image", file_extensions, ...fileMappings } = req.body;
    const fileExtensions = JSON.parse(file_extensions || '{}')

    if (!command) {
        return res.status(400).json({ error: "Missing Docker command." });
    }

    // Process uploaded files
    let fileMap = {};
    if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
            const uniqueFilename = generateUniqueFilename(file.originalname, fileExtensions?.[file.fieldname]);
            const uniqueFilePath = path.join("/tmp", uniqueFilename);
            fs.renameSync(file.path, uniqueFilePath);
            fileMap[file.fieldname] = uniqueFilePath;
        });
    }

    // Process file URLs (download them)
    for (const key in fileMappings) {
        if (fileMappings[key].startsWith("http://") || fileMappings[key].startsWith("https://")) {
            try {
                fileMap[key] = await downloadFile(fileMappings[key], fileExtensions?.[key], "/tmp");
            } catch (err) {
                return res.status(500).json({ error: `Failed to download ${fileMappings[key]}` });
            }
        }
    }

    // Replace {placeholders} in the command with actual file paths
    Object.keys(fileMap).forEach(key => {
        command = command.replaceAll(`{${key}}`, fileMap[key]);
    });

    console.log('## command', command)


    // Replace {placeholders} in the Dockerfile with actual file paths (if any)
    if (dockerfile) {
        Object.keys(fileMap).forEach(key => {
            dockerfile = dockerfile.replace(`{${key}}`, fileMap[key]);
        });

        // Create a temporary Dockerfile if provided
        const tempDockerfilePath = path.join("/tmp", `Dockerfile-${uuidv4()}`);
        fs.writeFileSync(tempDockerfilePath, dockerfile);

        // Build the Docker image from the Dockerfile
        const buildCommand = `docker build -t ${docker_image_name} -f ${tempDockerfilePath} .`;
        exec(buildCommand, (error, stdout, stderr) => {
            if (error) return res.status(500).json({ error: stderr });

            // After build, run the container with the passed command
            exec(command, (error, stdout, stderr) => {
                // Cleanup temporary Dockerfile and files
                fs.unlinkSync(tempDockerfilePath);
                Object.values(fileMap).forEach(filePath => fs.unlinkSync(filePath));

                if (error) return res.status(500).json({ error: stderr });

                res.json({ output: stdout.trim() });
            });
        });
    } else {
        // If no Dockerfile is provided, directly execute the Docker run command
        exec(command, (error, stdout, stderr) => {
            Object.values(fileMap).forEach(filePath => fs.unlinkSync(filePath));

            if (error) return res.status(500).json({ error: stderr });

            res.json({ output: stdout.trim() });
        });
    }
});

app.listen(port, () => console.log(`API running on http://0.0.0.0:${port}`));
