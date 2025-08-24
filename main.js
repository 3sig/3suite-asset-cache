import config from "3lib-config";
import fs from "fs";
import cors from "cors";
import process from "process";
import express from "express";
import { Readable } from "stream";
import { finished } from "stream/promises";
import formidable from "formidable";

config.init();

let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const app = express();

app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ limit: "500mb" }));
app.use(cors());

let assetId = 0;
async function handleRequest(req, res, method) {
  let response, stream, filename;
  const verbose = config.get("verbose", false);

  console.log(`Processing ${method} request to ${req.url}`);
  if (verbose) {
    console.log(`Full URL: ${config.get("destinationServer")}${req.url}`);
    console.log(`Headers: ${JSON.stringify(req.headers, null, 2)}`);
  }

  try {
    let modifiedHeaders = { ...req.headers };

    let params = {
      method: method,
      headers: modifiedHeaders,
    };

    if (method == "POST") {
      let contentType = req.headers["content-type"];
      if (contentType && contentType.startsWith("application/json")) {
        params.body = JSON.stringify(req.body);

        if (verbose) {
          console.log(`JSON body: ${JSON.stringify(req.body)}`);
        }

      // below here we shimmed the existing code with formidable
      // we previously used multer, but it couldn't recognize requests from bunjs
      // todo: clean this up. i'm sure this is a mess
      } else if (contentType && contentType.startsWith("multipart/form-data")) {
        const form = formidable({ keepExtensions: true });
        const [fields, files] = await form.parse(req);

        // Convert formidable format to multer-compatible format
        req.body = {};
        req.files = [];

        // Handle fields
        for (let [key, value] of Object.entries(fields)) {
          req.body[key] = Array.isArray(value) ? value[0] : value;
        }

        // Handle files
        for (let [fieldname, fileArray] of Object.entries(files)) {
          const fileList = Array.isArray(fileArray) ? fileArray : [fileArray];
          for (let file of fileList) {
            const buffer = await fs.promises.readFile(file.filepath);
            req.files.push({
              fieldname: fieldname,
              originalname: file.originalFilename,
              mimetype: file.mimetype,
              buffer: buffer,
              size: file.size
            });
            // Clean up temporary file
            await fs.promises.unlink(file.filepath);
          }
        }

        let formData = new FormData();
        for (let key in req.body) {
          formData.append(key, req.body[key]);
        }
        for (let file of req.files) {
          formData.append(
            file.fieldname,
            new Blob([file.buffer], { type: file.mimetype }),
            file.originalname,
          );
        }
        params.body = formData;

        delete modifiedHeaders["content-type"];
        delete modifiedHeaders["accept-encoding"];
        delete modifiedHeaders["transfer-encoding"];

        if (verbose) {
          for (let key of formData.keys()) {
            console.log(`Form data key: ${key}`);
            console.log(`Form data value: ${formData.get(key)}`);
          }
          console.log(`Files: ${req.files.length}`);
          req.files.forEach((file, i) => console.log(`File ${i}: ${file.originalname} (${file.size} bytes)`));
        }
      }
    }

    filename =
      config.get("filenamePrefix", "") +
      Date.now() +
      "-" +
      ("0000" + assetId++).slice(-2) +
      config.get("fileExtension", "");
    let filepath = config.get("directory") + "/" + filename;

    if (req.headers["3suite-filepath"]) {
      filepath = req.headers["3suite-filepath"];
      console.log(`Using custom filepath: ${filepath}`);
    } else {
      console.log(`Generated filename: ${filename}`);
      if (verbose) {
        console.log(`Full filepath: ${filepath}`);
        console.log(`Asset ID: ${assetId - 1}`);
      }
    }

    stream = fs.createWriteStream(filepath);
    const targetUrl = "http" +
      (config.get("useHttps", false) ? "s" : "") +
      "://" +
      config.get("destinationServer") +
      req.url;

    if (verbose) {
      console.log(`Fetching from: ${targetUrl}`);
      console.log(`Request params: ${JSON.stringify({method, headers: Object.keys(modifiedHeaders)}, null, 2)}`);
    }

    response = await fetch(targetUrl, params);
  } catch (e) {
    console.log(`Request failed: ${e.message}`);
    if (verbose) {
      console.log(`Full error: ${e.stack}`);
    }
    res.status(500);
    res.end("error");
    return;
  }
  try {
    if (verbose) {
      console.log(`Response status: ${response.status}`);
      console.log(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers), null, 2)}`);
    }

    await finished(Readable.fromWeb(response.body).pipe(stream));
    console.log(`Asset cached successfully: ${filename}`);
    res.send(filename);
  } catch (e) {
    console.log(`Response streaming failed: ${e.message}`);
    if (verbose) {
      console.log(`Full error: ${e.stack}`);
    }
    res.status(500);
    res.end("error");
  }
}

app.post("*", (req, res) => {
  handleRequest(req, res, "POST");
});

app.get("*", (req, res) => {
  handleRequest(req, res, "GET");
});

app.put("*", (req, res) => {
  handleRequest(req, res, "PUT");
});

app.options("*", (req, res) => {
  handleRequest(req, res, "OPTIONS");
});

const port = config.get("port");
const verbose = config.get("verbose", false);

app.listen(port, () => {
  console.log(`3suite-asset-cache listening on port ${port}`);
  if (verbose) {
    console.log(`Destination server: ${config.get("destinationServer")}`);
    console.log(`HTTPS enabled: ${config.get("useHttps", false)}`);
    console.log(`Cache directory: ${config.get("directory")}`);
    console.log(`Filename prefix: ${config.get("filenamePrefix", "none")}`);
    console.log(`File extension: ${config.get("fileExtension", "none")}`);
  }
});
