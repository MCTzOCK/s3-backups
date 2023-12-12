/**
 * src/index.js
 *
 * Author: Ben Siebert <hello@ben-siebert.de>
 * Copyright: Copyright (c) 2018-2023 Ben Siebert. All rights reserved.
 * License: Project License
 * Created At: 12.12.2023
 *
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const Minio = require("minio");
const JSZip = require("jszip");

const defaultConfig = {
  minio: {
    endpoint: "localhost",
    port: 9000,
    accessKey: "minio",
    securityKey: "minio123",
    bucket: "backups",
  },
  files: ["/home/user"],
};

const cfgPath = path.join(os.homedir(), ".backup.json");

if (!fs.existsSync(cfgPath)) {
  fs.writeFileSync(cfgPath, JSON.stringify(defaultConfig, null, 2));
  console.log("Created default config file");
  console.log("Please edit the config file at " + cfgPath);
  process.exit(0);
}

const cfg = JSON.parse(fs.readFileSync(cfgPath));

if (
  !cfg.minio.endpoint ||
  !cfg.minio.accessKey ||
  !cfg.minio.securityKey ||
  !cfg.minio.bucket ||
  !cfg.files
) {
  console.log("Please edit the config file at " + cfgPath);
  process.exit(0);
}

const minioClient = new Minio.Client({
  endPoint: cfg.minio.endpoint,
  port: 443,
  accessKey: cfg.minio.accessKey,
  secretKey: cfg.minio.securityKey,
  useSSL: true,
});

const backup = async () => {
  const filePaths = [];

  for (let i = 0; i < cfg.files.length; i++) {
    console.log("Backup " + cfg.files[i]);
    const paths = getFilePathsRecursive(cfg.files[i]);

    const zip = new JSZip();
    for (const path of paths) {
      const data = fs.readFileSync(path);
      console.log(path.replace(cfg.files[i], ""));
      zip.file(path.replace(cfg.files[i], ""), data);
    }
    const content = await zip.generateAsync({ type: "nodebuffer" });
    const tmpFile = path.join(
      os.tmpdir(),
      path.basename(cfg.files[i]) + ".zip",
    );
    fs.writeFileSync(tmpFile, content);
    filePaths.push(tmpFile);
  }

  // Format: XXXX/Month/Day/Hour/Minute
  const rootFolder =
    new Date().getFullYear() +
    "/" +
    new Date().toLocaleString("default", {
      month: "long",
    }) +
    "/" +
    new Date().toLocaleString("default", {
      day: "numeric",
    }) +
    "/" +
    new Date().toLocaleString("default", {
      hour: "numeric",
    }) +
    "/" +
    new Date().toLocaleString("default", {
      minute: "numeric",
    }) +
    "/";

  for (const file of filePaths) {
    await minioClient.fPutObject(
      cfg.minio.bucket,
      rootFolder + path.basename(file),
      file,
    );
  }

  console.log("Backup done");
};

const getFilePathsRecursive = (dir) => {
  const files = [];

  fs.readdirSync(dir).forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      files.push(...getFilePathsRecursive(filePath));
    } else {
      files.push(filePath);
    }
  });

  return files;
};

backup();
