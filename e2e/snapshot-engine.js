const fs = require("fs");
const path = require("path");
const http = require("http");
const { PNG } = require("pngjs");
const pixelmatch = require("pixelmatch").default;

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    const { base, target, diff: threshold = 0.3 } = JSON.parse(body);
    console.log("Request to compare images: ", base, target);
    if (!base || !target) {
      res.statusCode = 400;
      return res.end(
        JSON.stringify({ error: "Missing base or target parameter" }),
      );
    }

    try {
      const basePath = path.resolve(__dirname, base);
      const targetPath = path.resolve(__dirname, target);
      console.log("Comparing images: ", basePath, targetPath);
      const img1 = await readPngFile(`${basePath}.png`);
      let img2 = null;
      try {
        img2 = await readPngFile(`${targetPath}.png`);
      } catch (error) {
        console.log("Can not read a file: ", error);
        // target not found -> we just took a screenshot
        res.end(JSON.stringify({ matches: true, diff: 0 }));
        return;
      }

      if (img1.width !== img2.width || img1.height !== img2.height) {
        res.statusCode = 400;
        console.log(
          "Image size mismatch: ",
          img1.width,
          img2.width,
          img1.height,
          img2.height,
        );
        fs.copyFileSync(
          `${basePath}.png`,
          path.join(__dirname, "reports", `${target}-base.png`),
        );
        fs.copyFileSync(
          `${targetPath}.png`,
          path.join(__dirname, "reports", `${target}-new.png`),
        );
        return res.end(
          JSON.stringify({ error: "Images have different dimensions" }),
        );
      }

      const diff = new PNG({ width: img1.width, height: img1.height });
      const numDiffPixels = pixelmatch(
        img1.data,
        img2.data,
        diff.data,
        img1.width,
        img1.height,
        { threshold: 0.1 },
      );

      const totalPixels = img1.width * img1.height;
      const diffPercent = (numDiffPixels / totalPixels) * 100;
      const matches = diffPercent <= parseFloat(threshold);
      console.log("Image diff: ", matches, threshold, diffPercent);
      const result = {
        matches,
        diff: diffPercent,
      };

      if (!matches) {
        const diffPath = path.join(__dirname, "reports", `${target}-diff.png`);
        fs.writeFileSync(diffPath, PNG.sync.write(diff));
        fs.copyFileSync(
          `${basePath}.png`,
          path.join(__dirname, "reports", `${target}-base.png`),
        );
        fs.copyFileSync(
          `${targetPath}.png`,
          path.join(__dirname, "reports", `${target}-new.png`),
        );
      }

      res.end(JSON.stringify(result));
    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.end(JSON.stringify({ matches: false, error: error.message }));
    }
  });
});

function readPngFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) reject(err);
      else resolve(PNG.sync.read(data));
    });
  });
}

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Snapshot engine running on port ${PORT}`);
});
