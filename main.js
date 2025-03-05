import config from "3lib-config";
import fs from "fs";
import cors from "cors";
import process from "process";
import express from "express";
import { Readable } from "stream";
import { finished } from "stream/promises";

config.init();

let sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const app = express();

app.use(express.json({ limit: "500mb" })); // for parsing application/json
app.use(express.urlencoded({ limit: "500mb" }));
app.use(cors());

let assetId = 0;
async function handleRequest(req, res, method) {
  try {
    console.log("executing request", config.get("destinationServer") + req.url);
    let modifiedHeaders = { ...req.headers };

    delete modifiedHeaders["content-length"];

    let params = {
      method: method,
      headers: modifiedHeaders,
    };

    if (method != "GET") {
      params.body = JSON.stringify(req.body);
    }

    let filename =
      config.get("filenamePrefix", "") +
      Date.now() +
      "-" +
      ("0000" + assetId++).slice(-2) +
      config.get("fileExtension", "");
    let filepath = config.get("directory") + "/" + filename;

    const stream = fs.createWriteStream(filepath);
    let response = await fetch(
      "http" +
        (config.get("useHttps", false) ? "s" : "") +
        "://" +
        config.get("destinationServer") +
        req.url,
      params,
    );

    await finished(Readable.fromWeb(response.body).pipe(stream));

    res.send(filename);
  } catch (e) {
    console.log("error with request");
    console.log(e);
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
