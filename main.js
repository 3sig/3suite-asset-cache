import config from "3lib-config";
import fs from "fs";
import cors from "cors";
import express from "express";
import {
  createProxyMiddleware,
  responseInterceptor,
} from "http-proxy-middleware";

config.init();

const app = express();

let assetId = 0;
const proxyMiddleware = createProxyMiddleware({
  target: config.get("destinationServer"),
  changeOrigin: true,
  selfHandleResponse: true,
  on: {
    proxyRes: responseInterceptor(
      async (responseBuffer, proxyRes, req, res) => {
        let filename =
          config.get("filenamePrefix", "") +
          Date.now() +
          "-" +
          ("0000" + assetId++).slice(-2) +
          config.get("fileExtension", "");
        let filepath = config.get("directory") + "/" + filename;

        if (req.headers["3suite-filepath"]) {
          filepath = req.headers["3suite-filepath"];
        }

        try {
          fs.writeFileSync(filepath, responseBuffer);
        } catch (err) {
          console.error("Error writing to file:", err);
        }

        res.setHeader("content-type", "text/plain");
        return filename;
      },
    ),
  },
  logger: console,
});
app.use("/", proxyMiddleware);
app.use(cors());

let port = config.get("port");
app.listen(port, () => {
  console.log(
    `3suite-asset-cache listening on port ${port}, forwarding to ${config.get("destinationServer")}`,
  );
});
