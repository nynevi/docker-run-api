const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const app = express();
const port = process.env.PORT || 3002;
const tmpPath = '/tmp'
const upload = multer({ dest: tmpPath });

app.use(express.json());

// Function to generate a unique filename while keeping the original name & extension
const generateUniqueFilename = (originalName) => {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    return `${name}-${uuidv4()}${ext}`;
};

// Function to download a file from a URL
const downloadFile = async (url, destFolder) => {
    const filename = generateUniqueFilename(path.basename(url));
    const filePath = path.join(destFolder, filename);

    const response = await axios({ url, responseType: "stream" });
    const writer = fs.createWriteStream(filePath);

    return new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on("finish", () => resolve(filePath));
        writer.on("error", reject);
    });
};

// POST /run -> Accepts multiple optional files, downloads remote files & executes Docker command
app.post("/run", upload.any(), async (req, res) => {
    let { command, ...fileMappings } = req.body;

    if (!command) return res.status(400).json({ error: "Missing Docker command." });

    let fileMap = {};

    // Process uploaded files
    if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
            const uniqueFilename = generateUniqueFilename(file.originalname);
            const uniqueFilePath = path.join(tmpPath, uniqueFilename);
            fs.renameSync(file.path, uniqueFilePath);
            fileMap[file.fieldname] = uniqueFilePath;
        });
    }

    // Process file URLs (download them)
    for (const key in fileMappings) {
        if (fileMappings[key].startsWith("http://") || fileMappings[key].startsWith("https://")) {
            try {
                fileMap[key] = await downloadFile(fileMappings[key], tmpPath);
            } catch (err) {
                return res.status(500).json({ error: `Failed to download ${fileMappings[key]}` });
            }
        }
    }

    // Replace {placeholders} in the command with actual file paths
    Object.keys(fileMap).forEach(key => {
        command = command.replace(`{${key}}`, fileMap[key]);
    });

    exec(command, (error, stdout, stderr) => {
        // Cleanup temporary files
        Object.values(fileMap).forEach(filePath => fs.unlinkSync(filePath));

        if (error) return res.status(500).json({ error: stderr });

        res.json({ output: stdout.trim() });
    });
});

app.listen(port, () => console.log(`API running on http://0.0.0.0:${port}`));
