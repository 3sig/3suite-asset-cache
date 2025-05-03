import config from "3lib-config";
import fs from "fs";
import cors from "cors";
import process from "process";
import express from "express";
import { Readable } from "stream";
import { finished } from "stream/promises";
import multer from "multer";
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
// const upload = multer({ dest: 'uploads/' });

config.init();

let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const app = express();

app.use(upload.any());
app.use(express.json({ limit: "500mb" })); // for parsing application/json
app.use(express.urlencoded({ limit: "500mb" }));
app.use(cors());

let assetId = 0;
async function handleRequest(req, res, method) {
  let response, stream, filename;
  try {
    console.log("executing request", config.get("destinationServer") + req.url);
    let modifiedHeaders = { ...req.headers };

    let params = {
      method: method,
      headers: modifiedHeaders,
    };

    if (method == "POST") {
      let contentType = req.headers["content-type"];
      if (contentType.startsWith("application/json")) {
        params.body = JSON.stringify(req.body);
      } else if (contentType.startsWith("multipart/form-data")) {
        delete params.headers["content-type"];
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
    }

    stream = fs.createWriteStream(filepath);
    response = await fetch(
      "http" +
        (config.get("useHttps", false) ? "s" : "") +
        "://" +
        config.get("destinationServer") +
        req.url,
      params,
    );
  } catch (e) {
    console.log("error with request");
    console.log(e);
    res.status(500);
    res.end("error");
    return;
  }
  try {
    await finished(Readable.fromWeb(response.body).pipe(stream));

    res.send(filename);
  } catch (e) {
    console.log("error with response");
    console.log(e);
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

let port = config.get("port");
app.listen(port, () => {
  console.log(`3suite-asset-cache listening on port ${port}`);
});
